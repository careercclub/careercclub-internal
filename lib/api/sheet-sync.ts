import "server-only";
import { logActivity } from "@/lib/api/activity";
import { applyProspectImport, previewProspectImport } from "@/lib/api/mt-prospects";
import { listAppSettings, saveAppSetting } from "@/lib/api/settings";
import { importTalentPoolRows } from "@/lib/api/talent-pool";
import { applyPainPoints } from "@/lib/api/customer-knowledge-agent";
import { fetchMtGoogleSheet, parseMtWorkbook } from "@/lib/imports/mt-prospects-sheet";
import { painPointRows } from "@/lib/imports/pain-points-sheet";
import { fetchGoogleSheet, SheetProblem, talentPoolRows } from "@/lib/imports/talent-pool-sheet";
import { SHEET_SYNC_JOBS, type SheetSyncJob } from "@/lib/sheet-sync/jobs";

// Google Sheet → module, every hour. The sheet is where people (and Claude) edit; the web reads it.
//   - Talent Pool: the Google Form's responses tab. Same merge as Import file (by email, an empty
//     cell never clears anything, nobody removed).
//   - Job Vacancy MT: the whole "CCC List MT" sheet (every tab), the same as Import Excel: the sheet
//     is the source for its companies; companies added in the app stay. If a sync would remove
//     many companies at once (a tab deleted or emptied by mistake) it stops and waits for
//     "Apply anyway", so one bad edit cannot wipe the list.
//   - Customer Knowledge: an inbox tab of comments / DMs / replies (filled by Claude from Composio).
//     Same rules as Claude access: the same comment on the same platform is never added twice,
//     platform and category must exist (rows that do not fit are skipped and listed), nothing removed.

export const SYNC_EVERY_MINUTES = 60;
export type SyncResult = Record<string, number>;
export type SheetSyncState = {
  url: string; startedBy: string; startedAt: string;
  lastRunAt?: string; lastResult?: SyncResult; lastError?: string; needsReview?: boolean;
  /** Rows that were skipped and why (first few), e.g. "Row 14: category “Gaji” is not in Customer Knowledge". */
  lastWarnings?: string[];
};

const settingKey = (job: SheetSyncJob) => SHEET_SYNC_JOBS[job].settingKey;

export async function getSheetSync(job: SheetSyncJob): Promise<SheetSyncState | null> {
  const [row] = await listAppSettings({ eq: { key: settingKey(job) } });
  const value = row?.value as SheetSyncState | null | undefined;
  return value && typeof value === "object" && value.url ? value : null;
}

/** null stops the sync (stored as {} — the column cannot be empty). */
export async function saveSheetSync(job: SheetSyncJob, value: SheetSyncState | null) {
  await saveAppSetting(settingKey(job), value ?? {});
}

/** More than this many companies (or a fifth of them) gone in one sync needs a person to agree. */
export function tooManyRemoved(removed: number, current: number) {
  return removed > Math.max(5, Math.floor(current / 5));
}

async function readAndApply(job: SheetSyncJob, url: string, actor: string, force: boolean): Promise<{ result: SyncResult; review?: string; warnings?: string[] }> {
  if (job === "customer-knowledge") {
    const rows = painPointRows(await fetchGoogleSheet(url));
    const { items, summary } = await applyPainPoints(rows, "Google Sheet");
    const warnings = items.map((item, index) => (item.action === "invalid" ? `Row ${rows[index].row}: ${item.errors[0]}` : "")).filter(Boolean);
    return { result: { added: summary.added, updated: summary.updated, unchanged: summary.unchanged, skipped: summary.invalid }, warnings: warnings.slice(0, 5).concat(warnings.length > 5 ? [`…and ${warnings.length - 5} more rows`] : []) };
  }
  if (job === "talent-pool") {
    const r = await importTalentPoolRows(talentPoolRows(await fetchGoogleSheet(url)));
    return { result: { added: r.added, updated: r.updated, unchanged: r.unchanged, skipped: r.skipped } };
  }
  const parsed = parseMtWorkbook(await fetchMtGoogleSheet(url));
  const preview = await previewProspectImport(parsed);
  const c = preview.companies;
  if (!force && tooManyRemoved(c.removed, c.updated + c.removed)) {
    return { result: { added: c.added, updated: c.updated, removed: c.removed }, review: `The sheet would remove ${c.removed} of ${c.updated + c.removed} companies. Nothing was changed. Check the sheet; if it is right, choose Apply anyway.` };
  }
  const summary = await applyProspectImport(parsed, { fileName: "Google Sheet", importedBy: actor });
  return { result: { added: summary.companies.added, updated: summary.companies.updated, removed: summary.companies.removed, contacts: summary.contacts } };
}

/** Saves a run's outcome unless the sync was stopped or pointed at another sheet meanwhile. */
async function saveOutcome(job: SheetSyncJob, sync: SheetSyncState, outcome: Partial<SheetSyncState>) {
  const current = await getSheetSync(job);
  if (!current || current.url !== sync.url) return current;
  const next = { ...current, lastError: undefined, needsReview: undefined, lastWarnings: undefined, ...outcome };
  await saveSheetSync(job, next);
  return next;
}

const running = new Map<SheetSyncJob, Promise<SheetSyncState | null>>();

/** One sync per module at a time (a click during the hourly run waits for that run). */
export function runSheetSync(job: SheetSyncJob, actor: string, { force = false } = {}) {
  const existing = running.get(job);
  if (existing) return existing;
  const run = (async () => {
    const sync = await getSheetSync(job);
    if (!sync) return null;
    const at = new Date().toISOString();
    const { module } = SHEET_SYNC_JOBS[job];
    try {
      const { result, review, warnings } = await readAndApply(job, sync.url, actor, force);
      if (review) return saveOutcome(job, sync, { lastRunAt: at, lastResult: result, lastError: review, needsReview: true });
      const next = await saveOutcome(job, sync, { lastRunAt: at, lastResult: result, lastWarnings: warnings?.length ? warnings : undefined });
      if (result.added || result.updated || result.removed) await logActivity({ userName: actor, module, action: "Google Sheet sync", detail: Object.entries(result).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(" · "), table: SHEET_SYNC_JOBS[job].table });
      return next;
    } catch (error) {
      const message = error instanceof SheetProblem ? error.message : "The sheet could not be read. It will be tried again next hour.";
      if (!(error instanceof SheetProblem)) console.error(`[sheet sync ${job}] failed`, error);
      return saveOutcome(job, sync, { lastRunAt: at, lastError: message });
    }
  })().finally(() => running.delete(job));
  running.set(job, run);
  return run;
}

/** Called by the scheduler: each module whose sheet is set and whose last run is an hour old.
 *  A sync waiting for "Apply anyway" is not retried on its own. */
export async function runDueSheetSyncs(now = Date.now()) {
  const results: Array<SheetSyncState | null> = [];
  for (const job of Object.keys(SHEET_SYNC_JOBS) as SheetSyncJob[]) {
    const sync = await getSheetSync(job);
    if (!sync || sync.needsReview) continue;
    if (sync.lastRunAt && now - Date.parse(sync.lastRunAt) < SYNC_EVERY_MINUTES * 60_000) continue;
    results.push(await runSheetSync(job, "Google Sheet sync"));
  }
  return results;
}
