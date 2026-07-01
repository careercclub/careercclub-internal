"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { FilterBar, Pill, StatCard, StatsGrid, filterFieldClass } from "./ui-kit";

type Tab = "overview" | "pipeline" | "database" | "manage";
const STATUS_TONE: Record<string, "green" | "amber" | "red" | "blue"> = { "Closed Deal": "green", Negotiation: "amber", "Closed Lost": "red" };
function distribution(rows: ApiRecord[], key: string) { const map = new Map<string, number>(); rows.forEach((row) => { const value = String(row[key] || "Unknown"); map.set(value, (map.get(value) || 0) + 1); }); return [...map.entries()].sort((a, b) => b[1] - a[1]); }
function csvCell(value: unknown) { const text = String(value || ""); return `"${text.replaceAll('"', '""')}"`; }

export function PartnershipWorkspace({ rows, title, entityLabel, pipeline, management }: { rows: ApiRecord[]; title: string; entityLabel: string; pipeline: ReactNode; management: ReactNode }) {
  const [tab, setTab] = useState<Tab>("overview"); const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [tier, setTier] = useState(""); const [status, setStatus] = useState(""); const [selected, setSelected] = useState<ApiRecord | null>(null); const categories = distribution(rows, "category").map(([value]) => value); const tiers = distribution(rows, "tier").map(([value]) => value); const statuses = distribution(rows, "status").map(([value]) => value);
  const filtered = useMemo(() => rows.filter((row) => (!query || `${row.name} ${row.contact_name} ${row.scope}`.toLowerCase().includes(query.toLowerCase())) && (!category || row.category === category) && (!tier || row.tier === tier) && (!status || row.status === status)), [rows, query, category, tier, status]);
  function exportCsv() { const headers = ["name", "category", "tier", "status", "contact_name", "contact_email", "contact_phone", "scope", "notes", "input_date"]; const content = [headers.join(","), ...filtered.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([content], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${entityLabel.toLowerCase().replaceAll(" ", "-")}.csv`; anchor.click(); URL.revokeObjectURL(url); }

  return (
    <div className="grid gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <Tabs onValueChange={(value) => setTab(value as Tab)} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="manage">Add &amp; manage</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={exportCsv} size="sm" variant="outline"><i className="ti ti-file-export" /> Export filtered CSV</Button>
      </div>
      {tab === "overview" ? (
        <>
          <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
            <StatCard label={`Total ${entityLabel}`} value={rows.length} />
            <StatCard label="Approached" value={rows.filter((row) => row.status === "Approached").length} />
            <StatCard label="Negotiation" tone="var(--amber)" value={rows.filter((row) => row.status === "Negotiation").length} />
            <StatCard label="Closed deal" tone="var(--green)" value={rows.filter((row) => row.status === "Closed Deal").length} />
            <StatCard label="Missing PIC" tone="var(--red)" value={rows.filter((row) => !row.contact_name).length} />
          </StatsGrid>
          <div className="grid gap-3 md:grid-cols-3">
            <Distribution rows={distribution(rows, "status")} title="Pipeline stage" />
            <Distribution rows={distribution(rows, "category")} title="Category" />
            <Distribution rows={distribution(rows, "tier")} title="Relationship tier" />
          </div>
        </>
      ) : null}
      {tab === "pipeline" ? pipeline : null}
      {tab === "database" ? (
        <>
          <FilterBar>
            <input className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${entityLabel}`} value={query} />
            <select className={filterFieldClass} onChange={(event) => setCategory(event.target.value)} value={category}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
            <select className={filterFieldClass} onChange={(event) => setTier(event.target.value)} value={tier}><option value="">All tiers</option>{tiers.map((value) => <option key={value}>{value}</option>)}</select>
            <select className={filterFieldClass} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">All stages</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
          </FilterBar>
          <Card className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Tier</TableHead><TableHead>Status</TableHead><TableHead>PIC</TableHead><TableHead>Contact</TableHead><TableHead>Scope</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow className="cursor-pointer" key={String(row.id)} onClick={() => setSelected(row)}>
                    <TableCell className="whitespace-normal"><strong className="block text-[var(--purple-mid)]">{String(row.name || "Untitled")}</strong><span className="text-muted-foreground">{String(row.input_date || "")}</span></TableCell>
                    <TableCell>{String(row.category || "-")}</TableCell>
                    <TableCell><Pill tone="purple">{String(row.tier || "-")}</Pill></TableCell>
                    <TableCell><Pill tone={STATUS_TONE[String(row.status || "")] || "gray"}>{String(row.status || "-")}</Pill></TableCell>
                    <TableCell>{String(row.contact_name || "-")}</TableCell>
                    <TableCell>{String(row.contact_phone || row.contact_email || "-")}</TableCell>
                    <TableCell className="whitespace-normal">{String(row.scope || "-")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : null}
      {tab === "manage" ? management : null}
      {selected ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-5" onMouseDown={() => setSelected(null)}>
          <Card className="w-full max-w-xl gap-3 p-4.5" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div><span className="text-[10px] text-muted-foreground">{String(selected.category || entityLabel)}</span><h2 className="text-lg font-bold">{String(selected.name || "Untitled")}</h2><p className="text-[11px] text-muted-foreground">{String(selected.status || "-")} &middot; {String(selected.tier || "-")}</p></div>
              <button onClick={() => setSelected(null)} type="button"><i className="ti ti-x" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[["PIC", selected.contact_name], ["Email", selected.contact_email], ["WhatsApp", selected.contact_phone], ["Position", selected.pos], ["LinkedIn", selected.li], ["Scope", selected.scope]].map(([label, value]) => <div className="rounded-lg bg-[var(--bg)] p-2" key={String(label)}><span className="block text-[9px] text-muted-foreground uppercase">{label}</span><strong className="text-[11px]">{String(value || "-")}</strong></div>)}
            </div>
            <div><h3 className="mb-1 text-xs font-bold">Notes</h3><p className="text-[12px] text-muted-foreground">{String(selected.notes || "No notes")}</p></div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Distribution({ title, rows }: { title: string; rows: [string, number][] }) {
  const maximum = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <Card className="gap-2 p-4">
      <h3 className="text-xs font-bold">{title}</h3>
      {rows.map(([label, value]) => <div className="grid grid-cols-[90px_minmax(0,1fr)_36px] items-center gap-2 text-[10px]" key={label}><span className="overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">{label}</span><i className="block h-2 min-w-[2px] rounded bg-[var(--purple-mid)]" style={{ width: `${(value / maximum) * 100}%` }} /><strong className="text-right">{value}</strong></div>)}
    </Card>
  );
}
