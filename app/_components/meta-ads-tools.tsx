"use client";

import { setMetaAdsDecisionAction, syncMetaAdsAction } from "@/app/actions/meta-ads-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { scoreAdsCandidate } from "@/lib/analytics/content";
import type { ApiRecord } from "@/lib/api/_crud";
import { cn } from "@/lib/utils";
import { useMemo, useState, useTransition } from "react";
import { FilterBar, StatCard, StatsGrid, filterFieldClass } from "./ui-kit";

function number(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function compact(value: unknown) { return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(number(value)); }
const SIGNAL_COLOR: Record<string, string> = { high: "var(--green)", med: "var(--amber)", low: "var(--red)" };
const SIGNAL_LABEL: Record<string, string> = { high: "Strong", med: "Medium", low: "Weak" };
const DECISION_COLOR: Record<string, string> = { Boost: "var(--green)", Skip: "var(--text-muted)", Pending: "var(--amber)" };
const DECISION_ICON: Record<string, string> = { Boost: "ti-rocket", Pending: "ti-clock", Skip: "ti-player-skip-forward" };

export function MetaAdsTools({ rows }: { rows: ApiRecord[] }) {
  const [funnel, setFunnel] = useState("");
  const [decision, setDecision] = useState("");
  const [signal, setSignal] = useState("");
  const [pending, startTransition] = useTransition();
  const candidates = useMemo(() => rows.map((row) => ({ row, derived: scoreAdsCandidate(row) })).filter((item) => (!funnel || (item.row.funnel || item.derived.funnel) === funnel) && (!decision || (item.row.ad_decision || "Pending") === decision) && (!signal || item.derived.boostSignal === signal)).sort((a, b) => b.derived.score - a.derived.score), [rows, funnel, decision, signal]);
  const counts = (value: string) => rows.filter((row) => (row.ad_decision || "Pending") === value).length;
  const funnelCount = (value: string) => rows.filter((row) => (row.funnel || scoreAdsCandidate(row).funnel) === value).length;

  function choose(id: string, value: "Boost" | "Pending" | "Skip") {
    startTransition(async () => { await setMetaAdsDecisionAction(id, value); });
  }

  return (
    <div className="grid gap-3.5">
      <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
        <StatCard label="Total candidates" value={rows.length} />
        <StatCard label="Boost" tone="var(--green)" value={counts("Boost")} />
        <StatCard label="Pending" tone="var(--amber)" value={counts("Pending")} />
        <StatCard label="Skip" value={counts("Skip")} />
        <StatCard label="TOFU / MOFU / BOFU" value={`${funnelCount("TOFU")} · ${funnelCount("MOFU")} · ${funnelCount("BOFU")}`} />
      </StatsGrid>
      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold">Kandidat Iklan &mdash; auto dari Content Evaluation</div>
            <div className="text-[11px] text-muted-foreground">Konten Reel/Carousel dengan skor evaluasi tinggi. Metrik live-sync dari Content Eval.</div>
          </div>
          <form action={syncMetaAdsAction}><Button disabled={pending} size="sm" type="submit" variant="outline"><i className="ti ti-refresh" /> Sync evaluations</Button></form>
        </div>
        <FilterBar className="mb-0">
          <select className={filterFieldClass} onChange={(event) => setFunnel(event.target.value)} value={funnel}><option value="">All funnels</option><option>TOFU</option><option>MOFU</option><option>BOFU</option></select>
          <select className={filterFieldClass} onChange={(event) => setDecision(event.target.value)} value={decision}><option value="">All decisions</option><option>Boost</option><option>Pending</option><option>Skip</option></select>
          <select className={filterFieldClass} onChange={(event) => setSignal(event.target.value)} value={signal}><option value="">All signals</option><option value="high">Strong</option><option value="med">Medium</option><option value="low">Weak</option></select>
        </FilterBar>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {candidates.map(({ row, derived }) => {
            const current = String(row.ad_decision || "Pending");
            const resolvedFunnel = String(row.funnel || derived.funnel);
            const objective = String(row.objective || derived.objective);
            return (
              <div className="rounded-lg border border-border bg-white p-3" key={String(row.id)} style={{ borderLeft: `3px solid ${DECISION_COLOR[current] || "var(--text-hint)"}` }}>
                <div className="mb-2 flex items-start justify-between gap-1.5">
                  <strong className="line-clamp-2 flex-1 text-[12px] font-semibold">{String(row.judul || "Untitled")}</strong>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{String(row.format || "Carousel")}</span>
                </div>
                <div className="mb-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-md bg-[var(--bg)] p-1.5"><div className="text-[12px] font-bold">{compact(row.reach)}</div><div className="text-[9px] text-muted-foreground">REACH</div></div>
                  <div className="rounded-md bg-[var(--bg)] p-1.5"><div className="text-[12px] font-bold">{compact(row.views || row.impressions)}</div><div className="text-[9px] text-muted-foreground">VIEWS</div></div>
                  <div className="rounded-md bg-[var(--bg)] p-1.5"><div className="text-[12px] font-bold">{compact(row.saves)}</div><div className="text-[9px] text-muted-foreground">SAVES</div></div>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: resolvedFunnel === "TOFU" ? "#dbeafe" : resolvedFunnel === "MOFU" ? "var(--amber-bg)" : "var(--green-bg)", color: resolvedFunnel === "TOFU" ? "#1d4ed8" : resolvedFunnel === "MOFU" ? "var(--amber)" : "var(--green)" }}>{resolvedFunnel}</span>
                  <span className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-[10px] text-muted-foreground">{objective}</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: SIGNAL_COLOR[derived.boostSignal] }} />{SIGNAL_LABEL[derived.boostSignal]}</span>
                </div>
                <div className="flex gap-1.5 border-t border-border pt-2">
                  {(["Boost", "Pending", "Skip"] as const).map((value) => (
                    <button
                      className={cn("flex-1 rounded-md border px-1 py-1.5 text-center text-[10px] font-medium", current === value ? "font-semibold" : "border-border bg-white text-foreground")}
                      disabled={pending}
                      key={value}
                      onClick={() => choose(String(row.id), value)}
                      style={current === value ? { background: value === "Boost" ? "var(--green-bg)" : value === "Skip" ? "var(--bg)" : "var(--amber-bg)", color: DECISION_COLOR[value], borderColor: DECISION_COLOR[value] } : undefined}
                      type="button"
                    >
                      <i className={`ti ${DECISION_ICON[value]}`} /> {value}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {!candidates.length ? <div className="grid place-items-center gap-1 py-10 text-center text-muted-foreground"><i className="ti ti-ad text-2xl" /><strong className="text-foreground">No matching candidates</strong><span className="text-xs">Synchronize Content Evaluation or change the filters.</span></div> : null}
      </Card>
    </div>
  );
}
