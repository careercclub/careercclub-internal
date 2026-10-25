import "server-only";
import { runTalentSheetSyncIfDue } from "@/lib/api/talent-pool-sync";

// Started once per server (instrumentation.ts). Checks every 10 minutes; the sync itself runs
// at most once an hour (the last run time is kept in app_settings, so a restart does not re-run it).
const CHECK_EVERY_MS = 10 * 60_000;

declare global { var __cccTalentSyncTimer: ReturnType<typeof setInterval> | undefined; }

export function startTalentSheetScheduler() {
  if (globalThis.__cccTalentSyncTimer) return;
  const check = () => { runTalentSheetSyncIfDue().catch((error) => console.error("[talent-pool sync] check failed", error)); };
  setTimeout(check, 60_000).unref?.();
  globalThis.__cccTalentSyncTimer = setInterval(check, CHECK_EVERY_MS);
  globalThis.__cccTalentSyncTimer.unref?.();
}
