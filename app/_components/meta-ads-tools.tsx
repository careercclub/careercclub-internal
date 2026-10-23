"use client";

import { guard, submitTo } from "./safe-action";

import { setMetaAdsDecisionAction, syncMetaAdsAction } from "@/app/actions/meta-ads-actions";
import { scoreAdsCandidate } from "@/lib/analytics/content";
import type { ApiRecord } from "@/lib/api/_crud";
import { compact, decisionOf, DECISIONS, type Decision } from "@/lib/marketing/view";
import { useMemo, useState, useTransition } from "react";
import s from "./page-kit.module.css";
import { useRecordFocus } from "./use-record-focus";

// Meta Ads in the IJIS layout: ad candidates from Content Evaluation on a decision board
// (Pending / Boost / Skip). Moving a card is the same "decision" action as before.

const SIGNAL_LABEL: Record<string, string> = { high: "Strong signal", med: "Medium signal", low: "Weak signal" };
const SIGNAL_LEVEL: Record<string, number> = { high: 3, med: 2, low: 1 };
const DECISION_META: Record<Decision, { icon: string; title: string }> = { Pending: { icon: "ti-clock", title: "To decide" }, Boost: { icon: "ti-rocket", title: "Boost" }, Skip: { icon: "ti-player-skip-forward", title: "Skip" } };

export function MetaAdsTools({ rows }: { rows: ApiRecord[] }) {
  const [funnel, setFunnel] = useState("");
  const [signal, setSignal] = useState("");
  const [pending, startTransition] = useTransition();
  useRecordFocus((id) => { if (rows.some((row) => String(row.id) === id)) { setFunnel(""); setSignal(""); } });
  const scored = useMemo(() => rows.map((row) => ({ row, derived: scoreAdsCandidate(row) })), [rows]);
  const funnelOf = (item: (typeof scored)[number]) => String(item.row.funnel || item.derived.funnel);
  const shown = scored.filter((item) => (!funnel || funnelOf(item) === funnel) && (!signal || item.derived.boostSignal === signal)).sort((a, b) => b.derived.score - a.derived.score);
  const count = (d: Decision) => rows.filter((row) => decisionOf(row) === d).length;
  const choose = (id: string, value: Decision) => startTransition(() => guard(async () => { await setMetaAdsDecisionAction(id, value); }, "Could not save the decision."));

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Marketing</span>
          <h1>Meta Ads</h1>
          <p>{rows.length} candidates from Content Evaluation · {count("Boost")} to boost · {count("Pending")} still to decide</p>
        </div>
        <form onSubmit={submitTo(syncMetaAdsAction, { success: "Candidates synced from Content Evaluation.", failure: "Could not sync the evaluations." })}><button className={s.ghost} disabled={pending} type="submit"><i className="ti ti-refresh" aria-hidden="true" /> Sync evaluations</button></form>
      </header>

      <div className={s.toolbar}>
        <div className={s.pills} role="group" aria-label="Funnel">
          {[["", "All funnels", rows.length] as const, ...(["TOFU", "MOFU", "BOFU"] as const).map((f) => [f, f, scored.filter((item) => funnelOf(item) === f).length] as const)].map(([value, label, n]) => (
            <button aria-pressed={funnel === value} className={funnel === value ? s.pillOn : s.pill} key={label} onClick={() => setFunnel(value)} type="button">{label} <span>{n}</span></button>
          ))}
        </div>
        <label className={s.filterPill}><span>Signal</span><select aria-label="Filter signal" onChange={(e) => setSignal(e.target.value)} value={signal}><option value="">All</option><option value="high">Strong</option><option value="med">Medium</option><option value="low">Weak</option></select></label>
      </div>

      {rows.length ? (
        <div className={s.board}>
          {DECISIONS.map((decision) => {
            const items = shown.filter((item) => decisionOf(item.row) === decision);
            return (
              <section aria-label={`${DECISION_META[decision].title}, ${items.length}`} className={s.column} key={decision}>
                <header className={s.columnHead}><i className={`ti ${DECISION_META[decision].icon}`} aria-hidden="true" /><b>{DECISION_META[decision].title}</b><span className={s.count}>{items.length}</span></header>
                {items.length ? (
                  <ul className={s.cards}>
                    {items.map(({ row, derived }) => {
                      const level = SIGNAL_LEVEL[derived.boostSignal] || 0;
                      return (
                        <li className={s.ad} data-record-id={String(row.id)} key={String(row.id)}>
                          <div className={s.adTop}><b>{String(row.judul || "Untitled")}</b><span className={s.chipMuted}>{String(row.format || "Carousel")}</span></div>
                          <div className={s.adMeta}>
                            <span className={s.chip}>{String(row.funnel || derived.funnel)}</span>
                            <span>{String(row.objective || derived.objective)}</span>
                            <span className={s.spacer} />
                            <span className={s.signal} title={`Score ${Math.round(derived.score)}`}><span className={s.bars} aria-hidden="true">{[1, 2, 3].map((n) => <i className={n <= level ? s.on : undefined} key={n} />)}</span>{SIGNAL_LABEL[derived.boostSignal]}</span>
                          </div>
                          <div className={s.metrics}>
                            <span><b>{compact(row.reach)}</b><small>Reach</small></span>
                            <span><b>{compact(row.views || row.impressions)}</b><small>Views</small></span>
                            <span><b>{compact(row.saves)}</b><small>Saves</small></span>
                          </div>
                          <div className={s.choice} role="group" aria-label={`Decision for ${String(row.judul || "this ad")}`}>
                            {DECISIONS.map((value) => <button aria-pressed={decision === value} className={value === "Boost" ? s.boost : undefined} disabled={pending} key={value} onClick={() => choose(String(row.id), value)} type="button"><i className={`ti ${DECISION_META[value].icon}`} aria-hidden="true" /> {value}</button>)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className={s.empty}>None</p>}
              </section>
            );
          })}
        </div>
      ) : <p className={s.empty}>No candidates yet. Sync evaluations to pull high-scoring Reels and Carousels from Content Evaluation.</p>}
    </div>
  );
}
