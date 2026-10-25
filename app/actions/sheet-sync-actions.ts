"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import { getSheetSync, runSheetSync, saveSheetSync } from "@/lib/api/sheet-sync";
import { googleSheetCsvUrl } from "@/lib/imports/free-class";
import { isSheetSyncJob, SHEET_SYNC_JOBS, type SheetSyncJob } from "@/lib/sheet-sync/jobs";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Sign in first.");
  return session.user.name || session.user.email || "CCC User";
}
function checkJob(job: string): SheetSyncJob {
  if (!isSheetSyncJob(job)) throw new Error("Unknown module.");
  return job;
}

/** Saves the sheet link and syncs it at once; from then on every hour. */
export async function startSheetSyncAction(job: string, url: string) {
  const actor = await requireUser(); const id = checkJob(job);
  const link = String(url || "").trim();
  try { googleSheetCsvUrl(link); } catch { throw new Error("Paste the Google Sheet link (docs.google.com/spreadsheets/…)."); }
  await saveSheetSync(id, { url: link, startedBy: actor, startedAt: new Date().toISOString() });
  await logActivity({ userName: actor, module: SHEET_SYNC_JOBS[id].module, action: "Start Google Sheet sync", detail: "Every hour", table: SHEET_SYNC_JOBS[id].table });
  const state = await runSheetSync(id, actor);
  revalidatePath(SHEET_SYNC_JOBS[id].path);
  return state;
}

/** Sync now. `force` is "Apply anyway" after a sync stopped because many rows would be removed. */
export async function syncSheetNowAction(job: string, force = false) {
  const actor = await requireUser(); const id = checkJob(job);
  const state = await runSheetSync(id, actor, { force: force === true });
  revalidatePath(SHEET_SYNC_JOBS[id].path);
  return state;
}

/** Stops the hourly sync. What was already brought in stays. */
export async function stopSheetSyncAction(job: string) {
  const actor = await requireUser(); const id = checkJob(job);
  if (!(await getSheetSync(id))) return null;
  await saveSheetSync(id, null);
  await logActivity({ userName: actor, module: SHEET_SYNC_JOBS[id].module, action: "Stop Google Sheet sync", detail: "", table: SHEET_SYNC_JOBS[id].table });
  revalidatePath(SHEET_SYNC_JOBS[id].path);
  return null;
}
