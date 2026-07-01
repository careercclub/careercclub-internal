"use client";

import { changeVoucherUsage } from "@/app/actions/voucher-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { useState, useTransition } from "react";
import styles from "../record-manager.module.css";

function state(row: ApiRecord) {
  const end = new Date(String(row.periode_selesai || ""));
  if (Number.isFinite(end.getTime()) && end.getTime() < new Date().setHours(0, 0, 0, 0)) return "Expired";
  if (row.kuota !== null && row.kuota !== undefined && Number(row.terpakai || 0) >= Number(row.kuota)) return "Used up";
  return "Active";
}

export function VoucherTools({ rows }: { rows: ApiRecord[] }) {
  const [items, setItems] = useState(rows);
  const [pending, startTransition] = useTransition();
  function adjust(id: string, amount: number) {
    const before = items;
    setItems((current) => current.map((row) => String(row.id) === id ? { ...row, terpakai: Math.max(0, Number(row.terpakai || 0) + amount) } : row));
    startTransition(async () => { try { await changeVoucherUsage(id, amount); } catch { setItems(before); } });
  }
  return <div className={styles.toolStack}><div className={styles.metricStrip}><div><strong>{items.filter((row) => state(row) === "Active").length}</strong><span>active</span></div><div><strong>{items.reduce((sum, row) => sum + Number(row.terpakai || 0), 0)}</strong><span>redeemed</span></div><div><strong>{items.filter((row) => state(row) === "Expired").length}</strong><span>expired</span></div></div><div className={styles.summaryGrid}>{items.map((row) => <article key={String(row.id)}><header><strong>{String(row.kode || "No code")}</strong><span>{state(row)}</span></header><p>{String(row.nama_event || "Untitled campaign")} - {Number(row.diskon_persen || 0)}%</p><footer><span>{Number(row.terpakai || 0)} / {row.kuota ?? "unlimited"} used</span><button disabled={pending} onClick={() => adjust(String(row.id), -1)} type="button">-</button><button disabled={pending} onClick={() => adjust(String(row.id), 1)} type="button">+</button></footer></article>)}</div></div>;
}
