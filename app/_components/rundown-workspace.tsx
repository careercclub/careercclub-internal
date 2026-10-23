"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useState } from "react";
import { EventRundown, rundownFor, runningTimes } from "./event-rundown";
import s from "./page-kit.module.css";
import { useRecordFocus } from "./use-record-focus";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateLabel(value: unknown) { const key = String(value || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return ""; const [y, m, d] = key.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; }

export function RundownWorkspace({ events, rows }: { events: ApiRecord[]; rows: ApiRecord[] }) {
  const [eventId, setEventId] = useState(String(events[0]?.id || ""));
  useRecordFocus((id) => {
    const row = rows.find((item) => String(item.id) === id);
    if (row && String(row.event_id) !== eventId) setEventId(String(row.event_id));
  });
  const selected = events.find((event) => String(event.id) === eventId);
  const startTime = String(selected?.waktu || "").slice(0, 5);
  const eventRows = useMemo(() => rundownFor(rows, eventId), [rows, eventId]);
  const finish = runningTimes(eventRows, startTime).next;
  const total = eventRows.reduce((sum, row) => sum + Number(row.durasi || 0), 0);

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Program</span>
          <h1>Event rundown</h1>
          <p>Running order with clock times worked out from the event start, notes, links and MC cues.</p>
        </div>
        {events.length ? (
          <label className={s.filterPill}><span>Event</span>
            <select aria-label="Event" onChange={(event) => setEventId(event.target.value)} value={eventId}>
              {events.map((event) => <option key={String(event.id)} value={String(event.id)}>{String(event.nama || "Untitled")}{dateLabel(event.tanggal) ? ` · ${dateLabel(event.tanggal)}` : ""}</option>)}
            </select>
          </label>
        ) : null}
      </header>
      {selected ? (
        <>
          <div className={s.stats}>
            <div className={s.stat}><span>Starts</span><b>{startTime || "—"}</b><small>{dateLabel(selected.tanggal) || "No date"}</small></div>
            <div className={s.stat}><span>Ends</span><b>{startTime ? finish : "—"}</b><small>Estimated</small></div>
            <div className={s.stat}><span>Duration</span><b>{total} min</b><small>{eventRows.length} item{eventRows.length === 1 ? "" : "s"}</small></div>
            <div className={s.stat}><span>Status</span><b style={{ fontSize: 18 }}>{String(selected.status || "Planning")}</b></div>
          </div>
          <div className={s.card}><EventRundown eventId={eventId} rows={rows} startTime={startTime} title={String(selected.nama || "Event")} /></div>
        </>
      ) : <div className={s.card}><p className={s.empty}>No events yet. Create an event in Program first.</p></div>}
    </div>
  );
}
