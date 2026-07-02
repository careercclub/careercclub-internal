"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { DistributionChart } from "./charts";
import { StorageImage } from "./storage-image";
import { FilterBar, Pill, StatCard, StatsGrid, filterFieldClass } from "./ui-kit";

type Workspace = { profiles: ApiRecord[]; snapshots: ApiRecord[]; flags: ApiRecord[]; products: ApiRecord[]; prices: ApiRecord[] };
function list(value: unknown) { if (Array.isArray(value)) return value.map(String); if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : value.split("|").map((item) => item.trim()).filter(Boolean); } catch { return value.split("|").map((item) => item.trim()).filter(Boolean); } } return []; }
function objectEntries(value: unknown) { if (value && typeof value === "object" && !Array.isArray(value)) return Object.entries(value as Record<string, unknown>); if (typeof value === "string") { try { return Object.entries(JSON.parse(value) as Record<string, unknown>); } catch { return []; } } return []; }
const THREAT_TONE: Record<string, "red" | "amber" | "green"> = { high: "red", medium: "amber", low: "green" };

export function CompetitorTools({ workspace, manage }: { workspace: Workspace; manage: ReactNode }) {
  const [tab, setTab] = useState<"overview" | "profiles" | "manage">("overview"); const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [threat, setThreat] = useState(""); const [platform, setPlatform] = useState(""); const [selectedId, setSelectedId] = useState("");
  const categories = [...new Set(workspace.profiles.map((row) => String(row.category || "")).filter(Boolean))].sort(); const platforms = [...new Set(workspace.profiles.flatMap((row) => list(row.platforms)))].sort();
  const profiles = useMemo(() => workspace.profiles.filter((profile) => (!query || `${profile.name} ${profile.category} ${profile.niche} ${profile.target_audience}`.toLowerCase().includes(query.toLowerCase())) && (!category || profile.category === category) && (!threat || profile.threat_level === threat) && (!platform || list(profile.platforms).includes(platform))).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))), [workspace.profiles, query, category, threat, platform]);
  const selected = workspace.profiles.find((profile) => String(profile.id) === selectedId);
  const snapshotDay = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === "string" ? value.slice(0, 10) : "";
  const latestSnapshots = workspace.snapshots.filter((snapshot) => !workspace.snapshots.some((other) => other.competitor_id === snapshot.competitor_id && snapshotDay(other.snapshot_date) > snapshotDay(snapshot.snapshot_date))); const threatCounts = ["high", "medium", "low"].map((level) => [level, workspace.profiles.filter((row) => row.threat_level === level).length] as const);

  return (
    <div className="grid gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <Tabs onValueChange={(value) => setTab(value as typeof tab)} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="overview"><i className="ti ti-layout-dashboard" /> Overview</TabsTrigger>
            <TabsTrigger value="profiles"><i className="ti ti-building-store" /> Kompetitor</TabsTrigger>
            <TabsTrigger value="manage">Manage data</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button asChild size="sm" variant="outline"><Link href="/competitor-intel/products"><i className="ti ti-tag" /> Produk &amp; Pricing</Link></Button>
      </div>
      {tab === "overview" ? (
        <>
          <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
            <StatCard label="Competitors" value={workspace.profiles.length} />
            <StatCard label="Products" value={workspace.products.length} />
            <StatCard label="High threat" tone="var(--red)" value={threatCounts[0][1]} />
            <StatCard label="Active ads" value={latestSnapshots.filter((row) => row.ads_active).length} />
            <StatCard label="Intelligence flags" value={workspace.flags.length} />
          </StatsGrid>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="gap-2 p-4">
              <h3 className="text-xs font-bold">Threat distribution</h3>
              <DistributionChart rows={threatCounts.map(([level, count]) => [level.charAt(0).toUpperCase() + level.slice(1), count])} />
            </Card>
            <Card className="gap-2 p-4">
              <h3 className="text-xs font-bold">Competitor product coverage</h3>
              <DistributionChart rows={workspace.profiles.map((profile) => [String(profile.name), workspace.products.filter((product) => String(product.competitor_id) === String(profile.id)).length] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 10)} />
            </Card>
          </div>
          <Card className="gap-2 p-4">
            <h3 className="text-xs font-bold">High threat competitors</h3>
            {workspace.profiles.filter((row) => row.threat_level === "high").map((row) => (
              <button className="flex items-center gap-2 border-t border-border py-2 text-left text-[12px] first:border-0" key={String(row.id)} onClick={() => { setSelectedId(String(row.id)); setTab("profiles"); }} type="button">
                <div className="min-w-0 flex-1"><strong className="block truncate">{String(row.name)}</strong><span className="text-[11px] text-muted-foreground">{workspace.flags.filter((flag) => String(flag.competitor_id) === String(row.id)).length} flags &middot; {workspace.products.filter((product) => String(product.competitor_id) === String(row.id)).length} products</span></div>
                <i className="ti ti-chevron-right shrink-0 text-muted-foreground" />
              </button>
            ))}
          </Card>
        </>
      ) : null}
      {tab === "profiles" ? (
        <>
          <FilterBar>
            <input className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Search competitors" value={query} />
            <select className={filterFieldClass} onChange={(event) => setCategory(event.target.value)} value={category}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
            <select className={filterFieldClass} onChange={(event) => setThreat(event.target.value)} value={threat}><option value="">All threat levels</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
            <select className={filterFieldClass} onChange={(event) => setPlatform(event.target.value)} value={platform}><option value="">All platforms</option>{platforms.map((value) => <option key={value}>{value}</option>)}</select>
          </FilterBar>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => {
              const id = String(profile.id);
              const products = workspace.products.filter((product) => String(product.competitor_id) === id);
              const flags = workspace.flags.filter((flag) => String(flag.competitor_id) === id);
              return (
                <button className="rounded-lg border border-border bg-white p-3.5 text-left" key={id} onClick={() => setSelectedId(id)} type="button">
                  <div className="mb-2 flex items-center gap-2.5">
                    {profile.logo_url ? <StorageImage label={String(profile.name || "Competitor")} objectKey={String(profile.logo_url)} /> : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--purple-light)] text-[var(--purple-mid)]"><i className="ti ti-building" /></div>}
                    <div className="min-w-0"><strong className="block truncate text-[13px] font-bold">{String(profile.name || "Untitled")}</strong><Pill tone={THREAT_TONE[String(profile.threat_level || "")] || "gray"}>{String(profile.threat_level || "unrated")}</Pill></div>
                  </div>
                  <p className="mb-2 text-[11px] text-muted-foreground">{String(profile.niche || "No niche")}</p>
                  <div className="mb-2 flex flex-wrap gap-1">{list(profile.platforms).map((value) => <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground" key={value}>{value}</span>)}</div>
                  <div className="flex justify-between text-[10px] text-muted-foreground"><span>{products.length} products</span><span>{flags.length} flags</span></div>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
      {tab === "manage" ? manage : null}
      {selected ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-5" onMouseDown={() => setSelectedId("")}>
          <Card className="w-full max-w-2xl gap-3 p-4.5" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div><span className="text-[10px] text-muted-foreground">{String(selected.category || "Competitor")}</span><h2 className="text-lg font-bold">{String(selected.name || "Untitled")}</h2><p className="text-[11px] text-muted-foreground">{String(selected.niche || "")}</p></div>
              <button onClick={() => setSelectedId("")} type="button"><i className="ti ti-x" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <div className="rounded-lg bg-[var(--bg)] p-2"><span className="block text-[9px] text-muted-foreground uppercase">Threat</span><strong className="text-[11px]">{String(selected.threat_level || "-")}</strong></div>
              <div className="rounded-lg bg-[var(--bg)] p-2"><span className="block text-[9px] text-muted-foreground uppercase">Primary URL</span><strong className="text-[11px] break-all">{String(selected.primary_url || "-")}</strong></div>
              <div className="rounded-lg bg-[var(--bg)] p-2"><span className="block text-[9px] text-muted-foreground uppercase">Products</span><strong className="text-[11px]">{workspace.products.filter((row) => String(row.competitor_id) === String(selected.id)).length}</strong></div>
              <div className="rounded-lg bg-[var(--bg)] p-2"><span className="block text-[9px] text-muted-foreground uppercase">Platforms</span><strong className="text-[11px]">{list(selected.platforms).join(", ") || "-"}</strong></div>
              <div className="rounded-lg bg-[var(--bg)] p-2"><span className="block text-[9px] text-muted-foreground uppercase">Target audience</span><strong className="text-[11px]">{String(selected.target_audience || "-")}</strong></div>
              <div className="rounded-lg bg-[var(--bg)] p-2"><span className="block text-[9px] text-muted-foreground uppercase">Followers</span><strong className="text-[11px]">{objectEntries(selected.followers).map(([key, value]) => `${key}: ${value}`).join(" · ") || "-"}</strong></div>
            </div>
            <div><h3 className="mb-1 text-xs font-bold">Notes</h3><p className="text-[12px] text-muted-foreground">{String(selected.notes || "No notes")}</p></div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
