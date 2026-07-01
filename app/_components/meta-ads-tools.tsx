"use client";

import { setMetaAdsDecisionAction, syncMetaAdsAction } from "@/app/actions/meta-ads-actions";
import { scoreAdsCandidate } from "@/lib/analytics/content";
import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useState, useTransition } from "react";
import styles from "../record-manager.module.css";

function number(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function compact(value: unknown) { return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(number(value)); }

export function MetaAdsTools({ rows }: { rows: ApiRecord[] }) {
  const [funnel, setFunnel] = useState("");
  const [decision, setDecision] = useState("");
  const [signal, setSignal] = useState("");
  const [pending, startTransition] = useTransition();
  const candidates = useMemo(() => rows.map((row) => ({ row, derived: scoreAdsCandidate(row) })).filter((item) => (!funnel || (item.row.funnel || item.derived.funnel) === funnel) && (!decision || (item.row.ad_decision || "Pending") === decision) && (!signal || item.derived.boostSignal === signal)).sort((a,b) => b.derived.score - a.derived.score), [rows, funnel, decision, signal]);
  const counts = (value: string) => rows.filter((row) => (row.ad_decision || "Pending") === value).length;
  const funnelCount = (value: string) => rows.filter((row) => (row.funnel || scoreAdsCandidate(row).funnel) === value).length;

  function choose(id: string, value: "Boost" | "Pending" | "Skip") {
    startTransition(async () => { await setMetaAdsDecisionAction(id, value); });
  }

  return <div className={styles.adsWorkspace}>
    <div className={styles.workspaceHeader}><div><p>Paid media</p><h1>Meta Ads candidates</h1><span>Reel and Carousel evaluations scoring at least 70 are synchronized here. Organic metrics refresh while campaign decisions remain preserved.</span></div><form action={syncMetaAdsAction}><button className={styles.secondaryButton} disabled={pending} type="submit"><i className="ti ti-refresh" /> Sync evaluations</button></form></div>
    <div className={styles.metricStrip}><div><strong>{rows.length}</strong><span>Total candidates</span></div><div><strong>{counts("Boost")}</strong><span>Boost</span></div><div><strong>{counts("Pending")}</strong><span>Pending</span></div><div><strong>{counts("Skip")}</strong><span>Skip</span></div><div><strong>{funnelCount("TOFU")} / {funnelCount("MOFU")} / {funnelCount("BOFU")}</strong><span>TOFU / MOFU / BOFU</span></div></div>
    <div className={styles.filterBar}><select value={funnel} onChange={(event) => setFunnel(event.target.value)}><option value="">All funnels</option><option>TOFU</option><option>MOFU</option><option>BOFU</option></select><select value={decision} onChange={(event) => setDecision(event.target.value)}><option value="">All decisions</option><option>Boost</option><option>Pending</option><option>Skip</option></select><select value={signal} onChange={(event) => setSignal(event.target.value)}><option value="">All signals</option><option value="high">Strong</option><option value="med">Medium</option><option value="low">Weak</option></select></div>
    <div className={styles.adsGrid}>{candidates.map(({ row, derived }) => { const current = String(row.ad_decision || "Pending"); const resolvedFunnel = String(row.funnel || derived.funnel); const objective = String(row.objective || derived.objective); return <article data-decision={current.toLowerCase()} key={String(row.id)}><header><div><strong>{String(row.judul || "Untitled")}</strong><span>{String(row.format || "Carousel")} - {String(row.tanggal || "").slice(0,10)}</span></div><span className={`${styles.signalBadge} ${styles[`signal_${derived.boostSignal}`]}`}>{derived.boostSignal === "high" ? "Strong" : derived.boostSignal === "med" ? "Medium" : "Weak"} {derived.score}/10</span></header><div className={styles.adsMetrics}><div><strong>{compact(row.reach)}</strong><span>Reach</span></div><div><strong>{compact(row.views || row.impressions)}</strong><span>Views</span></div><div><strong>{compact(row.saves)}</strong><span>Saves</span></div></div><div className={styles.adsTags}><span data-funnel={resolvedFunnel.toLowerCase()}>{resolvedFunnel}</span><span>{objective}</span></div><footer>{(["Boost","Pending","Skip"] as const).map((value) => <button className={current === value ? styles.adsDecisionActive : undefined} disabled={pending} key={value} onClick={() => choose(String(row.id), value)}><i className={`ti ti-${value === "Boost" ? "rocket" : value === "Pending" ? "clock" : "player-skip-forward"}`} /> {value}</button>)}</footer></article>; })}</div>
    {!candidates.length ? <div className={styles.emptyState}><i className="ti ti-ad" /><strong>No matching candidates</strong><span>Synchronize Content Evaluation or change the filters.</span></div> : null}
  </div>;
}
