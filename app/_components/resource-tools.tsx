"use client";

import { reorderResourcesAction } from "@/app/actions/resource-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useState, useTransition } from "react";
import styles from "../record-manager.module.css";

export function ResourceTools({ rows }: { rows: ApiRecord[] }) {
  const [items, setItems] = useState([...rows].sort((a, b) => String(a.kategori).localeCompare(String(b.kategori)) || Number(a.urutan || 0) - Number(b.urutan || 0)));
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = useMemo(() => items.filter((row) => !query || `${row.kategori} ${row.nama} ${row.url}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length || items[index].kategori !== items[target].kategori) return;
    const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; setItems(next);
    startTransition(() => reorderResourcesAction(next.map((row, position) => ({ id: String(row.id), kategori: String(row.kategori || "Other"), urutan: position }))));
  }
  return <div className={styles.toolStack}><div className={styles.filterBar}><input placeholder="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} />{pending ? <span className={styles.formMessage}>Saving order...</span> : null}</div><div className={styles.resourceList}>{visible.map((row) => { const index = items.findIndex((item) => item.id === row.id); return <article key={String(row.id)}><div><span>{String(row.kategori || "Other")}</span><strong>{String(row.nama || "Untitled")}</strong><small>{String(row.url || row.email || row.username || "No reference")}</small></div><button onClick={() => move(index, -1)} type="button" aria-label="Move up"><i className="ti ti-chevron-up" /></button><button onClick={() => move(index, 1)} type="button" aria-label="Move down"><i className="ti ti-chevron-down" /></button></article>; })}</div></div>;
}
