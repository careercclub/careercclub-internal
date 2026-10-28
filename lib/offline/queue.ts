// Browser side of offline changes (Putaran 55). Changes wait in IndexedDB on this device until the
// connection is back, then go to the server one by one, oldest first. Only the simple saves listed
// in lib/offline/fields.ts can wait; everything else still says "You’re offline, so this was not saved".

import { applyOfflineChangeAction } from "@/app/_actions/offline-actions";
import { OFFLINE_MESSAGE } from "@/lib/actions/unwrap";
import { mergeOfflineChanges, offlineDiff, type Conflict, type FieldValues, type OfflineKind } from "./fields";

export type QueuedChange = {
  key: string; item: string; kind: OfflineKind; id: string; label: string;
  before: Record<string, string>; after: Record<string, string>;
  at: string; state: "pending" | "check"; reason?: string; conflicts?: Conflict[];
};

export const QUEUE_EVENT = "ccc-offline-queue";
const DB = "ccc-offline";
const STORE = "changes";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const request = work(t.objectStore(STORE));
      t.oncomplete = () => resolve(request ? request.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally { db.close(); }
}

const changed = () => window.dispatchEvent(new Event(QUEUE_EVENT));

export async function listQueued(): Promise<QueuedChange[]> {
  if (typeof indexedDB === "undefined") return [];
  const rows = (await tx<QueuedChange[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedChange[]>).catch(() => [])) || [];
  return rows.sort((a, b) => a.at.localeCompare(b.at));
}

async function put(change: QueuedChange) { await tx("readwrite", (store) => { store.put(change); }); changed(); }
async function drop(key: string) { await tx("readwrite", (store) => { store.delete(key); }); changed(); }

/** Sign out: changes that never reached the server leave this device with the person. */
export async function clearQueue() {
  if (typeof indexedDB === "undefined") return;
  await tx("readwrite", (store) => { store.clear(); }).catch(() => undefined);
  changed();
}

async function enqueue(kind: OfflineKind, id: string, label: string, diff: { before: Record<string, string>; after: Record<string, string> }) {
  const item = `${kind}:${id}`;
  const waiting = (await listQueued()).find((row) => row.item === item && row.state === "pending");
  const next = waiting ? mergeOfflineChanges(waiting, diff) : diff;
  if (!Object.keys(next.after).length) return waiting ? drop(waiting.key) : undefined;
  const at = new Date().toISOString();
  await put({ key: waiting?.key || `${item}:${at}`, item, kind, id, label, ...next, at: waiting?.at || at, state: "pending" });
}

/**
 * Save now, or keep the change on this device when offline. Returns "queued" when it waits for the
 * connection; the screen keeps the change. `before` is what the person saw, `after` what they chose.
 */
export async function saveOrQueue<T>(input: { kind: OfflineKind; id: string; label: string; before: FieldValues; after: FieldValues }, save: () => Promise<T>): Promise<T | "queued"> {
  const diff = offlineDiff(input.kind, input.before, input.after);
  // Nothing changed: nothing to send or keep.
  if (!Object.keys(diff.after).length && typeof navigator !== "undefined" && navigator.onLine === false) return "queued";
  const item = `${input.kind}:${input.id}`;
  // A change for this item is still waiting: this one goes after it, never before it.
  const waiting = typeof indexedDB !== "undefined" && (await listQueued()).some((row) => row.item === item && row.state === "pending");
  if (Object.keys(diff.after).length && (waiting || (typeof navigator !== "undefined" && navigator.onLine === false))) {
    await enqueue(input.kind, input.id, input.label, diff);
    return "queued";
  }
  try {
    return await save();
  } catch (error) {
    if (error instanceof Error && error.message === OFFLINE_MESSAGE && Object.keys(diff.after).length) {
      await enqueue(input.kind, input.id, input.label, diff);
      return "queued";
    }
    throw error;
  }
}

let running: Promise<number> | null = null;

/** Send waiting changes, oldest first. Returns how many the server answered (saved or needing a check). */
export function syncQueue(): Promise<number> {
  if (!running) running = sendAll().finally(() => { running = null; });
  return running;
}

async function sendAll() {
  let saved = 0;
  for (const change of await listQueued()) {
    if (change.state !== "pending") continue;
    if (navigator.onLine === false) break;
    const outcome = await send(change);
    if (outcome === "offline") break;
    saved++;
  }
  return saved;
}

async function send(change: QueuedChange, keepMine = false): Promise<"saved" | "check" | "offline"> {
  try {
    const reply = await applyOfflineChangeAction({ kind: change.kind, id: change.id, before: change.before, after: change.after }, keepMine);
    if (reply.result === "conflict") { await put({ ...change, state: "check", reason: "Someone else changed it while you were offline.", conflicts: reply.conflicts }); return "check"; }
    if (reply.result === "missing") { await put({ ...change, state: "check", reason: `This ${change.kind} was deleted.`, conflicts: [] }); return "check"; }
    await drop(change.key);
    return "saved";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save.";
    if (message === OFFLINE_MESSAGE) return "offline";
    await put({ ...change, state: "check", reason: message, conflicts: [] });
    return "check";
  }
}

/** "Keep my change": save it over what is there now. */
export async function keepMine(change: QueuedChange) {
  if (change.reason === `This ${change.kind} was deleted.`) return discard(change);
  const outcome = await send({ ...change, state: "pending" }, true);
  if (outcome === "offline") throw new Error(OFFLINE_MESSAGE);
  return outcome;
}

export async function discard(change: QueuedChange) {
  await drop(change.key);
  return "discarded" as const;
}
