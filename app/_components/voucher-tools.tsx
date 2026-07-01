"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useState } from "react";
import styles from "../record-manager.module.css";

function rupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function VoucherTools({ rows, products, referenceDate }: { rows: ApiRecord[]; products: ApiRecord[]; referenceDate: string }) {
  const [selectedId, setSelectedId] = useState("");
  const [price, setPrice] = useState(0);
  const today = referenceDate.slice(0, 10);
  const active = rows.filter((row) => !row.periode_selesai || String(row.periode_selesai).slice(0, 10) >= today);
  const selected = rows.find((row) => String(row.id) === selectedId);
  const eligibleProducts = useMemo(() => {
    if (!selected) return [];
    const ids = Array.isArray(selected.product_ids) ? selected.product_ids.map(String) : [];
    return ids.length ? products.filter((product) => ids.includes(String(product.id))) : products;
  }, [products, selected]);
  const minimum = Number(selected?.min_transaksi || 0);
  const maximum = Number(selected?.maks_potongan || 0);
  const percentage = Number(selected?.diskon_persen || 0);
  const discount = price >= minimum ? Math.min(Math.round(price * percentage / 100), maximum || Number.MAX_SAFE_INTEGER) : 0;

  return <div className={styles.toolStack}><div className={styles.metricStrip}><div><strong>{rows.length}</strong><span>total vouchers</span></div><div><strong>{active.length}</strong><span>active</span></div><div><strong>{rows.length - active.length}</strong><span>expired</span></div></div><div className={styles.summaryGrid}>{rows.map((row) => { const status = !row.periode_selesai || String(row.periode_selesai).slice(0, 10) >= today ? "Aktif" : "Expired"; return <article key={String(row.id)}><header><strong>{String(row.kode || "No code")}</strong><span>{status}</span></header><p>{String(row.nama_event || "Untitled campaign")} · {Number(row.diskon_persen || 0)}%</p><footer><span>{String(row.periode_mulai || "-")} to {String(row.periode_selesai || "-")}</span><button className={styles.secondaryButton} onClick={() => { setSelectedId(String(row.id)); setPrice(0); }} type="button"><i className="ti ti-calculator" /> Calculate</button></footer></article>; })}</div>{selected ? <section className={styles.createPanel}><div className={styles.workspaceHeader}><div><span className={styles.eyebrow}>Discount calculator</span><h3>{String(selected.kode)} · {percentage}%</h3></div><button className={styles.secondaryButton} onClick={() => setSelectedId("")} type="button"><i className="ti ti-x" /> Close</button></div><div className={styles.formGrid}>{eligibleProducts.length ? <label className={styles.field}><span>Eligible product</span><select defaultValue="" onChange={(event) => { const product = products.find((item) => String(item.id) === event.target.value); setPrice(Number(product?.harga || 0)); }}><option value="">Enter a price manually</option>{eligibleProducts.map((product) => <option key={String(product.id)} value={String(product.id)}>{String(product.nama)} · {rupiah(Number(product.harga || 0))}</option>)}</select></label> : null}<label className={styles.field}><span>Original price</span><input min="0" type="number" value={price || ""} onChange={(event) => setPrice(Number(event.target.value || 0))} /></label></div>{price > 0 && price < minimum ? <p className={styles.formMessage}>Minimum transaction is {rupiah(minimum)}.</p> : price > 0 ? <div className={styles.metricStrip}><div><strong>{rupiah(price)}</strong><span>original price</span></div><div><strong>- {rupiah(discount)}</strong><span>discount{maximum ? ` (max ${rupiah(maximum)})` : ""}</span></div><div><strong>{rupiah(price - discount)}</strong><span>final price</span></div></div> : null}</section> : null}</div>;
}
