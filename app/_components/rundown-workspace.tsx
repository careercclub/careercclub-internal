"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useState } from "react";
import { EventRundown, rundownFor, runningTimes } from "./event-rundown";
import styles from "../record-manager.module.css";

export function RundownWorkspace({ events, rows }: { events: ApiRecord[]; rows: ApiRecord[] }) {
  const [eventId, setEventId] = useState(String(events[0]?.id || ""));
  const selected = events.find((event) => String(event.id) === eventId);
  const startTime = String(selected?.waktu || "").slice(0, 5);
  const eventRows = useMemo(() => rundownFor(rows, eventId), [rows, eventId]);
  const finish = runningTimes(eventRows, startTime).next;

  return (
    <div className={styles.rundownWorkspace}>
      <div className={styles.workspaceHeader}>
        <div>
          <p>Program</p>
          <h1>Event rundown</h1>
          <span>Calculated running time, activity notes, live links, MC cues, and execution order.</span>
        </div>
        <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
          {events.map((event) => <option key={String(event.id)} value={String(event.id)}>{String(event.nama || "Untitled")} - {String(event.tanggal || "")}</option>)}
        </select>
      </div>
      {selected ? (
        <>
          <div className={styles.metricStrip}>
            <div><strong>{startTime || "-"}</strong><span>Start time</span></div>
            <div><strong>{eventRows.reduce((sum, row) => sum + Number(row.durasi || 0), 0)} min</strong><span>Total duration</span></div>
            <div><strong>{finish || "-"}</strong><span>Estimated finish</span></div>
            <div><strong>{eventRows.length}</strong><span>Activities</span></div>
            <div><strong>{String(selected.status || "Planning")}</strong><span>Event status</span></div>
          </div>
          <EventRundown eventId={eventId} rows={rows} startTime={startTime} title={String(selected.nama || "Event")} />
        </>
      ) : (
        <div className={styles.emptyState}><i className="ti ti-calendar-off" /><strong>No event selected</strong></div>
      )}
    </div>
  );
}
