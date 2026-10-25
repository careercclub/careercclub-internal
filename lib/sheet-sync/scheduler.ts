import "server-only";
import { runDueSheetSyncs } from "@/lib/api/sheet-sync";

// Started once per server (instrumentation.ts). Checks every 10 minutes; each Google Sheet sync
// runs at most once an hour (the last run time is kept in app_settings, so a restart does not re-run it).
const CHECK_EVERY_MS = 10 * 60_000;

declare global { var __cccSheetSyncTimer: ReturnType<typeof setInterval> | undefined; }

export function startSheetSyncScheduler() {
  if (globalThis.__cccSheetSyncTimer) return;
  const check = () => { runDueSheetSyncs().catch((error) => console.error("[sheet sync] check failed", error)); };
  setTimeout(check, 60_000).unref?.();
  globalThis.__cccSheetSyncTimer = setInterval(check, CHECK_EVERY_MS);
  globalThis.__cccSheetSyncTimer.unref?.();
}
