"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import { getTalentSheetSync, runTalentSheetSync, saveTalentSheetSync } from "@/lib/api/talent-pool-sync";
import { googleSheetCsvUrl } from "@/lib/imports/free-class";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Sign in first.");
  return session.user.name || session.user.email || "CCC User";
}

/** Saves the sheet link and syncs it at once; from then on every hour. */
export async function startTalentSheetSyncAction(url: string) {
  const actor = await requireUser();
  const link = String(url || "").trim();
  try { googleSheetCsvUrl(link); } catch { throw new Error("Paste the Google Sheet link (docs.google.com/spreadsheets/…)."); }
  await saveTalentSheetSync({ url: link, startedBy: actor, startedAt: new Date().toISOString() });
  await logActivity({ userName: actor, module: "Talent Pool", action: "Start Google Sheet sync", detail: "Every hour", table: "talent_pool" });
  const state = await runTalentSheetSync(actor);
  revalidatePath("/talent-pool");
  return state;
}

export async function syncTalentSheetNowAction() {
  const actor = await requireUser();
  const state = await runTalentSheetSync(actor);
  revalidatePath("/talent-pool");
  return state;
}

/** Stops the hourly sync. People already imported stay. */
export async function stopTalentSheetSyncAction() {
  const actor = await requireUser();
  if (!(await getTalentSheetSync())) return null;
  await saveTalentSheetSync(null);
  await logActivity({ userName: actor, module: "Talent Pool", action: "Stop Google Sheet sync", detail: "", table: "talent_pool" });
  revalidatePath("/talent-pool");
  return null;
}
