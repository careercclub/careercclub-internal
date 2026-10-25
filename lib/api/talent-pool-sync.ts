import "server-only";
import { logActivity } from "@/lib/api/activity";
import { listAppSettings, saveAppSetting } from "@/lib/api/settings";
import { importTalentPoolRows } from "@/lib/api/talent-pool";
import { fetchGoogleSheet, SheetProblem, talentPoolRows } from "@/lib/imports/talent-pool-sheet";

// Talent Pool ← Google Sheet, every hour. The sheet (the Google Form's responses) stays the source
// for the answers; the merge is the same as Import (lib/api/talent-pool.ts importTalentPoolRows):
// matched by email, new people added, empty cells never clear anything, nothing deleted.

export const SYNC_KEY = "talent_pool_sheet_sync";
export const SYNC_EVERY_MINUTES = 60;

export type SyncResult = { added: number; updated: number; unchanged: number; skipped: number };
export type TalentSheetSync = {
  url: string; startedBy: string; startedAt: string;
  lastRunAt?: string; lastResult?: SyncResult; lastError?: string;
};

export async function getTalentSheetSync(): Promise<TalentSheetSync | null> {
  const [row] = await listAppSettings({ eq: { key: SYNC_KEY } });
  const value = row?.value as TalentSheetSync | null | undefined;
  return value && typeof value === "object" && value.url ? value : null;
}

/** null stops the sync (stored as {} — the column cannot be empty). */
export async function saveTalentSheetSync(value: TalentSheetSync | null) {
  await saveAppSetting(SYNC_KEY, value ?? {});
}

let running: Promise<TalentSheetSync | null> | null = null;

/** Saves a run's outcome unless the sync was stopped or pointed at another sheet meanwhile. */
async function saveOutcome(sync: TalentSheetSync, outcome: Partial<TalentSheetSync>) {
  const current = await getTalentSheetSync();
  if (!current || current.url !== sync.url) return current;
  const next = { ...current, ...outcome };
  await saveTalentSheetSync(next);
  return next;
}

/** One sync at a time (a click during the hourly run waits for that run instead of starting another). */
export function runTalentSheetSync(actor: string) {
  running ||= (async () => {
    const sync = await getTalentSheetSync();
    if (!sync) return null;
    const at = new Date().toISOString();
    try {
      const result = await importTalentPoolRows(talentPoolRows(await fetchGoogleSheet(sync.url)));
      const lastResult = { added: result.added, updated: result.updated, unchanged: result.unchanged, skipped: result.skipped };
      const next = await saveOutcome(sync, { lastRunAt: at, lastResult, lastError: undefined });
      if (lastResult.added || lastResult.updated) await logActivity({ userName: actor, module: "Talent Pool", action: "Google Sheet sync", detail: `${lastResult.added} added · ${lastResult.updated} updated`, table: "talent_pool" });
      return next;
    } catch (error) {
      const message = error instanceof SheetProblem ? error.message : "The sheet could not be read. It will be tried again next hour.";
      if (!(error instanceof SheetProblem)) console.error("[talent-pool sync] failed", error);
      return saveOutcome(sync, { lastRunAt: at, lastError: message });
    }
  })().finally(() => { running = null; });
  return running;
}

/** Called by the scheduler: runs when a sheet is set and the last run is an hour old. */
export async function runTalentSheetSyncIfDue(now = Date.now()) {
  const sync = await getTalentSheetSync();
  if (!sync) return null;
  if (sync.lastRunAt && now - Date.parse(sync.lastRunAt) < SYNC_EVERY_MINUTES * 60_000) return null;
  return runTalentSheetSync("Google Sheet sync");
}
