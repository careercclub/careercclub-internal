"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Pill, StatCard, StatsGrid } from "./ui-kit";

function rupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}
function status(row: ApiRecord, today: string): "aktif" | "expired" { return !row.periode_selesai || String(row.periode_selesai).slice(0, 10) >= today ? "aktif" : "expired"; }

export function VoucherTools({ rows, products, referenceDate, create, manage }: { rows: ApiRecord[]; products: ApiRecord[]; referenceDate: string; create: ReactNode; manage: ReactNode }) {
  const [tab, setTab] = useState<"overview" | "list" | "manage">("overview");
  const [selectedId, setSelectedId] = useState("");
  const [price, setPrice] = useState(0);
  const today = referenceDate.slice(0, 10);
  const active = rows.filter((row) => status(row, today) === "aktif");
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
  const byType = useMemo(() => { const map = new Map<string, ApiRecord[]>(); rows.forEach((row) => { const key = String(row.tipe || "Lainnya"); map.set(key, [...(map.get(key) || []), row]); }); return [...map.entries()]; }, [rows]);

  return (
    <div className="grid gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <Tabs onValueChange={(value) => setTab(value as typeof tab)} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="overview"><i className="ti ti-layout-dashboard" /> Overview</TabsTrigger>
            <TabsTrigger value="list"><i className="ti ti-ticket" /> Semua Voucher</TabsTrigger>
            <TabsTrigger value="manage">Manage data</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tab === "overview" ? (
        <>
          <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-3">
            <StatCard label="Total" value={rows.length} tone="var(--purple-accent)" />
            <StatCard label="Aktif" value={active.length} tone="var(--green)" />
            <StatCard label="Expired" value={rows.length - active.length} tone="var(--red)" />
          </StatsGrid>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {byType.map(([type, items]) => (
              <Card className="gap-0 overflow-hidden p-0" key={type}>
                <div className="border-b border-border bg-[var(--bg)] px-3 py-2 text-[11px] font-bold">{type} <span className="font-normal text-muted-foreground">({items.length})</span></div>
                <div className="grid gap-1.5 p-3">
                  {items.map((row) => (
                    <div className="flex items-center gap-2" key={String(row.id)}>
                      <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{String(row.nama_event)}</div><div className="font-mono text-[10px] text-muted-foreground">{String(row.kode)} &middot; {Number(row.diskon_persen || 0)}%</div></div>
                      <Pill tone={status(row, today) === "aktif" ? "green" : "red"}>{status(row, today) === "aktif" ? "Aktif" : "Expired"}</Pill>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          {create}
        </>
      ) : null}
      {tab === "list" ? (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <Card className="gap-2 p-3.5" key={String(row.id)}>
                <div className="flex items-center justify-between gap-2"><strong className="font-mono text-[12px] font-semibold">{String(row.kode || "No code")}</strong><Pill tone={status(row, today) === "aktif" ? "green" : "red"}>{status(row, today) === "aktif" ? "Aktif" : "Expired"}</Pill></div>
                <p className="text-[11px] text-muted-foreground">{String(row.nama_event || "Untitled campaign")} &middot; {Number(row.diskon_persen || 0)}%</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">{String(row.periode_mulai || "-")} to {String(row.periode_selesai || "-")}</span>
                  <Button onClick={() => { setSelectedId(String(row.id)); setPrice(0); }} size="sm" type="button" variant="outline"><i className="ti ti-calculator" /> Calculate</Button>
                </div>
              </Card>
            ))}
          </div>
          {selected ? (
            <Card className="gap-3 p-4">
              <div className="flex items-center justify-between"><div><span className="text-[10px] text-muted-foreground uppercase">Discount calculator</span><h3 className="text-sm font-bold">{String(selected.kode)} &middot; {percentage}%</h3></div><Button onClick={() => setSelectedId("")} size="sm" type="button" variant="outline"><i className="ti ti-x" /> Close</Button></div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {eligibleProducts.length ? (
                  <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase">
                    <span>Eligible product</span>
                    <select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" defaultValue="" onChange={(event) => { const product = products.find((item) => String(item.id) === event.target.value); setPrice(Number(product?.harga || 0)); }}>
                      <option value="">Enter a price manually</option>
                      {eligibleProducts.map((product) => <option key={String(product.id)} value={String(product.id)}>{String(product.nama)} &middot; {rupiah(Number(product.harga || 0))}</option>)}
                    </select>
                  </label>
                ) : null}
                <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Original price</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" min="0" onChange={(event) => setPrice(Number(event.target.value || 0))} type="number" value={price || ""} /></label>
              </div>
              {price > 0 && price < minimum ? <p className="text-[11px] text-muted-foreground">Minimum transaction is {rupiah(minimum)}.</p> : price > 0 ? (
                <StatsGrid className="mb-0 grid-cols-3">
                  <StatCard label="original price" value={rupiah(price)} />
                  <StatCard label={`discount${maximum ? ` (max ${rupiah(maximum)})` : ""}`} value={`- ${rupiah(discount)}`} />
                  <StatCard label="final price" value={rupiah(price - discount)} tone="var(--green)" />
                </StatsGrid>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
      {tab === "manage" ? manage : null}
    </div>
  );
}
