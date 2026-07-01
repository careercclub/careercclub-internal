"use client";

import { updatePainPointLabelsAction } from "@/app/actions/customer-knowledge-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { FilterBar, Pill, StatCard, StatsGrid, filterFieldClass } from "./ui-kit";

type Tab = "dashboard" | "database" | "manage";
const stopwords = new Set(["yang", "dan", "di", "ke", "dari", "itu", "ini", "gak", "ga", "gue", "aku", "kak", "dong", "sih", "ya", "aja", "bgt", "banget", "kali", "udah", "mau", "bisa", "ada", "untuk", "dengan", "juga", "lebih", "tapi", "kalau", "karena", "gimana", "setelah", "pas", "waktu", "deh", "loh", "nih"]);
const whitelist = new Set(["mt", "hr", "hrd", "cv", "fgd", "oa", "ip"]);
function labels(row: ApiRecord) { if (Array.isArray(row.labels)) return row.labels.map(String); if (typeof row.labels === "string") { try { const value = JSON.parse(row.labels); return Array.isArray(value) ? value.map(String) : []; } catch { return row.labels.split(",").map((item) => item.trim()).filter(Boolean); } } return []; }
function distribution(rows: ApiRecord[], key: string) { const map = new Map<string, number>(); rows.forEach((row) => { const value = String(row[key] || "Unknown").trim() || "Unknown"; map.set(value, (map.get(value) || 0) + 1); }); return [...map.entries()].sort((a, b) => b[1] - a[1]); }

export function CustomerKnowledgeWorkspace({ rows, management }: { rows: ApiRecord[]; management: ReactNode }) {
  const [tab, setTab] = useState<Tab>("dashboard"); const [platform, setPlatform] = useState(""); const [month, setMonth] = useState(""); const [category, setCategory] = useState(""); const [label, setLabel] = useState(""); const [query, setQuery] = useState("");
  const platforms = distribution(rows, "platform").map(([value]) => value); const months = distribution(rows, "bulan").map(([value]) => value); const categories = distribution(rows, "kategori").map(([value]) => value); const allLabels = [...new Set(rows.flatMap(labels))].sort();
  const filtered = useMemo(() => rows.filter((row) => (!platform || row.platform === platform) && (!month || row.bulan === month) && (!category || row.kategori === category) && (!label || labels(row).includes(label)) && (!query || `${row.komentar || ""} ${row.username || ""}`.toLowerCase().includes(query.toLowerCase()))), [rows, platform, month, category, label, query]);
  const keywords = useMemo(() => { const frequencies = new Map<string, number>(); rows.forEach((row) => { const words = String(row.komentar || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word && (whitelist.has(word) || (word.length > 2 && !stopwords.has(word)))); const seen = new Set(words); for (let index = 0; index < words.length - 1; index += 1) seen.add(`${words[index]} ${words[index + 1]}`); seen.forEach((word) => { if (word.includes(" ") && ![...rows].some((other) => other !== row && String(other.komentar || "").toLowerCase().includes(word))) return; frequencies.set(word, (frequencies.get(word) || 0) + 1); }); }); return [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15); }, [rows]);
  const byCategory = distribution(rows, "kategori"); const byPlatform = distribution(rows, "platform"); const byMonth = distribution(rows, "bulan");

  return (
    <div className="grid gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <Tabs onValueChange={(value) => setTab(value as Tab)} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="manage">Add &amp; manage</TabsTrigger>
          </TabsList>
        </Tabs>
        <nav className="flex gap-3 text-xs font-medium text-[var(--purple-mid)]">
          <Link href="/customer-knowledge/platforms">Platforms</Link>
          <Link href="/customer-knowledge/categories">Categories</Link>
          <Link href="/customer-knowledge/free-class">Free Class</Link>
        </nav>
      </div>
      {tab === "dashboard" ? (
        <>
          <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
            <StatCard label="Total entries" value={rows.length} />
            <StatCard label="Platforms" value={platforms.length} />
            <StatCard label="Categories" value={categories.length} />
            <StatCard label="Labels" value={allLabels.length} />
            <StatCard label="Active months" value={months.length} />
          </StatsGrid>
          <div className="grid gap-3 md:grid-cols-2">
            <Distribution rows={byCategory.slice(0, 5)} title="Top categories" />
            <Card className="gap-2 p-4">
              <h3 className="text-xs font-bold">Top keywords</h3>
              <div className="flex flex-wrap items-center gap-2">
                {keywords.map(([word, count], index) => <span className="rounded-full bg-[var(--purple-light)] px-2.5 py-1 font-semibold text-[var(--purple-mid)]" key={word} style={{ fontSize: `${10 + Math.round((keywords.length - index) / Math.max(1, keywords.length) * 9)}px`, opacity: 0.55 + (keywords.length - index) / Math.max(1, keywords.length) * 0.45 }} title={`${count} entries`}>{word}</span>)}
              </div>
            </Card>
            <Distribution rows={byPlatform} title="Entries by platform" />
            <Distribution rows={byMonth} title="Entries by month" />
          </div>
        </>
      ) : null}
      {tab === "database" ? (
        <>
          <FilterBar>
            <input className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Search comment or username" value={query} />
            <select className={filterFieldClass} onChange={(event) => setPlatform(event.target.value)} value={platform}><option value="">All platforms</option>{platforms.map((value) => <option key={value}>{value}</option>)}</select>
            <select className={filterFieldClass} onChange={(event) => setMonth(event.target.value)} value={month}><option value="">All months</option>{months.map((value) => <option key={value}>{value}</option>)}</select>
            <select className={filterFieldClass} onChange={(event) => setCategory(event.target.value)} value={category}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
            <select className={filterFieldClass} onChange={(event) => setLabel(event.target.value)} value={label}><option value="">All labels</option>{allLabels.map((value) => <option key={value}>{value}</option>)}</select>
          </FilterBar>
          <div className="grid gap-2.5">
            {filtered.map((row) => (
              <Card className="gap-2.5 p-3.5" key={String(row.id)}>
                <details>
                  <summary className="flex cursor-pointer items-start justify-between gap-2">
                    <div className="min-w-0"><strong className="line-clamp-2 text-[12px] font-semibold">{String(row.komentar || "No comment")}</strong><span className="mt-0.5 block text-[11px] text-muted-foreground">{String(row.username || "Anonymous")} &middot; {String(row.bulan || "No month")}</span></div>
                    <i className="ti ti-chevron-down shrink-0" />
                  </summary>
                  <p className="mt-2 text-[12px] text-muted-foreground">{String(row.komentar || "")}</p>
                  {row.source_url ? <a className="mt-1 inline-block text-[11px] text-[var(--purple-mid)]" href={String(row.source_url)} rel="noreferrer" target="_blank">Open source</a> : null}
                </details>
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone="blue">{String(row.platform || "Unknown")}</Pill>
                  <Pill tone="purple">{String(row.kategori || "Unknown")}</Pill>
                  {labels(row).map((value) => <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground" key={value}>{value}</span>)}
                </div>
                <details className="border-t border-border pt-2">
                  <summary className="w-max cursor-pointer text-[11px] font-semibold text-[var(--purple-mid)]"><i className="ti ti-tags" /> Edit labels</summary>
                  <form action={updatePainPointLabelsAction.bind(null, String(row.id))} className="mt-2 grid gap-2">
                    <fieldset className="flex max-h-[120px] flex-wrap gap-2 overflow-y-auto rounded-lg border border-border p-2">{allLabels.map((value) => <label className="flex items-center gap-1 text-[10px]" key={value}><input defaultChecked={labels(row).includes(value)} name="labels" type="checkbox" value={value} />{value}</label>)}</fieldset>
                    <label className="grid gap-1 text-[10px] text-muted-foreground"><span>New label</span><input className={filterFieldClass} name="new_label" placeholder="Create label" /></label>
                    <Button className="w-max" size="sm" type="submit">Save labels</Button>
                  </form>
                </details>
              </Card>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{filtered.length} of {rows.length} entries</p>
        </>
      ) : null}
      {tab === "manage" ? management : null}
    </div>
  );
}

function Distribution({ title, rows }: { title: string; rows: [string, number][] }) {
  const maximum = Math.max(1, ...rows.map(([, count]) => count));
  return (
    <Card className="gap-2 p-4">
      <h3 className="text-xs font-bold">{title}</h3>
      {rows.length ? rows.map(([value, count]) => <div className="grid grid-cols-[110px_minmax(0,1fr)_36px] items-center gap-2 text-[10px]" key={value}><span className="overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">{value}</span><i className="block h-2 min-w-[2px] rounded bg-[var(--purple-mid)]" style={{ width: `${(count / maximum) * 100}%` }} /><strong className="text-right">{count}</strong></div>) : <p className="text-[11px] text-muted-foreground">No data.</p>}
    </Card>
  );
}
