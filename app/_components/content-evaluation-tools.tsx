"use client";

import { scoreContentEvaluation } from "@/lib/analytics/content";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "../record-manager.module.css";

function day(value: unknown) { return typeof value === "string" ? value.slice(0, 10) : ""; }

export function ContentEvaluationTools({ evaluations, buyers }: { evaluations: ApiRecord[]; buyers: ApiRecord[] }) {
  const router = useRouter();
  const [sort, setSort] = useState("score");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const scored = useMemo(() => evaluations.map((row) => ({ row, score: scoreContentEvaluation(row) })).sort((a, b) => sort === "date" ? day(b.row.tanggal).localeCompare(day(a.row.tanggal)) : b.score - a.score), [evaluations, sort]);
  const average = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.score, 0) / scored.length) : 0;
  const daily = useMemo(() => { const dates = new Set([...evaluations.map((row) => day(row.tanggal)), ...buyers.map((row) => day(row.tanggal))].filter(Boolean)); return [...dates].sort().reverse().map((date) => ({ date, posts: evaluations.filter((row) => day(row.tanggal) === date), buyers: buyers.filter((row) => day(row.tanggal) === date) })); }, [evaluations, buyers]);

  async function importMeta(formData: FormData) {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/content-evaluation/import", { method: "POST", body: formData }); const result = await response.json() as { inserted?: number; updated?: number; error?: string }; if (!response.ok) throw new Error(result.error || "Import failed."); setMessage(`Imported ${result.inserted || 0} new post(s); updated ${result.updated || 0}.`); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); } finally { setBusy(false); }
  }

  return <div className={styles.toolStack}><div className={styles.metricStrip}><div><strong>{evaluations.length}</strong><span>posts reviewed</span></div><div><strong>{average}</strong><span>average score</span></div><div><strong>{scored.filter((item) => item.score >= 70).length}</strong><span>ads eligible</span></div><div><strong>{daily.filter((item) => item.posts.length && item.buyers.length).length}</strong><span>post + buyer days</span></div></div><div className={styles.filterBar}><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="score">Highest score</option><option value="date">Newest date</option></select></div><details className={styles.createPanel}><summary><i className="ti ti-file-import" /> Import Meta Business Suite CSV/XLSX</summary><form action={importMeta} className={styles.toolForm}><input accept=".csv,.xlsx" name="file" type="file" required /><button className={styles.primaryButton} disabled={busy}>Import</button></form></details>{message ? <p className={styles.formMessage}>{message}</p> : null}<div className={styles.summaryGrid}>{scored.slice(0, 9).map(({ row, score }) => <article key={String(row.id)}><header><strong>{String(row.judul || "Untitled")}</strong><span>{score}/100</span></header><p>{String(row.format || "Unknown")} - {day(row.tanggal) || "No date"}</p><footer><span>{Number(row.reach || 0).toLocaleString()} reach</span><span>{Number(row.saves || 0).toLocaleString()} saves</span><span>{Number(row.follows || 0).toLocaleString()} follows</span></footer></article>)}</div><details className={styles.createPanel}><summary><i className="ti ti-calendar-stats" /> Posting versus buyer timeline</summary><div className={styles.timelineList}>{daily.map((item) => <div key={item.date}><strong>{item.date}</strong><span>{item.posts.length} post(s)</span><span>{item.buyers.length} buyer transaction(s)</span></div>)}</div></details></div>;
}
