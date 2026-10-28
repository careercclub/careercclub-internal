"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FIELD_LABELS } from "@/lib/offline/fields";
import { clearQueue, discard, keepMine, listQueued, QUEUE_EVENT, syncQueue, type QueuedChange } from "@/lib/offline/queue";
import { formatDay } from "@/lib/text/date";
import { notifyError } from "./app-dialog";

// Offline (Putaran 54–55). The service worker (public/sw.js) keeps the last copy of each page opened
// while online — never Resources or Settings — for 7 days, and forgets them on sign-out or when the
// account is Blocked. Ticket and task saves made offline wait on this device (lib/offline/queue.ts)
// and are sent when the connection is back; a change someone else overtook waits for the person.

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
const changes = (n: number) => `${n} ${n === 1 ? "change" : "changes"}`;

export function OfflineStatus() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const snapshot = useSyncExternalStore(noSubscribe, savedAt, () => "");
  const [queue, setQueue] = useState<QueuedChange[]>([]);
  const [reviewing, setReviewing] = useState(false);

  // The router object may change between renders; syncing must not restart because of that.
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);
  const sync = useCallback(async (connectionBack = false) => {
    if (!navigator.onLine) return;
    const saved = await syncQueue().catch(() => 0);
    // A saved copy on screen: load the live page now that the connection is back. Only then: a copy
    // shown while "online" means the server did not answer, and reloading would loop.
    if (connectionBack && savedAt()) window.location.reload();
    else if (saved) routerRef.current.refresh();
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => { void listQueued().then((rows) => { if (alive) setQueue(rows); }); };
    const queued = () => { load(); void sync(true); };
    load(); void sync();
    window.addEventListener(QUEUE_EVENT, load);
    window.addEventListener("online", queued);
    return () => { alive = false; window.removeEventListener(QUEUE_EVENT, load); window.removeEventListener("online", queued); };
  }, [sync]);

  useEffect(() => {
    if (!navigator.onLine || !navigator.serviceWorker?.controller) return;
    const timer = window.setTimeout(() => navigator.serviceWorker.controller?.postMessage({ type: "ccc-save-page", url: window.location.href }), 1500);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  const waiting = queue.filter((row) => row.state === "pending").length;
  useEffect(() => {
    // Online but the server did not answer (VPS restarting, captive Wi-Fi): try again every 30 s.
    if (!waiting || !online) return;
    void sync();
    const timer = window.setInterval(() => void sync(), 30_000);
    return () => window.clearInterval(timer);
  }, [waiting, online, sync]);
  const check = queue.filter((row) => row.state === "check");
  if (online && !snapshot && !waiting && !check.length) return null;
  const shown = snapshot ? `Showing the copy saved ${when(snapshot)}.` : "Showing what was already loaded.";
  return (
    <>
      <div aria-live="polite" className="sticky top-2 z-40 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-[13px] text-[var(--foreground)] shadow-sm" role="status">
        {!online || snapshot ? (
          <>
            <i aria-hidden="true" className="ti ti-wifi-off text-[15px]" />
            <b>Offline</b>
            <span>{shown} Ticket and task changes wait on this device; anything else needs a connection.</span>
          </>
        ) : null}
        {waiting ? <span className="inline-flex items-center gap-1.5 font-medium"><i aria-hidden="true" className={`ti ${online ? "ti-refresh" : "ti-clock"} text-[15px]`} />{online ? `Syncing ${changes(waiting)}…` : `${changes(waiting)} waiting to sync`}</span> : null}
        {check.length ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-medium">{changes(check.length)} {check.length === 1 ? "needs" : "need"} a check</span>
            <Button onClick={() => setReviewing(true)} size="sm" type="button" variant="outline">Review changes</Button>
          </span>
        ) : null}
      </div>
      {reviewing ? <ReviewChanges changes={check} onClose={() => setReviewing(false)} onSaved={() => router.refresh()} /> : null}
    </>
  );
}

function shownValue(field: string, value: string) {
  if (field === "assigned_to_ids" || field === "assignee_ids") { const n = value ? value.split(",").length : 0; return n ? `${n} ${n === 1 ? "person" : "people"}` : "No assignee"; }
  if (field === "divisi_id") return value ? "Another division" : "No division";
  if (field === "due_date") return value ? formatDay(value) : "No deadline";
  if (!value) return "Empty";
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}

function ReviewChanges({ changes: rows, onClose, onSaved }: { changes: QueuedChange[]; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState("");
  async function act(row: QueuedChange, how: "keep" | "discard") {
    setBusy(row.key);
    try {
      const outcome = how === "keep" ? await keepMine(row) : await discard(row);
      // Saved or dropped: show what the server has now.
      if (outcome !== "check") onSaved();
      if (rows.length === 1 && outcome !== "check") onClose();
    } catch (error) { notifyError(error, "Could not save your change."); } finally { setBusy(""); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review changes</DialogTitle>
          <DialogDescription>Made while offline and not saved yet.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-3">
          {rows.map((row) => {
            const deleted = row.reason === `This ${row.kind} was deleted.`;
            return (
              <li className="grid gap-2 rounded-xl border border-[var(--border)] p-3 text-[13px]" key={row.key}>
                <div><b>{row.kind === "ticket" ? "Ticket" : "Task"} · {row.label}</b><div className="text-[var(--muted-foreground)]">{row.reason}</div></div>
                {row.conflicts?.length ? (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {row.conflicts.map((c) => (
                      <div className="contents" key={c.field}>
                        <dt className="text-[var(--muted-foreground)]">{FIELD_LABELS[c.field] || c.field}</dt>
                        <dd>Yours: <b>{shownValue(c.field, c.mine)}</b> · Now: {shownValue(c.field, c.now)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : !deleted ? (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {Object.entries(row.after).map(([field, value]) => (
                      <div className="contents" key={field}><dt className="text-[var(--muted-foreground)]">{FIELD_LABELS[field] || field}</dt><dd>Yours: <b>{shownValue(field, value)}</b></dd></div>
                    ))}
                  </dl>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button disabled={Boolean(busy)} onClick={() => act(row, "discard")} size="sm" type="button" variant="outline">Discard my change</Button>
                  {!deleted ? <Button disabled={Boolean(busy)} onClick={() => act(row, "keep")} size="sm" type="button">{busy === row.key ? "Saving…" : "Keep my change"}</Button> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <DialogFooter sticky className="sm:justify-end">
          <Button onClick={onClose} type="button" variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sign out: drop the saved pages and unsent changes on this device first. */
export function forgetSavedPages() {
  try { navigator.serviceWorker?.controller?.postMessage({ type: "ccc-forget-pages" }); } catch { /* no service worker */ }
  try { void caches?.delete("ccc-pages-v1"); } catch { /* no Cache API */ }
  void clearQueue();
}
