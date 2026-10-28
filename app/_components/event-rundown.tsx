"use client";

import { createRundownRowAction, deleteRundownRowAction, moveRundownRowAction, saveRundownRowAction } from "@/app/_actions/program-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import type { FormEvent } from "react";
import { useId, useMemo, useState, useTransition } from "react";
import { confirmAction, notifyError } from "./app-dialog";
import s from "./page-kit.module.css";
import r from "./rundown.module.css";
import { usePagination } from "./ui-kit";

export function addMinutes(time: string, minutes: number) {
  if (!time) return "";
  const [hours, mins] = time.split(":").map(Number);
  const total = (hours || 0) * 60 + (mins || 0) + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function rundownFor(rows: ApiRecord[], eventId: string) {
  return rows
    .filter((row) => String(row.event_id) === eventId)
    .sort((a, b) => Number(a.urutan || 0) - Number(b.urutan || 0));
}

// Each row starts when the previous one ends, seeded from the event's own start
// time — the running-time model the legacy rundown used. `next` is the finish time.
export function runningTimes(rows: ApiRecord[], startTime: string) {
  return rows.reduce<{ items: Array<{ row: ApiRecord; start: string }>; next: string }>(
    (state, row) => ({
      items: [...state.items, { row, start: state.next }],
      next: addMinutes(state.next, Number(row.durasi || 0)),
    }),
    { items: [], next: startTime },
  );
}

const hrefOf = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);
const hostOf = (value: string) => { try { return new URL(hrefOf(value)).hostname.replace(/^www\./, ""); } catch { return value; } };

// Shared by the standalone /program/rundown page and the event detail on /program,
// so both edit the same rows through the same actions. A timeline: each row reads, and
// switches to a form only while it is being edited.
/** `secondary` when it sits inside a panel that already has its own main button (Program event detail). */
export function EventRundown({ eventId, rows, startTime, title = "Rundown", secondary = false }: { eventId: string; rows: ApiRecord[]; startTime: string; title?: string; secondary?: boolean }) {
  const eventRows = useMemo(() => rundownFor(rows, eventId), [rows, eventId]);
  // Index against the full ordered list, not the page, so reordering stays correct
  // once the rows spill onto a second page.
  const timed = useMemo(() => runningTimes(eventRows, startTime).items.map((item, index) => ({ ...item, index })), [eventRows, startTime]);
  const { pageItems, page, setPage, totalPages } = usePagination(timed, 15);
  const nextOrder = eventRows.length ? Math.max(...eventRows.map((row) => Number(row.urutan || 0))) + 1 : 0;
  const [editingId, setEditingId] = useState("");
  const [pendingOrder, setPendingOrder] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  // A just-added row opens in edit mode as soon as it arrives.
  const fresh = pendingOrder === null ? undefined : eventRows.find((row) => Number(row.urutan || 0) === pendingOrder);
  const openId = editingId || (fresh ? String(fresh.id) : "");
  const total = eventRows.reduce((sum, row) => sum + Number(row.durasi || 0), 0);

  const run = (job: () => Promise<unknown>, failure: string) => startTransition(async () => { try { await job(); } catch (error) { notifyError(error, failure); } });
  function move(row: ApiRecord, index: number, target: ApiRecord, targetIndex: number) {
    let a = Number(row.urutan || 0); let b = Number(target.urutan || 0);
    // Two rows with the same order number would swap to the same values; fall back to positions.
    if (a === b) { a = index; b = targetIndex; }
    run(() => moveRundownRowAction(String(row.id), String(target.id), a, b), "Could not move the item.");
  }
  function add() {
    setEditingId(""); setPendingOrder(nextOrder);
    run(() => createRundownRowAction(eventId, nextOrder), "Could not add a rundown item.");
    const lastPage = Math.max(0, Math.ceil((timed.length + 1) / 15) - 1);
    if (lastPage !== page) setPage(lastPage);
  }
  const close = () => { setEditingId(""); setPendingOrder(null); };

  return (
    <section aria-label={title} className={r.rundown}>
      <header className={r.head}>
        <div><h2>{title}</h2><p className={s.cardSub}>{timed.length} item{timed.length === 1 ? "" : "s"} · {total} min{startTime ? ` · ${startTime}–${addMinutes(startTime, total)}` : " · set the event start time to see clock times"}</p></div>
        <button className={secondary ? s.ghost : s.primary} disabled={pending} onClick={add} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add rundown item</button>
      </header>
      {timed.length ? (
        <>
          <ol className={r.timeline}>
            {pageItems.map(({ row, start, index }) => {
              const id = String(row.id);
              const duration = Number(row.durasi || 0);
              return (
                <li className={openId === id ? `${r.item} ${r.editing}` : r.item} data-record-id={id} key={id}>
                  <div className={r.time}><b>{start || "—"}</b>{start ? <small>to {addMinutes(start, duration)}</small> : null}<span className={s.chipMuted}>{duration} min</span></div>
                  {openId === id ? <RowEditor close={close} row={row} /> : (
                    <div className={r.body}>
                      <b className={r.activity}>{String(row.activity || "Untitled activity")}</b>
                      {row.keterangan ? <p className={r.notes}>{String(row.keterangan)}</p> : null}
                      {row.cue_mc ? <blockquote className={r.cue}><span>MC</span>{String(row.cue_mc)}</blockquote> : null}
                      {row.link ? <a className={r.link} href={hrefOf(String(row.link))} rel="noreferrer" target="_blank"><i className="ti ti-link" aria-hidden="true" /> {hostOf(String(row.link))}</a> : null}
                    </div>
                  )}
                  {openId === id ? null : (
                    <div className={r.actions}>
                      <button aria-label={`Edit ${String(row.activity || "item")}`} className={r.mini} onClick={() => { setPendingOrder(null); setEditingId(id); }} type="button"><i className="ti ti-pencil" aria-hidden="true" /></button>
                      <button aria-label="Move up" className={r.mini} disabled={pending || index === 0} onClick={() => move(row, index, eventRows[index - 1], index - 1)} type="button"><i className="ti ti-chevron-up" aria-hidden="true" /></button>
                      <button aria-label="Move down" className={r.mini} disabled={pending || index === eventRows.length - 1} onClick={() => move(row, index, eventRows[index + 1], index + 1)} type="button"><i className="ti ti-chevron-down" aria-hidden="true" /></button>
                      <button aria-label="Delete rundown item" className={r.mini} disabled={pending} onClick={async () => { if (await confirmAction({ title: "Delete this rundown item?", message: "Later items move up and their times shift. This cannot be undone.", confirmLabel: "Delete rundown item", danger: true })) run(() => deleteRundownRowAction(id), "Could not delete the item."); }} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {totalPages > 1 ? (
            <div className={s.pager}>
              <button aria-label="Previous page" className={s.iconButton} disabled={page <= 0} onClick={() => setPage(page - 1)} type="button"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
              <span>Page {page + 1} of {totalPages}</span>
              <button aria-label="Next page" className={s.iconButton} disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} type="button"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
            </div>
          ) : null}
        </>
      ) : (
        <p className={s.empty}>No rundown yet. Add the first item — times are worked out from the event start.</p>
      )}
    </section>
  );
}

function RowEditor({ row, close }: { row: ApiRecord; close: () => void }) {
  const ids = useId();
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    try { await saveRundownRowAction(String(row.id), formData); close(); }
    catch (error) { notifyError(error, "Could not save the item."); }
    finally { setSaving(false); }
  }
  return (
    <form className={r.editor} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }} onSubmit={submit}>
      <label className={s.field}><span>Activity <b aria-hidden="true" className={s.req}>*</b></span><input autoFocus className={s.input} defaultValue={String(row.activity || "")} id={`${ids}-a`} name="activity" required /></label>
      <label className={s.field}><span>Duration (min)</span><input className={s.input} defaultValue={Number(row.durasi || 0)} min="0" name="durasi" type="number" /></label>
      <label className={`${s.field} ${r.wide}`}><span>Notes</span><textarea className={s.input} defaultValue={String(row.keterangan || "")} name="keterangan" rows={2} /></label>
      <label className={`${s.field} ${r.wide}`}><span>MC cue</span><textarea className={s.input} defaultValue={String(row.cue_mc || "")} name="cue_mc" placeholder="What the MC says" rows={2} /></label>
      <label className={`${s.field} ${r.wide}`}><span>Link</span><input className={s.input} defaultValue={String(row.link || "")} name="link" placeholder="https://" /></label>
      <div className={r.editorActions}>
        <button className={s.ghost} onClick={close} type="button">Cancel</button>
        <button className={s.primary} disabled={saving} type="submit">{saving ? "Saving…" : "Save item"}</button>
      </div>
    </form>
  );
}
