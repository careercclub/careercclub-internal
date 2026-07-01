"use client";

import { movePipelineRecord } from "@/app/actions/pipeline-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useState, useTransition } from "react";
import styles from "../record-manager.module.css";

type PipelineTable = "partners" | "org_partners" | "crm_deals";
type Props = { rows: ApiRecord[]; table: PipelineTable; statusField: "status" | "stage"; titleField: string; subtitleField?: string; statuses: readonly string[] };

export function PipelineBoard({ rows, table, statusField, titleField, subtitleField, statuses }: Props) {
  const [items, setItems] = useState(rows);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => items.filter((row) => !query || `${row[titleField]} ${subtitleField ? row[subtitleField] : ""}`.toLowerCase().includes(query.toLowerCase())), [items, query, titleField, subtitleField]);

  function move(id: string, status: string) {
    const previous = items;
    setItems((current) => current.map((row) => String(row.id) === id ? { ...row, [statusField]: status } : row));
    startTransition(async () => {
      try { await movePipelineRecord(table, id, status); } catch { setItems(previous); }
    });
  }

  function exportCsv() {
    const columns = [...new Set(items.flatMap((row) => Object.keys(row)))];
    const encode = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [columns.map(encode).join(","), ...items.map((row) => columns.map((column) => encode(row[column])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${table}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className={styles.toolStack}><div className={styles.filterBar}><input placeholder="Search pipeline" value={query} onChange={(event) => setQuery(event.target.value)} /><button className={styles.secondaryButton} onClick={exportCsv} type="button"><i className="ti ti-download" /> Export CSV</button>{pending ? <span className={styles.formMessage}>Saving...</span> : null}</div><div className={styles.pipelineBoard}>{statuses.map((status) => { const columnRows = filtered.filter((row) => String(row[statusField] || statuses[0]) === status); return <section key={status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(event.dataTransfer.getData("record-id"), status)}><header><strong>{status}</strong><span>{columnRows.length}</span></header><div>{columnRows.map((row) => <article draggable key={String(row.id)} onDragStart={(event) => event.dataTransfer.setData("record-id", String(row.id))}><strong>{String(row[titleField] || "Untitled")}</strong>{subtitleField ? <span>{String(row[subtitleField] || "-")}</span> : null}<select aria-label={`Move ${String(row[titleField])}`} value={String(row[statusField] || statuses[0])} onChange={(event) => move(String(row.id), event.target.value)}>{statuses.map((option) => <option key={option}>{option}</option>)}</select></article>)}</div></section>; })}</div></div>;
}
