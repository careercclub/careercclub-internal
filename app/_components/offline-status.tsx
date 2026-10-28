"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { formatDay } from "@/lib/text/date";

// Offline reading (Putaran 54). The service worker (public/sw.js) keeps the last copy of each page
// opened while online — never Resources or Settings — for 7 days, and forgets them on sign-out or
// when the account is Blocked. This bar says when the page shows such a copy, and asks the service
// worker to save pages opened inside the app (those are not browser navigations it can see).

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${formatDay(date.toLocaleDateString("en-CA"))}, ${time}`;
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange); window.addEventListener("offline", onChange);
  return () => { window.removeEventListener("online", onChange); window.removeEventListener("offline", onChange); };
}
const noSubscribe = () => () => {};
const savedAt = () => document.querySelector('meta[name="ccc-offline-snapshot"]')?.getAttribute("content") || "";

export function OfflineStatus() {
  const pathname = usePathname();
  const search = useSearchParams();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const snapshot = useSyncExternalStore(noSubscribe, savedAt, () => "");

  useEffect(() => {
    // A saved copy on screen: load the live page as soon as the connection is back.
    const reload = () => { if (savedAt()) window.location.reload(); };
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);

  useEffect(() => {
    if (!navigator.onLine || !navigator.serviceWorker?.controller) return;
    const timer = window.setTimeout(() => navigator.serviceWorker.controller?.postMessage({ type: "ccc-save-page", url: window.location.href }), 1500);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  if (online && !snapshot) return null;
  return (
    <div aria-live="polite" className="sticky top-2 z-40 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 shadow-sm text-[13px] text-[var(--foreground)]" role="status">
      <i aria-hidden="true" className="ti ti-wifi-off text-[15px]" />
      <b>Offline</b>
      <span>{snapshot ? `Showing the copy saved ${when(snapshot)}.` : "Showing what was already loaded."} Changes can’t be saved until you’re back online.</span>
    </div>
  );
}

/** Sign out: drop the saved pages on this device first, so nobody can read them offline afterwards. */
export function forgetSavedPages() {
  try { navigator.serviceWorker?.controller?.postMessage({ type: "ccc-forget-pages" }); } catch { /* no service worker */ }
  try { void caches?.delete("ccc-pages-v1"); } catch { /* no Cache API */ }
}
