"use client";

import { createProductKnowledgeAction, deleteProductKnowledgeAction } from "@/app/actions/product-knowledge-actions";
import { duplicateProductAction } from "@/app/actions/product-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { FilterBar, FilterPill, Pill, StatCard, StatsGrid, filterFieldClass } from "./ui-kit";

type Workspace = { products: ApiRecord[]; painPoints: ApiRecord[]; passionPoints: ApiRecord[]; benefits: ApiRecord[]; features: ApiRecord[]; featureLinks: ApiRecord[]; bundles: ApiRecord[]; subProducts: ApiRecord[]; subProductLinks: ApiRecord[]; assets: ApiRecord[]; feedbacks: ApiRecord[] };
type Tab = "overview" | "pain" | "passion" | "benefit" | "feature" | "subProduct" | "asset" | "feedback" | "manage";
type KnowledgeTab = Exclude<Tab, "overview" | "manage">;
function isKnowledgeTab(value: Tab): value is KnowledgeTab { return value !== "overview" && value !== "manage"; }
const KB_LABELS: Record<KnowledgeTab, string> = { pain: "Pain points", passion: "Passion points", benefit: "Benefits", feature: "Features", subProduct: "Sub-products", asset: "Assets", feedback: "Feedback" };
const STATUS_TONE: Record<string, "green" | "gray" | "amber" | "red"> = { Live: "green", Draft: "gray", "Pre-launch": "amber", Archived: "red" };
function money(value: unknown) { return `Rp ${Number(value || 0).toLocaleString("id-ID")}`; }

export function ProductWorkbench({ workspace, management }: { workspace: Workspace; management: ReactNode }) {
  const [query, setQuery] = useState(""); const [type, setType] = useState(""); const [classification, setClassification] = useState(""); const [status, setStatus] = useState(""); const [sort, setSort] = useState("name"); const [selectedId, setSelectedId] = useState(String(workspace.products[0]?.id || "")); const [tab, setTab] = useState<Tab>("overview");
  const products = useMemo(() => [...workspace.products].filter((product) => (!query || `${product.nama} ${product.kategori}`.toLowerCase().includes(query.toLowerCase())) && (!type || product.type === type) && (!classification || product.kategori === classification) && (!status || product.status === status)).sort((a, b) => sort === "high" ? Number(b.harga || 0) - Number(a.harga || 0) : sort === "low" ? Number(a.harga || 0) - Number(b.harga || 0) : String(a.nama || "").localeCompare(String(b.nama || ""))), [workspace.products, query, type, classification, status, sort]);
  const selected = workspace.products.find((product) => String(product.id) === selectedId) || products[0];
  const id = String(selected?.id || "");
  const bundleRows = workspace.bundles.filter((row) => String(row.bundle_id) === id);
  const memberIds = new Set(bundleRows.map((row) => String(row.item_id)));
  const mergedIds = new Set([id, ...memberIds]);
  function knowledgeRows(kind: KnowledgeTab) { if (kind === "pain") return workspace.painPoints.filter((row) => mergedIds.has(String(row.product_id))); if (kind === "passion") return workspace.passionPoints.filter((row) => mergedIds.has(String(row.product_id))); if (kind === "benefit") return workspace.benefits.filter((row) => mergedIds.has(String(row.product_id))); if (kind === "feature") return workspace.features.filter((row) => mergedIds.has(String(row.product_id))); if (kind === "subProduct") return workspace.subProducts.filter((row) => mergedIds.has(String(row.product_id))); if (kind === "asset") return workspace.assets.filter((row) => mergedIds.has(String(row.product_id))); return workspace.feedbacks.filter((row) => mergedIds.has(String(row.product_id))); }
  const subtotal = [...memberIds].reduce((sum, memberId) => sum + Number(workspace.products.find((product) => String(product.id) === memberId)?.harga || 0), 0);
  const discount = subtotal > 0 ? Math.round((subtotal - Number(selected?.harga || 0)) / subtotal * 100) : 0;
  const classifications = [...new Set(workspace.products.map((product) => String(product.kategori || "")).filter(Boolean))].sort();
  const satuanCount = workspace.products.filter((product) => (product.type || "satuan") === "satuan").length;
  const bundlingCount = workspace.products.filter((product) => (product.type || "satuan") === "bundling").length;

  function exportSelected() { if (!selected) return; const payload = { product: selected, bundleItems: workspace.products.filter((product) => memberIds.has(String(product.id))), painPoints: knowledgeRows("pain"), passionPoints: knowledgeRows("passion"), benefits: knowledgeRows("benefit"), features: knowledgeRows("feature"), subProducts: knowledgeRows("subProduct"), assets: knowledgeRows("asset"), feedbacks: knowledgeRows("feedback") }; const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${String(selected.nama || "product").replace(/\W+/g, "-")}-kb.json`; anchor.click(); URL.revokeObjectURL(url); }
  async function remove(kind: KnowledgeTab, rowId: string) { if (window.confirm("Delete this knowledge item?")) await deleteProductKnowledgeAction(kind, rowId); }

  return (
    <div className="grid gap-3.5">
      <Card className="gap-3 p-5">
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-base font-bold">Products</div>
            <div className="text-[13px] text-muted-foreground">{workspace.products.length} total &middot; {satuanCount} satuan &middot; {bundlingCount} bundling</div>
          </div>
          <Button onClick={exportSelected} size="sm" variant="outline"><i className="ti ti-download" /> Export selected KB</Button>
        </div>
        <StatsGrid className="mb-0">
          <StatCard label="Live" value={workspace.products.filter((product) => product.status === "Live").length} tone="var(--green)" />
          <StatCard label="Draft" value={workspace.products.filter((product) => product.status === "Draft").length} />
          <StatCard label="Bundles" value={bundlingCount} tone="var(--purple-mid)" />
          <StatCard label="Catalog value" value={money(workspace.products.reduce((sum, product) => sum + Number(product.harga || 0), 0))} />
        </StatsGrid>
      </Card>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <aside className="grid gap-2.5">
          <FilterBar className="mb-0">
            <input className={cn(filterFieldClass, "max-w-none flex-1")} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" value={query} />
          </FilterBar>
          <FilterBar>
            <FilterPill active={type === ""} onClick={() => setType("")}>Semua</FilterPill>
            <FilterPill active={type === "satuan"} onClick={() => setType("satuan")}>Satuan</FilterPill>
            <FilterPill active={type === "bundling"} onClick={() => setType("bundling")}>Bundling</FilterPill>
            <select className={filterFieldClass} onChange={(event) => setClassification(event.target.value)} value={classification}><option value="">Semua label</option>{classifications.map((value) => <option key={value}>{value}</option>)}</select>
            <select className={filterFieldClass} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">Semua status</option><option>Draft</option><option>Pre-launch</option><option>Live</option><option>Archived</option></select>
            <select className={filterFieldClass} onChange={(event) => setSort(event.target.value)} value={sort}><option value="name">Nama</option><option value="high">Harga tertinggi</option><option value="low">Harga terendah</option></select>
          </FilterBar>
          <div className="grid max-h-[70vh] gap-1.5 overflow-y-auto">
            {products.map((product) => {
              const isBundling = (product.type || "satuan") === "bundling";
              const active = String(product.id) === id;
              return (
                <button className={cn("rounded-lg border p-2.5 text-left", active ? "border-[var(--purple-accent)] bg-[var(--purple-light)]" : "border-border bg-white")} key={String(product.id)} onClick={() => { setSelectedId(String(product.id)); setTab("overview"); }} type="button">
                  <strong className="block text-[13px] font-semibold">{String(product.nama || "Untitled")}</strong>
                  <span className="text-[11px] text-muted-foreground">{isBundling ? "Bundling" : "Satuan"} &middot; {String(product.status || "Draft")}</span>
                  <small className="mt-0.5 block text-[11px] font-semibold">{money(product.harga)}</small>
                </button>
              );
            })}
          </div>
        </aside>
        {selected ? (
          <main className="min-w-0">
            <Card className="mb-3 flex-row items-start justify-between gap-3 p-4">
              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Pill tone={STATUS_TONE[String(selected.status || "Draft")] || "gray"}>{String(selected.status || "Draft")}</Pill>
                  {selected.type === "bundling" ? <Pill tone="purple">Bundling</Pill> : <Pill tone="blue">{String(selected.kategori || "-")}</Pill>}
                </div>
                <h2 className="mb-1 text-base font-bold">{String(selected.nama || "Untitled")}</h2>
                <p className="text-[12px] text-muted-foreground">{String(selected.deskripsi || "No description")}</p>
              </div>
              <strong className="shrink-0 text-[15px] font-semibold">{money(selected.harga)}</strong>
            </Card>
            {selected.type === "bundling" ? (
              <StatsGrid className="mb-3 grid-cols-3">
                <StatCard label="Included products" value={memberIds.size} />
                <StatCard label="Subtotal" value={money(subtotal)} />
                <StatCard label="Savings" value={`${Math.max(0, discount)}%`} tone="var(--green)" />
              </StatsGrid>
            ) : null}
            <Tabs onValueChange={(value) => setTab(value as Tab)} value={tab}>
              <TabsList className="mb-3 h-auto w-full justify-start overflow-x-auto" variant="line">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                {(["pain", "passion", "benefit", "feature", "subProduct", "asset", "feedback"] as const).map((key) => <TabsTrigger key={key} value={key}>{KB_LABELS[key]} ({knowledgeRows(key).length})</TabsTrigger>)}
                <TabsTrigger value="manage">Manage</TabsTrigger>
              </TabsList>
              <TabsContent value="overview"><Overview bundleRows={bundleRows} memberIds={memberIds} productId={id} selected={selected} workspace={workspace} /></TabsContent>
              {isKnowledgeTab(tab) ? <TabsContent value={tab}><KnowledgeSection kind={tab} onDelete={remove} productId={id} rows={knowledgeRows(tab)} workspace={workspace} /></TabsContent> : null}
              <TabsContent value="manage">{management}</TabsContent>
            </Tabs>
          </main>
        ) : null}
      </div>
    </div>
  );
}

function Overview({ selected, workspace, bundleRows, memberIds, productId }: { selected: ApiRecord; workspace: Workspace; bundleRows: ApiRecord[]; memberIds: Set<string>; productId: string }) {
  return (
    <div className="grid gap-3">
      <Card className="gap-1.5 p-3.5"><h3 className="text-[10px] font-semibold tracking-wide uppercase">Classification</h3><p className="text-[12px] text-muted-foreground">{String(selected.kategori || "-")}</p></Card>
      <Card className="gap-1.5 p-3.5"><h3 className="text-[10px] font-semibold tracking-wide uppercase">Landing page</h3>{selected.link ? <a className="text-[12px] text-[var(--purple-mid)]" href={String(selected.link)} rel="noreferrer" target="_blank">{String(selected.link)}</a> : <p className="text-[12px] text-muted-foreground">-</p>}</Card>
      {selected.type === "bundling" ? (
        <Card className="gap-2 p-3.5">
          <h3 className="text-[10px] font-semibold tracking-wide uppercase">Bundle contents</h3>
          {bundleRows.map((bundle) => {
            const product = workspace.products.find((item) => String(item.id) === String(bundle.item_id));
            return <div className="flex items-center justify-between border-b border-border py-1.5 text-[12px] last:border-0" key={String(bundle.id)}><span>{String(product?.nama || "Unknown product")} &middot; {money(product?.harga)}</span><Button onClick={() => deleteProductKnowledgeAction("bundle", String(bundle.id))} size="icon-xs" variant="ghost"><i className="ti ti-x" /></Button></div>;
          })}
          <details className="mt-1 rounded-lg border border-border">
            <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-[var(--purple-dark)]"><i className="ti ti-plus" /> Add bundle product</summary>
            <form action={createProductKnowledgeAction.bind(null, "bundle", productId)} className="grid gap-2 p-3">
              <select className="h-9 rounded-md border border-input px-2 text-xs" name="parent_id" required>{workspace.products.filter((product) => String(product.id) !== productId && !memberIds.has(String(product.id))).map((product) => <option key={String(product.id)} value={String(product.id)}>{String(product.nama)} - {money(product.harga)}</option>)}</select>
              <Button size="sm" type="submit">Add product</Button>
            </form>
          </details>
        </Card>
      ) : null}
      <Card className="gap-2 p-3.5">
        <details>
          <summary className="cursor-pointer text-[12px] font-semibold text-[var(--purple-dark)]"><i className="ti ti-copy" /> Duplicate product</summary>
          <form action={duplicateProductAction} className="mt-2 grid gap-2">
            <input name="product_id" type="hidden" value={productId} />
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>New name</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="name" required /></label>
            <Button size="sm" type="submit">Duplicate product and KB</Button>
          </form>
        </details>
      </Card>
    </div>
  );
}

function KnowledgeSection({ kind, productId, rows, workspace, onDelete }: { kind: KnowledgeTab; productId: string; rows: ApiRecord[]; workspace: Workspace; onDelete: (kind: KnowledgeTab, id: string) => void }) {
  const label = { pain: "Pain point", passion: "Passion point", benefit: "Benefit", feature: "Feature", subProduct: "Sub-product", asset: "Asset", feedback: "Feedback" }[kind];
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {rows.map((row) => (
          <Card className="flex-row items-start justify-between gap-2.5 p-3" key={String(row.id)}>
            <div className="min-w-0">
              <strong className="text-[12px] font-semibold">{String(row.nama || row.name || row.tipe || label)}</strong>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{String(row.text || row.description || row.isi || row.url || "-")}</p>
              {kind === "feature" ? <small className="mt-0.5 block text-[10px] text-[var(--purple-mid)]">{workspace.featureLinks.filter((link) => String(link.feature_id) === String(row.id)).map((link) => String(link.url)).join(" · ")}</small> : null}
              {kind === "subProduct" ? <small className="mt-0.5 block text-[10px] text-[var(--purple-mid)]">{money(row.harga)} &middot; {workspace.subProductLinks.filter((link) => String(link.sub_product_id) === String(row.id)).map((link) => String(link.url)).join(" · ")}</small> : null}
            </div>
            <Button onClick={() => onDelete(kind, String(row.id))} size="icon-xs" variant="ghost"><i className="ti ti-trash" /></Button>
          </Card>
        ))}
      </div>
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-[var(--purple-dark)]"><i className="ti ti-plus" /> Add {label}</summary>
        <form action={createProductKnowledgeAction.bind(null, kind, productId)} className="grid gap-2.5 p-3">
          {kind === "feedback" ? (
            <>
              <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Type</span><select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="tipe"><option>Positif</option><option>Improvement</option><option>Bug/Error</option><option>Complaint</option></select></label>
              <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Date label</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="tanggal" /></label>
            </>
          ) : kind === "asset" ? (
            <>
              <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Name</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="nama" required /></label>
              <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Type</span><select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="tipe"><option>Link</option><option>Google Drive</option><option>Notion</option><option>YouTube Private</option><option>Canva</option><option>Figma</option><option>Lainnya</option></select></label>
              <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>URL</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="url" type="url" /></label>
              <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Status</span><select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="status"><option>Live</option><option>Draft</option><option>Archived</option></select></label>
            </>
          ) : (
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>{label}</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="nama" required /></label>
          )}
          {!["asset", "subProduct"].includes(kind) ? <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Description</span><textarea className="rounded-md border border-input px-2 py-1.5 text-xs font-normal normal-case text-foreground" name="text" required={kind === "feedback"} /></label> : null}
          {kind === "subProduct" ? <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Price</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="harga" type="number" /></label> : null}
          <Button size="sm" type="submit">Add {label}</Button>
        </form>
      </details>
      {kind === "feature" && workspace.features.some((row) => String(row.product_id) === productId) ? <LinkForm kind="featureLink" parents={workspace.features.filter((row) => String(row.product_id) === productId)} productId={productId} /> : null}
      {kind === "subProduct" && workspace.subProducts.some((row) => String(row.product_id) === productId) ? <LinkForm kind="subLink" parents={workspace.subProducts.filter((row) => String(row.product_id) === productId)} productId={productId} /> : null}
    </div>
  );
}

function LinkForm({ kind, productId, parents }: { kind: "featureLink" | "subLink"; productId: string; parents: ApiRecord[] }) {
  return (
    <details className="rounded-lg border border-border">
      <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-[var(--purple-dark)]">Add {kind === "featureLink" ? "feature" : "sub-product"} link</summary>
      <form action={createProductKnowledgeAction.bind(null, kind, productId)} className="grid gap-2.5 p-3">
        <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Parent</span><select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="parent_id">{parents.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name || row.nama)}</option>)}</select></label>
        <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Label</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="nama" /></label>
        <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>URL</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="url" required type="url" /></label>
        <Button size="sm" type="submit">Add link</Button>
      </form>
    </details>
  );
}
