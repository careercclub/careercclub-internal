"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import { useState } from "react";
import styles from "../record-manager.module.css";

export function ContentPlanningTools({ dates, stories, carousels, kols, mtStories }: { dates: ApiRecord[]; stories: ApiRecord[]; carousels: ApiRecord[]; kols: ApiRecord[]; mtStories: ApiRecord[] }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const dateRows = dates.filter((row) => !month || String(row.tanggal || "").startsWith(month));
  const carouselRows = carousels.filter((row) => !month || String(row.tanggal_posting || "").startsWith(month));
  const calendarDates = [...new Set([...dateRows.map((row) => String(row.tanggal || "")), ...carouselRows.map((row) => String(row.tanggal_posting || ""))])].filter(Boolean).sort();
  return <div className={styles.toolStack}><div className={styles.metricStrip}><div><strong>{dates.length}</strong><span>story dates</span></div><div><strong>{stories.length}</strong><span>story slides</span></div><div><strong>{carousels.length}</strong><span>carousels</span></div><div><strong>{kols.length}</strong><span>KOL profiles</span></div><div><strong>{mtStories.filter((row) => !row.is_posted).length}</strong><span>MT stories pending</span></div></div><div className={styles.filterBar}><input aria-label="Planning month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div><div className={styles.planningCalendar}>{calendarDates.map((date) => { const dayStories = dateRows.filter((row) => String(row.tanggal) === date); const dayCarousels = carouselRows.filter((row) => String(row.tanggal_posting) === date); const storyIds = new Set(dayStories.map((row) => String(row.id))); return <section key={date}><header><strong>{date}</strong><span>{stories.filter((row) => storyIds.has(String(row.date_id))).length + dayCarousels.length} item(s)</span></header>{dayStories.map((row) => <div key={String(row.id)}><i className="ti ti-circle" /><span>Story plan</span><small>{String(row.status || "Draft")}</small></div>)}{dayCarousels.map((row) => <div key={String(row.id)}><i className="ti ti-layout-grid" /><span>{String(row.judul || row.topik || "Carousel")}</span><small>{String(row.status || "Draft")}</small></div>)}</section>; })}</div></div>;
}
