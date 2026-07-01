"use client";

import { reorderResourcesAction } from "@/app/actions/resource-actions";
import { Card } from "@/components/ui/card";
import type { ApiRecord } from "@/lib/api/_crud";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { FilterBar, filterFieldClass } from "./ui-kit";

export function ResourceTools({ rows, manage }: { rows: ApiRecord[]; manage: ReactNode }) {
  const [items, setItems] = useState([...rows].sort((a, b) => String(a.kategori).localeCompare(String(b.kategori)) || Number(a.urutan || 0) - Number(b.urutan || 0))); const [query, setQuery] = useState(""); const [revealed, setRevealed] = useState<Set<string>>(new Set()); const [message, setMessage] = useState(""); const [pending, startTransition] = useTransition();
  const visible = useMemo(() => items.filter((row) => !query || `${row.kategori} ${row.nama} ${row.url} ${row.email} ${row.username}`.toLowerCase().includes(query.toLowerCase())), [items, query]); const groups = [...new Set(visible.map((row) => String(row.kategori || "Other")))];
  function move(id: string, direction: -1 | 1) { const index = items.findIndex((item) => String(item.id) === id); const peers = items.map((item, position) => ({ item, position })).filter(({ item }) => item.kategori === items[index]?.kategori); const peerIndex = peers.findIndex(({ position }) => position === index); const target = peers[peerIndex + direction]?.position; if (index < 0 || target === undefined) return; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; setItems(next); startTransition(() => reorderResourcesAction(next.map((row, position) => ({ id: String(row.id), kategori: String(row.kategori || "Other"), urutan: position })))); }
  function copy(label: string, value: unknown) { navigator.clipboard.writeText(String(value || "")).then(() => setMessage(`${label} copied.`)).catch(() => setMessage("Clipboard access was blocked.")); }

  return (
    <div className="grid gap-3.5">
      <FilterBar>
        <input className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources" value={query} />
        {pending ? <span className="text-[11px] text-muted-foreground">Saving order...</span> : message ? <span className="text-[11px] text-muted-foreground">{message}</span> : null}
      </FilterBar>
      <div className="grid gap-3">
        {groups.map((group) => {
          const groupItems = visible.filter((row) => String(row.kategori || "Other") === group);
          return (
            <Card className="gap-0 overflow-hidden p-0" key={group}>
              <div className="flex items-center gap-2 border-b border-border bg-[var(--bg)] px-3.5 py-2.5"><i className="ti ti-folder text-[#0f52ba]" /><strong className="text-[12px] font-bold">{group}</strong><span className="text-[10px] text-muted-foreground">{groupItems.length} items</span></div>
              <div className="divide-y divide-border">
                {groupItems.map((row) => {
                  const id = String(row.id);
                  const isCred = row.tipe === "credential";
                  const show = revealed.has(id);
                  return (
                    <div className="flex items-start gap-2.5 p-3" key={id}>
                      <i className={`ti ti-${isCred ? "lock" : "link"} mt-0.5 shrink-0 text-[14px]`} style={{ color: isCred ? "var(--amber)" : "#0f52ba" }} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 text-[13px] font-medium">{String(row.nama || "Untitled")}</div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {row.url ? <span className="flex items-center gap-1"><i className="ti ti-external-link" /><a className="text-[#0f52ba]" href={String(row.url)} rel="noreferrer" target="_blank">{String(row.url).replace(/^https?:\/\//, "").split("/")[0]}</a></span> : null}
                          {row.username ? <span className="flex items-center gap-1"><i className="ti ti-user" /> {String(row.username)}</span> : null}
                          {row.email ? <span className="flex items-center gap-1"><i className="ti ti-mail" /> {String(row.email)}</span> : null}
                          {row.password ? (
                            <span className="flex items-center gap-1">
                              <i className="ti ti-key" style={{ color: "var(--amber)" }} />
                              <span className="font-mono tracking-wider">{show ? String(row.password) : "••••••••"}</span>
                              <button onClick={() => setRevealed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} type="button"><i className={`ti ti-eye${show ? "-off" : ""}`} /></button>
                              <button onClick={() => copy("Password", row.password)} type="button"><i className="ti ti-copy" /></button>
                            </span>
                          ) : null}
                        </div>
                        {row.notes ? <div className="mt-1 text-[11px] text-muted-foreground italic">{String(row.notes)}</div> : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {row.url ? <button aria-label="Copy URL" onClick={() => copy("URL", row.url)} type="button"><i className="ti ti-copy" /></button> : null}
                        <button aria-label="Move up" onClick={() => move(id, -1)} type="button"><i className="ti ti-chevron-up" /></button>
                        <button aria-label="Move down" onClick={() => move(id, 1)} type="button"><i className="ti ti-chevron-down" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      <details className="rounded-lg border border-border bg-white">
        <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-bold text-[var(--purple-dark)]"><i className="ti ti-settings" /> Add, edit, and reorder resources</summary>
        <div className="p-3.5">{manage}</div>
      </details>
    </div>
  );
}
