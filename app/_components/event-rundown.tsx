"use client";

import { createRundownRowAction, deleteRundownRowAction, moveRundownRowAction, saveRundownRowAction } from "@/app/actions/program-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo } from "react";
import { usePagination } from "./ui-kit";
import styles from "../record-manager.module.css";

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

// Shared by the standalone /program/rundown page and the event detail on /program,
// so both edit the same rows through the same actions.
export function EventRundown({ eventId, rows, startTime, title = "Rundown" }: { eventId: string; rows: ApiRecord[]; startTime: string; title?: string }) {
  const eventRows = useMemo(() => rundownFor(rows, eventId), [rows, eventId]);
  // Index against the full ordered list, not the page, so reordering stays correct
  // once the rows spill onto a second page.
  const timed = useMemo(() => runningTimes(eventRows, startTime).items.map((item, index) => ({ ...item, index })), [eventRows, startTime]);
  const { pageItems, page, setPage, totalPages } = usePagination(timed, 15);
  const nextOrder = eventRows.length ? Math.max(...eventRows.map((row) => Number(row.urutan || 0))) + 1 : 0;

  const move = (row: ApiRecord, target: ApiRecord) =>
    moveRundownRowAction(String(row.id), String(target.id), Number(row.urutan || 0), Number(target.urutan || 0));

  return (
    <section className={styles.rundownTable}>
      <header>
        <h2>{title}</h2>
        <button className={styles.primaryButton} type="button" onClick={() => createRundownRowAction(eventId, nextOrder)}><i className="ti ti-plus" /> Tambah</button>
      </header>
      {timed.length ? (
        <>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr><th>Waktu</th><th>Durasi (min)</th><th>Activity</th><th>Keterangan</th><th>Link</th><th>Cue MC</th><th>Urutan</th><th /></tr>
              </thead>
              <tbody>
                {pageItems.map(({ row, start, index }) => (
                  <tr key={String(row.id)}>
                    <td><strong>{start || "—"}</strong></td>
                    <td colSpan={5}>
                      <form action={saveRundownRowAction.bind(null, String(row.id))} className={styles.rundownForm}>
                        <input defaultValue={Number(row.durasi || 0)} min="0" name="durasi" type="number" />
                        <textarea defaultValue={String(row.activity || "")} name="activity" placeholder="Activity..." required />
                        <textarea defaultValue={String(row.keterangan || "")} name="keterangan" placeholder="Keterangan..." />
                        <input defaultValue={String(row.link || "")} name="link" placeholder="https://..." />
                        <textarea defaultValue={String(row.cue_mc || "")} name="cue_mc" placeholder="Teks MC..." />
                        <button aria-label="Simpan row" className={styles.secondaryButton}><i className="ti ti-device-floppy" /></button>
                      </form>
                    </td>
                    <td>
                      <div className={styles.orderButtons}>
                        <button aria-label="Naikkan" disabled={index === 0} type="button" onClick={() => move(row, eventRows[index - 1])}><i className="ti ti-chevron-up" /></button>
                        <button aria-label="Turunkan" disabled={index === eventRows.length - 1} type="button" onClick={() => move(row, eventRows[index + 1])}><i className="ti ti-chevron-down" /></button>
                      </div>
                    </td>
                    <td>
                      <button aria-label="Hapus row" className={styles.dangerButton} type="button" onClick={() => { if (window.confirm("Hapus row ini? Data rundown akan dihapus permanen.")) void deleteRundownRowAction(String(row.id)); }}><i className="ti ti-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className={styles.pagination}>
              <button disabled={page <= 0} type="button" onClick={() => setPage(Math.max(0, page - 1))}><i className="ti ti-chevron-left" /></button>
              <span>Page {page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} type="button" onClick={() => setPage(Math.min(totalPages - 1, page + 1))}><i className="ti ti-chevron-right" /></button>
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.emptyState}><i className="ti ti-list-details" /><strong>Belum ada rundown</strong><span>Klik &quot;+ Tambah&quot; untuk mulai.</span></div>
      )}
    </section>
  );
}
