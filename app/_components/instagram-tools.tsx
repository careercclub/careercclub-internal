"use client";

import { saveInstagramBaselineAction } from "@/app/actions/instagram-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { FollowersChart, MetricsChart } from "./charts";
import { StatCard, StatsGrid } from "./ui-kit";

type Tab = "dashboard" | "upload" | "target";
type ComputedSnapshot = ApiRecord & { computedFollowers: number };
function numeric(value: unknown) { const result = Number(value || 0); return Number.isFinite(result) ? result : 0; }
function compact(value: unknown) { return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(numeric(value)); }
function day(value: unknown) { if (value instanceof Date) return value.toISOString().slice(0, 10); return typeof value === "string" ? value.slice(0, 10) : ""; }

function computeFollowers(snapshots: ApiRecord[], baseline: ApiRecord | null): ComputedSnapshot[] {
  const sorted = [...snapshots].sort((a, b) => day(a.week_start).localeCompare(day(b.week_start))).map((row) => ({ ...row, computedFollowers: numeric(row.followers_total) } as ComputedSnapshot));
  if (!sorted.length) return sorted;
  // The stored followers_total values are accumulated gross follows — Instagram's
  // "Follows" counts new follows but not unfollows, so they drift above reality (17.8k
  // against a real 14.8k). The manually entered baseline is the one number a human has
  // verified against the account, so it anchors the whole series and every other week
  // is derived from it. That keeps the KPI, the chart and the history table on one
  // number instead of mixing a verified total with drifted ones.
  const anchorDate = day(baseline?.baseline_date) || day(sorted.at(-1)?.week_start);
  const anchorValue = numeric(baseline?.followers_total) || numeric(sorted.at(-1)?.followers_total);
  let anchor = sorted.length - 1; let distance = Number.POSITIVE_INFINITY;
  sorted.forEach((row, index) => { const diff = Math.abs(new Date(day(row.week_start)).getTime() - new Date(anchorDate).getTime()); if (diff < distance) { distance = diff; anchor = index; } });
  sorted[anchor].computedFollowers = anchorValue;
  for (let index = anchor + 1; index < sorted.length; index += 1) {
    sorted[index].computedFollowers = sorted[index - 1].computedFollowers + numeric(sorted[index].follows_gained);
  }
  for (let index = anchor - 1; index >= 0; index -= 1) {
    // Subtract the *later* week's gain: week[i+1] = week[i] + gained[i+1]. The original
    // subtracted gained[i], which shifted every week before the anchor by one week's growth.
    sorted[index].computedFollowers = Math.max(0, sorted[index + 1].computedFollowers - numeric(sorted[index + 1].follows_gained));
  }
  return sorted;
}

export function InstagramTools({ snapshots, targets, baseline, referenceDate, snapshotManagement, targetManagement }: { snapshots: ApiRecord[]; targets: ApiRecord[]; baseline: ApiRecord | null; referenceDate: string; snapshotManagement: ReactNode; targetManagement: ReactNode }) {
  const router = useRouter(); const [tab, setTab] = useState<Tab>("dashboard"); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [page, setPage] = useState(0);
  const analytics = useMemo(() => {
    const now = new Date(referenceDate); const sorted = computeFollowers(snapshots, baseline); const latest = sorted.at(-1); const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30); const recent = sorted.filter((row) => day(row.week_start) >= cutoff.toISOString().slice(0, 10)); const reach30 = recent.reduce((sum, row) => sum + numeric(row.reach), 0); const interactions30 = recent.reduce((sum, row) => sum + numeric(row.interactions), 0); const follows30 = recent.reduce((sum, row) => sum + numeric(row.follows_gained), 0); const avgPerDay = [...sorted].reverse().slice(0, 4).reduce((sum, row) => sum + numeric(row.follows_gained), 0) / Math.max(1, Math.min(4, sorted.length) * 7); const baselineDate = new Date(`${day(baseline?.baseline_date) || referenceDate.slice(0, 10)}T00:00:00`); const end = new Date(baselineDate.getFullYear(), 11, 31); const predicted = Math.round(numeric(baseline?.followers_total) + avgPerDay * Math.max(0, (end.getTime() - baselineDate.getTime()) / 86400000)); const currentTarget = targets.find((item) => numeric(item.year) === now.getFullYear()) || null;
    const monthly = new Map<string, { followers: number; reach: number; interactions: number }>(); sorted.forEach((row) => { const key = day(row.week_start).slice(0, 7); if (!key) return; const item = monthly.get(key) || { followers: 0, reach: 0, interactions: 0 }; item.followers = row.computedFollowers; item.reach += numeric(row.reach); item.interactions += numeric(row.interactions); monthly.set(key, item); });
    return { sorted, latest, reach30, interactions30, follows30, er30: reach30 ? interactions30 / reach30 * 100 : 0, avgPerDay, predicted, currentTarget, monthly: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)) };
  }, [snapshots, targets, baseline, referenceDate]);
  const history = [...analytics.sorted].reverse(); const pages = Math.max(1, Math.ceil(history.length / 5)); const pageRows = history.slice(Math.min(page, pages - 1) * 5, Math.min(page, pages - 1) * 5 + 5);
  const weekly = [...analytics.sorted].reverse().slice(0, 8).reverse().map((row) => ({ label: day(row.week_start).slice(5), values: [numeric(row.follows_gained) / 7] }));
  const metricMonths = analytics.monthly.slice(-12);
  const metricRows = metricMonths.map(([label, value]) => ({ label: label.slice(2), values: [value.reach, value.interactions] }));

  // Extend the followers series with the current year's remaining months so the
  // dashed prediction line can project forward, matching the legacy `igChartFollowers` combo chart.
  const followersChart = useMemo(() => {
    const monthMap = new Map(analytics.monthly);
    const baselineDate = new Date(`${day(baseline?.baseline_date) || referenceDate.slice(0, 10)}T00:00:00Z`);
    const baselineFollowers = numeric(baseline?.followers_total);
    const currentYear = new Date(referenceDate).getFullYear();
    const actualKeys = analytics.monthly.map(([key]) => key);
    const lastActualKey = actualKeys.at(-1);
    const futureKeys: string[] = [];
    if (lastActualKey) {
      let [year, month] = lastActualKey.split("-").map(Number);
      while ((year < currentYear || (year === currentYear && month < 12)) && futureKeys.length < 12) {
        month += 1; if (month > 12) { month = 1; year += 1; }
        futureKeys.push(`${year}-${String(month).padStart(2, "0")}`);
      }
    }
    const keys = [...actualKeys.slice(-8), ...futureKeys].slice(-12);
    function predictedForKey(key: string) {
      const [year, month] = key.split("-").map(Number);
      const endOfMonth = new Date(Date.UTC(year, month, 0));
      const daysFromBaseline = Math.round((endOfMonth.getTime() - baselineDate.getTime()) / 86400000);
      return Math.round(baselineFollowers + analytics.avgPerDay * daysFromBaseline);
    }
    return {
      labels: keys.map((key) => key.slice(2)),
      actual: keys.map((key) => monthMap.get(key)?.followers ?? null),
      predicted: keys.map((key) => (key === lastActualKey || futureKeys.includes(key)) ? predictedForKey(key) : null),
    };
  }, [analytics.monthly, analytics.avgPerDay, baseline, referenceDate]);

  async function importSnapshots(formData: FormData) { setBusy(true); setMessage(""); try { const response = await fetch("/api/instagram/import", { method: "POST", body: formData }); const result = await response.json() as { imported?: number; files?: number; error?: string }; if (!response.ok) throw new Error(result.error || "Import failed."); setMessage(`Imported ${result.imported || 0} weekly snapshot(s) from ${result.files || 0} file(s).`); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); } finally { setBusy(false); } }
  const currentFollowers = numeric(baseline?.followers_total) || numeric(analytics.latest?.computedFollowers);
  // The KPI reads the manually verified baseline, so say when it was last set —
  // otherwise a stale baseline looks like a live number.
  const followersUpdatedAt = numeric(baseline?.followers_total)
    ? day(baseline?.baseline_date) || day(baseline?.updated_at)
    : day(analytics.latest?.week_start); const target = numeric(analytics.currentTarget?.target_followers); const progress = target ? Math.min(100, currentFollowers / target * 100) : 0;

  return (
    <div className="grid gap-3.5">
      <Tabs onValueChange={(value) => setTab(value as Tab)} value={tab}>
        <TabsList variant="line">
          <TabsTrigger value="dashboard"><i className="ti ti-layout-dashboard" /> Dashboard</TabsTrigger>
          <TabsTrigger value="upload"><i className="ti ti-upload" /> Upload CSV</TabsTrigger>
          <TabsTrigger value="target"><i className="ti ti-target" /> Target &amp; Baseline</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <div className="grid gap-3.5">
            <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
              <StatCard label={followersUpdatedAt ? `Followers · per ${followersUpdatedAt}` : "Followers"} value={currentFollowers.toLocaleString("id-ID")} />
              <StatCard label="Reach, 30 days" value={compact(analytics.reach30)} tone="#3b82f6" />
              <StatCard label="Interactions, 30 days" value={compact(analytics.interactions30)} tone="#ec4899" />
              <StatCard label="Average ER" value={`${analytics.er30.toFixed(2)}%`} tone="#0f6e56" />
              <StatCard label="Follows, 30 days" value={`+${analytics.follows30.toLocaleString("id-ID")}`} tone="#f59e0b" />
            </StatsGrid>
            <Card className="gap-2 p-4">
              <div className="flex items-center justify-between"><strong className="text-[13px] font-semibold">Target followers {new Date(referenceDate).getFullYear()}</strong><span className="text-[11px] text-muted-foreground">{target ? `${currentFollowers.toLocaleString("id-ID")} / ${target.toLocaleString("id-ID")} · projection ${analytics.predicted.toLocaleString("id-ID")}` : "No target configured"}</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg)]"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--purple-accent), #a78bfa)" }} /></div>
            </Card>
            <div className="grid gap-3 lg:grid-cols-3">
              <Card className="gap-2 p-4">
                <h3 className="text-[11px] font-bold">Followers &middot; actual vs prediksi</h3>
                <FollowersChart actual={followersChart.actual} labels={followersChart.labels} predicted={followersChart.predicted} target={target || null} />
              </Card>
              <Chart legends={["Follows/day"]} rows={weekly} title={`Average follows/day (${analytics.avgPerDay.toFixed(1)})`} />
              <Card className="gap-2 p-4">
                <h3 className="text-[11px] font-bold">Monthly reach and interactions</h3>
                <MetricsChart interactions={metricRows.map((row) => row.values[1])} labels={metricRows.map((row) => row.label)} reach={metricRows.map((row) => row.values[0])} />
              </Card>
            </div>
            <Card className="gap-3 p-0">
              <div className="flex items-center justify-between p-4 pb-0"><h2 className="text-sm font-bold">Snapshot history</h2><span className="text-[11px] text-muted-foreground">{history.length} weeks</span></div>
              <Table>
                <TableHeader><TableRow><TableHead>Week</TableHead><TableHead>Followers</TableHead><TableHead>+Follows</TableHead><TableHead>Reach</TableHead><TableHead>Interactions</TableHead><TableHead>ER</TableHead></TableRow></TableHeader>
                <TableBody>{pageRows.map((row) => <TableRow key={String(row.id)}><TableCell>{day(row.week_start)}</TableCell><TableCell>{row.computedFollowers.toLocaleString("id-ID")}</TableCell><TableCell>+{numeric(row.follows_gained).toLocaleString("id-ID")}</TableCell><TableCell>{numeric(row.reach).toLocaleString("id-ID")}</TableCell><TableCell>{numeric(row.interactions).toLocaleString("id-ID")}</TableCell><TableCell>{numeric(row.reach) ? (numeric(row.interactions) / numeric(row.reach) * 100).toFixed(2) : "0.00"}%</TableCell></TableRow>)}</TableBody>
              </Table>
              <div className="flex items-center justify-center gap-2 p-4 pt-0">
                <Button disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))} size="icon-sm" variant="outline"><i className="ti ti-chevron-left" /></Button>
                <span className="text-[11px] text-muted-foreground">Page {Math.min(page, pages - 1) + 1} / {pages}</span>
                <Button disabled={page >= pages - 1} onClick={() => setPage((value) => Math.min(pages - 1, value + 1))} size="icon-sm" variant="outline"><i className="ti ti-chevron-right" /></Button>
              </div>
            </Card>
            <details className="rounded-lg border border-border bg-white">
              <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-bold text-[var(--purple-dark)]"><i className="ti ti-settings" /> Manage snapshots</summary>
              <div className="p-3.5">{snapshotManagement}</div>
            </details>
          </div>
        </TabsContent>
        <TabsContent value="upload">
          <Card className="max-w-xl gap-3 p-5">
            <div><i className="ti ti-brand-meta text-xl text-[var(--purple-mid)]" /><h2 className="mt-1 text-sm font-bold">Import Meta Insights</h2><p className="mt-1 text-[12px] text-muted-foreground">Select one or more original Meta CSV exports (Views, Reach, Content interactions, Link clicks, Profile visits, and Follows) or a normalized CSV/XLSX. Daily exports are combined and aggregated into Monday-based weeks.</p></div>
            <form action={importSnapshots} className="grid gap-3">
              <label className="grid cursor-pointer place-items-center gap-1 rounded-lg border border-dashed border-border bg-[var(--bg)] p-8 text-center text-muted-foreground">
                <i className="ti ti-upload text-2xl text-[var(--purple-mid)]" /><strong className="text-foreground">Select CSV/XLSX files</strong><span className="text-xs">Multiple files supported</span>
                <input accept=".csv,.xlsx" className="hidden" multiple name="files" required type="file" />
              </label>
              <Button disabled={busy} type="submit">{busy ? "Importing..." : "Import weekly snapshots"}</Button>
            </form>
            {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}
          </Card>
        </TabsContent>
        <TabsContent value="target">
          <div className="grid gap-3.5">
            <Card className="gap-3 p-4">
              <div><h2 className="text-sm font-bold">Baseline followers</h2><p className="mt-1 text-[11px] text-muted-foreground">This anchor reconstructs total followers forward and backward from weekly follows gained.</p></div>
              <form action={saveInstagramBaselineAction} className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Total followers</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" defaultValue={currentFollowers || ""} min="1" name="followers_total" required type="number" /></label>
                <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>As of date</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" defaultValue={day(baseline?.baseline_date) || referenceDate.slice(0, 10)} name="baseline_date" required type="date" /></label>
                <Button className="w-max" size="sm" type="submit">Update baseline</Button>
              </form>
            </Card>
            <div><h2 className="mb-2 text-sm font-bold">Annual targets</h2>{targetManagement}</div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Chart({ title, rows, legends, target }: { title: string; rows: { label: string; values: number[] }[]; legends: string[]; target?: number }) {
  const maximum = Math.max(1, target || 0, ...rows.flatMap((row) => row.values));
  const seriesColor = (index: number) => index === 1 ? "#34a37b" : "var(--purple-accent)";
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[11px] font-bold">{title}</h3>
        <div className="flex flex-wrap gap-2">{legends.map((label, index) => <span className="flex items-center gap-1 text-[9px] text-muted-foreground" key={label}><i className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: seriesColor(index) }} />{label}</span>)}</div>
      </div>
      <div className="flex items-stretch gap-1.5 overflow-x-auto border-b border-border pt-2" style={{ height: 170 }}>
        {rows.length ? rows.map((row) => (
          <div className="grid min-w-[30px] flex-1 grid-rows-[minmax(0,1fr)_18px] gap-1" key={row.label}>
            <div className="flex min-h-0 items-end justify-center gap-0.5">{row.values.map((value, index) => <i key={index} style={{ height: `${Math.max(3, value / maximum * 100)}%`, width: "min(16px, 45%)", borderRadius: "3px 3px 0 0", background: seriesColor(index), display: "block" }} title={`${legends[index]}: ${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}`} />)}</div>
            <span className="overflow-hidden text-center text-[7px] text-ellipsis whitespace-nowrap text-muted-foreground">{row.label}</span>
          </div>
        )) : <p className="text-[11px] text-muted-foreground">No snapshot data.</p>}
      </div>
      {target ? <small className="text-[10px] text-muted-foreground">Target reference: {target.toLocaleString("id-ID")}</small> : null}
    </Card>
  );
}
