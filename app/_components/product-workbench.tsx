"use client";

import { confirmDelete } from "./confirm-delete";
import { createProductKnowledgeAction, deleteProductKnowledgeAction } from "@/app/_actions/product-knowledge-actions";
import { createManagedRecord } from "@/app/_actions/record-actions";
import { duplicateProductAction } from "@/app/_actions/product-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ApiRecord } from "@/lib/api/_crud";
import { bundleMath, catalogSummary, filterProducts, isBundle, knowledgeFor, rupiah, type ProductFilter } from "@/lib/products/view";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { confirmAction, notifyError } from "./app-dialog";
import { guard } from "./safe-action";
import s from "./product-workbench.module.css";
import { useRecordFocus } from "./use-record-focus";
import { compareText } from "@/lib/text/sort";
import { MoneyInput } from "./money-input";

// Products in the IJIS layout: a catalog list on the left, and on the right the chosen
// product's page — the product card, bundle math, and its whole knowledge base as a board
// of sections (no tabs to dig through). Same data and actions as before.

type Workspace = { products: ApiRecord[]; painPoints: ApiRecord[]; passionPoints: ApiRecord[]; benefits: ApiRecord[]; features: ApiRecord[]; featureLinks: ApiRecord[]; bundles: ApiRecord[]; subProducts: ApiRecord[]; subProductLinks: ApiRecord[]; assets: ApiRecord[]; feedbacks: ApiRecord[] };
type Kind = "pain" | "passion" | "benefit" | "feature" | "subProduct" | "asset" | "feedback";
const KINDS: Array<{ kind: Kind; title: string; one: string; icon: string; key: keyof Workspace }> = [
  { kind: "pain", title: "Pain points", one: "pain point", icon: "ti-mood-sad", key: "painPoints" },
  { kind: "passion", title: "Passion points", one: "passion point", icon: "ti-heart", key: "passionPoints" },
  { kind: "benefit", title: "Benefits", one: "benefit", icon: "ti-gift", key: "benefits" },
  { kind: "feature", title: "Features", one: "feature", icon: "ti-list-check", key: "features" },
  { kind: "subProduct", title: "Sub-products", one: "sub-product", icon: "ti-box", key: "subProducts" },
  { kind: "asset", title: "Assets", one: "asset", icon: "ti-folder", key: "assets" },
  { kind: "feedback", title: "Feedback", one: "feedback", icon: "ti-message-2", key: "feedbacks" },
];
const STATUSES = ["Draft", "Pre-launch", "Live", "Archived"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?"; }
function StatusChip({ status }: { status: string }) { return <span className={status === "Live" ? s.chipLive : status === "Archived" ? s.chipMuted : s.chip}>{status}</span>; }

export function ProductWorkbench({ workspace, management }: { workspace: Workspace; management: ReactNode }) {
  const [view, setView] = useState<"catalog" | "manage">("catalog");
  const [filter, setFilter] = useState<ProductFilter>({ query: "", type: "", classification: "", status: "", sort: "name" });
  const [selectedId, setSelectedId] = useState(String(workspace.products[0]?.id || ""));
  const [adding, setAdding] = useState(false);
  const summary = useMemo(() => catalogSummary(workspace.products), [workspace.products]);
  const products = useMemo(() => filterProducts(workspace.products, filter), [workspace.products, filter]);
  const selected = workspace.products.find((product) => String(product.id) === selectedId) || products[0];
  const classifications = useMemo(() => [...new Set(workspace.products.map((product) => text(product.kategori)).filter(Boolean))].sort(compareText), [workspace.products]);
  const set = (patch: ProductFilter) => setFilter((current) => ({ ...current, ...patch }));
  useRecordFocus((id) => {
    if (!workspace.products.some((product) => String(product.id) === id)) return;
    setView("catalog"); setFilter({ query: "", type: "", classification: "", status: "", sort: "name" }); setSelectedId(id);
    return true;
  });
  const types: Array<[ProductFilter["type"], string, number]> = [["", "All", summary.total], ["satuan", "Single", summary.single], ["bundling", "Bundles", summary.bundles]];

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Operations</span>
          <h1>Products</h1>
          <p>{summary.total} products · {summary.live} live · {summary.bundles} bundle{summary.bundles === 1 ? "" : "s"} · catalog value {rupiah(summary.value)}</p>
        </div>
        <Button onClick={() => setAdding(true)}><i className="ti ti-plus" aria-hidden="true" /> Add product</Button>
      </header>

      <div className={s.segmented} role="tablist" aria-label="Products view">
        <button aria-selected={view === "catalog"} className={view === "catalog" ? s.segmentActive : s.segment} onClick={() => setView("catalog")} role="tab" type="button">Catalog <span>{summary.total}</span></button>
        <button aria-selected={view === "manage"} className={view === "manage" ? s.segmentActive : s.segment} onClick={() => setView("manage")} role="tab" type="button">Manage data</button>
      </div>

      {view === "manage" ? <div>{management}</div> : (
        <div className={s.board}>
          <aside aria-label="Catalog" className={s.catalog}>
            <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search products" onChange={(e) => set({ query: e.target.value })} placeholder="Search products…" value={filter.query} /></label>
            <div className={s.typeSwitch} role="group" aria-label="Product type">
              {types.map(([value, label, count]) => <button aria-pressed={filter.type === value} className={filter.type === value ? s.typeOn : s.type} key={label} onClick={() => set({ type: value })} type="button">{label} <span>{count}</span></button>)}
            </div>
            <div className={s.filters}>
              <label className={s.filterPill}><span>Status</span><select aria-label="Filter status" onChange={(e) => set({ status: e.target.value })} value={filter.status}><option value="">All</option>{STATUSES.map((v) => <option key={v}>{v}</option>)}</select></label>
              <label className={s.filterPill}><span>Class</span><select aria-label="Filter classification" onChange={(e) => set({ classification: e.target.value })} value={filter.classification}><option value="">All</option>{classifications.map((v) => <option key={v}>{v}</option>)}</select></label>
              <label className={s.filterPill}><span>Sort</span><select aria-label="Sort products" onChange={(e) => set({ sort: e.target.value as ProductFilter["sort"] })} value={filter.sort}><option value="name">Name</option><option value="high">Highest price</option><option value="low">Lowest price</option></select></label>
            </div>
            {products.length ? (
              <ul className={s.list}>
                {products.map((product) => {
                  const active = String(product.id) === String(selected?.id);
                  const name = text(product.nama) || "Untitled";
                  return (
                    <li key={String(product.id)}>
                      <button aria-current={active ? "true" : undefined} className={active ? s.itemActive : s.item} data-record-id={String(product.id)} onClick={() => setSelectedId(String(product.id))} type="button">
                        <span className={isBundle(product) ? s.tileBundle : s.tile} aria-hidden="true">{isBundle(product) ? <i className="ti ti-stack-2" /> : initials(name)}</span>
                        <span className={s.itemText}><b>{name}</b><small>{isBundle(product) ? "Bundle" : text(product.kategori) || "Single"}</small></span>
                        <span className={s.itemSide}><b>{rupiah(product.harga)}</b><StatusChip status={text(product.status) || "Draft"} /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className={s.empty}>{workspace.products.length ? "No products match these filters." : "No products yet."}</p>}
          </aside>
          {selected ? <ProductPage key={String(selected.id)} product={selected} workspace={workspace} /> : <p className={s.empty}>Add a product to start its knowledge base.</p>}
        </div>
      )}

      {adding ? <AddProductDialog onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function ProductPage({ product, workspace }: { product: ApiRecord; workspace: Workspace }) {
  const id = String(product.id);
  const bundle = isBundle(product);
  const math = bundleMath(product, workspace.products, workspace.bundles);
  const memberIds = bundle ? math.memberIds : [];
  const name = text(product.nama) || "Untitled";

  function exportKb() {
    const payload = { product, bundleItems: math.members, ...Object.fromEntries(KINDS.map(({ key }) => [key, knowledgeFor(workspace[key], id, memberIds)])) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${name.replace(/\W+/g, "-")}-kb.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <section aria-label={name} className={s.detail}>
      <div className={s.hero}>
        <div className={s.heroMain}>
          <span className={s.heroKind}>{bundle ? "Bundle" : text(product.kategori) || "Single product"}</span>
          <h2>{name}</h2>
          <p>{text(product.deskripsi) || "No description yet."}</p>
          <div className={s.heroMeta}>
            <StatusChip status={text(product.status) || "Draft"} />
            {text(product.link) ? <a href={text(product.link)} rel="noreferrer" target="_blank"><i className="ti ti-external-link" aria-hidden="true" /> Landing page</a> : <span className={s.muted}>No landing page</span>}
          </div>
        </div>
        <div className={s.heroSide}>
          <b className={s.price}>{rupiah(product.harga)}</b>
          <div className={s.heroActions}>
            <DuplicateProduct productId={id} />
            <button className={s.ghostButton} onClick={exportKb} type="button"><i className="ti ti-download" aria-hidden="true" /> Export JSON</button>
          </div>
        </div>
      </div>

      {bundle ? <BundleCard bundleRows={workspace.bundles.filter((row) => String(row.bundle_id) === id)} math={math} productId={id} products={workspace.products} /> : null}

      <div className={s.kbHead}><h3>Knowledge base</h3>{bundle ? <span className={s.muted}>Includes items from the products inside this bundle</span> : null}</div>
      <div className={s.kbGrid}>
        {KINDS.map(({ kind, title, one, icon, key }) => <KnowledgeCard icon={icon} key={kind} kind={kind} one={one} productId={id} rows={knowledgeFor(workspace[key], id, memberIds)} title={title} workspace={workspace} />)}
      </div>
    </section>
  );
}

function BundleCard({ bundleRows, math, productId, products }: { bundleRows: ApiRecord[]; math: ReturnType<typeof bundleMath>; productId: string; products: ApiRecord[] }) {
  const [pending, start] = useTransition();
  const options = products.filter((row) => String(row.id) !== productId && !math.memberIds.includes(String(row.id)));
  return (
    <section aria-label="Bundle contents" className={s.bundle}>
      <div className={s.bundleStats}>
        <div><span>Products inside</span><b>{math.members.length}</b></div>
        <div><span>Bought separately</span><b>{rupiah(math.subtotal)}</b></div>
        <div><span>Saving</span><b>{math.saving}%</b></div>
      </div>
      <ul className={s.members}>
        {bundleRows.map((row) => {
          const item = products.find((p) => String(p.id) === String(row.item_id));
          return (
            <li key={String(row.id)}>
              <span>{text(item?.nama) || "Unknown product"}</span><b>{rupiah(item?.harga)}</b>
              <button aria-label={`Remove ${text(item?.nama) || "product"} from bundle`} className={s.iconButton} disabled={pending} onClick={async () => { if (await confirmAction({ title: `Remove ${text(item?.nama) || "this product"} from the bundle?`, confirmLabel: "Remove from bundle", danger: true })) start(() => guard(async () => { await deleteProductKnowledgeAction("bundle", String(row.id)); }, "Could not delete the item.")); }} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
            </li>
          );
        })}
      </ul>
      {options.length ? (
        <form className={s.inlineForm} onSubmit={(event) => { event.preventDefault(); const fd = new FormData(event.currentTarget); void guard(() => createProductKnowledgeAction("bundle", productId, fd), "Could not add the product to the bundle."); }}>
          <label className={s.grow}><span className="sr-only">Product to add</span><select className={s.input} name="parent_id" required>{options.map((p) => <option key={String(p.id)} value={String(p.id)}>{text(p.nama)} · {rupiah(p.harga)}</option>)}</select></label>
          <Button size="sm" type="submit"><i className="ti ti-plus" aria-hidden="true" /> Add to bundle</Button>
        </form>
      ) : null}
    </section>
  );
}

function KnowledgeCard({ kind, title, one, icon, rows, productId, workspace }: { kind: Kind; title: string; one: string; icon: string; rows: ApiRecord[]; productId: string; workspace: Workspace }) {
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState(false);
  const [pending, start] = useTransition();
  const ownParents = kind === "feature" ? workspace.features.filter((row) => String(row.product_id) === productId) : kind === "subProduct" ? workspace.subProducts.filter((row) => String(row.product_id) === productId) : [];
  async function remove(row: ApiRecord) {
    const table = kind === "feature" ? "product_features" : kind === "subProduct" ? "sub_products" : "";
    const ok = table
      ? await confirmDelete({ recordKey: table, ids: [String(row.id)], title: `Delete this ${one}?`, confirmLabel: "Delete item", message: "It is removed from the product knowledge base." })
      : await confirmAction({ title: `Delete this ${one}?`, message: "It is removed from the product knowledge base. This cannot be undone.", confirmLabel: "Delete item", danger: true });
    if (!ok) return;
    start(() => guard(async () => { await deleteProductKnowledgeAction(kind, String(row.id)); }, "Could not delete the item."));
  }
  const linksOf = (row: ApiRecord) => kind === "feature" ? workspace.featureLinks.filter((l) => String(l.feature_id) === String(row.id)) : kind === "subProduct" ? workspace.subProductLinks.filter((l) => String(l.sub_product_id) === String(row.id)) : [];

  return (
    <section aria-label={title} className={s.kbCard}>
      <header className={s.kbCardHead}>
        <span className={s.kbIcon} aria-hidden="true"><i className={`ti ${icon}`} /></span>
        <h4>{title}</h4><span className={s.count}>{rows.length}</span>
        <button aria-expanded={adding} aria-label={`Add ${one}`} className={s.iconButton} onClick={() => setAdding((v) => !v)} type="button"><i className={`ti ${adding ? "ti-x" : "ti-plus"}`} aria-hidden="true" /></button>
      </header>
      {adding ? <KnowledgeForm kind={kind} one={one} onDone={() => setAdding(false)} productId={productId} /> : null}
      {rows.length ? (
        <ul className={s.kbItems}>
          {rows.map((row) => (
            <li key={String(row.id)}>
              <div className={s.kbText}>
                <b>{text(row.nama || row.name || row.tipe) || one}</b>
                {text(row.text || row.description || row.isi || row.url) ? <p>{text(row.text || row.description || row.isi || row.url)}</p> : null}
                {kind === "subProduct" && row.harga ? <small>{rupiah(row.harga)}</small> : null}
                {kind === "asset" && text(row.status) ? <small>{text(row.tipe)} · {text(row.status)}</small> : null}
                {linksOf(row).length ? <span className={s.kbLinks}>{linksOf(row).map((l) => <a href={text(l.url)} key={String(l.id)} rel="noreferrer" target="_blank"><i className="ti ti-link" aria-hidden="true" /> {text(l.nama) || "Link"}</a>)}</span> : null}
              </div>
              <button aria-label={`Delete ${one}`} className={s.iconDanger} disabled={pending} onClick={() => remove(row)} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      ) : !adding ? <button className={s.kbEmpty} onClick={() => setAdding(true)} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add {one}</button> : null}
      {ownParents.length ? (linking ? <LinkForm kind={kind === "feature" ? "featureLink" : "subLink"} onDone={() => setLinking(false)} parents={ownParents} productId={productId} /> : <button className={s.linkButton} onClick={() => setLinking(true)} type="button"><i className="ti ti-link" aria-hidden="true" /> Add {kind === "feature" ? "feature" : "sub-product"} link</button>) : null}
    </section>
  );
}

function KnowledgeForm({ kind, one, productId, onDone }: { kind: Kind; one: string; productId: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [invalid, setInvalid] = useState("");
  const action = createProductKnowledgeAction.bind(null, kind, productId);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; const fd = new FormData(form);
    const required = kind === "feedback" ? "text" : "nama";
    if (!text(fd.get(required)).trim()) { setInvalid(required); (form.elements.namedItem(required) as HTMLElement | null)?.focus(); return; }
    start(async () => { try { await action(fd); form.reset(); onDone(); } catch (error) { notifyError(error, `Could not add the ${one}.`); } });
  }
  const cls = (name: string) => (invalid === name ? s.inputInvalid : s.input);
  const clear = (name: string) => () => { if (invalid === name) setInvalid(""); };
  return (
    <form className={s.kbForm} noValidate onSubmit={submit}>
      {kind === "feedback" ? (
        <div className={s.row2}>
          <label className={s.field}><span>Type</span><select className={s.input} name="tipe"><option value="Positif">Positive</option><option>Improvement</option><option>Bug/Error</option><option>Complaint</option></select></label>
          <label className={s.field}><span>Date label</span><input className={s.input} name="tanggal" placeholder="e.g. Oct 2026" /></label>
        </div>
      ) : kind === "asset" ? (
        <>
          <label className={s.field}><span>Name <b className={s.req}>*</b></span><input aria-invalid={invalid === "nama" || undefined} className={cls("nama")} name="nama" onInput={clear("nama")} /></label>
          <div className={s.row2}>
            <label className={s.field}><span>Type</span><select className={s.input} name="tipe"><option>Link</option><option>Google Drive</option><option>Notion</option><option>YouTube Private</option><option>Canva</option><option>Figma</option><option value="Lainnya">Other</option></select></label>
            <label className={s.field}><span>Status</span><select className={s.input} name="status"><option>Live</option><option>Draft</option><option>Archived</option></select></label>
          </div>
          <label className={s.field}><span>URL</span><input className={s.input} name="url" placeholder="https://…" type="url" /></label>
        </>
      ) : (
        <label className={s.field}><span>{one[0].toUpperCase() + one.slice(1)} <b className={s.req}>*</b></span><input aria-invalid={invalid === "nama" || undefined} autoFocus className={cls("nama")} name="nama" onInput={clear("nama")} /></label>
      )}
      {kind !== "asset" && kind !== "subProduct" ? <label className={s.field}><span>Description{kind === "feedback" ? <b className={s.req}> *</b> : null}</span><textarea aria-invalid={invalid === "text" || undefined} autoFocus={kind === "feedback"} className={cls("text")} name="text" onInput={clear("text")} rows={2} /></label> : null}
      {kind === "subProduct" ? <label className={s.field}><span>Price</span><MoneyInput className={s.input} name="harga" /></label> : null}
      <div className={s.formActions}><button className={s.ghostSm} onClick={onDone} type="button">Cancel</button><Button disabled={pending} size="sm" type="submit">Add {one}</Button></div>
    </form>
  );
}

function LinkForm({ kind, productId, parents, onDone }: { kind: "featureLink" | "subLink"; productId: string; parents: ApiRecord[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  const action = createProductKnowledgeAction.bind(null, kind, productId);
  return (
    <form className={s.kbForm} onSubmit={(event) => { event.preventDefault(); const fd = new FormData(event.currentTarget); start(() => guard(async () => { await action(fd); onDone(); }, "Could not add the link.")); }}>
      <label className={s.field}><span>{kind === "featureLink" ? "Feature" : "Sub-product"}</span><select className={s.input} name="parent_id">{parents.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name || row.nama)}</option>)}</select></label>
      <div className={s.row2}>
        <label className={s.field}><span>Label</span><input className={s.input} name="nama" /></label>
        <label className={s.field}><span>URL <b className={s.req}>*</b></span><input className={s.input} name="url" required type="url" /></label>
      </div>
      <div className={s.formActions}><button className={s.ghostSm} onClick={onDone} type="button">Cancel</button><Button disabled={pending} size="sm" type="submit">Add link</Button></div>
    </form>
  );
}

function DuplicateProduct({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [invalid, setInvalid] = useState(false);
  if (!open) return <button className={s.ghostButton} onClick={() => setOpen(true)} type="button"><i className="ti ti-copy" aria-hidden="true" /> Duplicate</button>;
  return (
    <form className={s.inlineForm} noValidate onSubmit={(event) => { event.preventDefault(); const fd = new FormData(event.currentTarget); if (!text(fd.get("name")).trim()) { setInvalid(true); (event.currentTarget.elements.namedItem("name") as HTMLElement | null)?.focus(); return; } start(() => guard(async () => { await duplicateProductAction(fd); setOpen(false); }, "Could not duplicate the product.")); }}>
      <input name="product_id" type="hidden" value={productId} />
      <label className={s.grow}><span className="sr-only">New product name</span><input aria-invalid={invalid || undefined} autoFocus className={invalid ? s.inputInvalid : s.input} name="name" onInput={() => setInvalid(false)} placeholder="New product name *" /></label>
      <Button disabled={pending} size="sm" type="submit">Duplicate product and KB</Button>
      <button aria-label="Cancel duplicate" className={s.iconButton} onClick={() => setOpen(false)} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
    </form>
  );
}

function AddProductDialog({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [invalid, setInvalid] = useState(false);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; const fd = new FormData(form);
    if (!text(fd.get("nama")).trim()) { setInvalid(true); (form.elements.namedItem("nama") as HTMLElement | null)?.focus(); return; }
    start(async () => { try { await createManagedRecord("products", fd); onClose(); } catch (error) { notifyError(error, "Could not save the product."); } });
  }
  // A bundle is a product with type "bundling", so one form covers both.
  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose(); }} open>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader><DialogTitle>Add product</DialogTitle><DialogDescription>Fields marked * are required. Add bundle contents after saving.</DialogDescription></DialogHeader>
        <form className={s.dialogForm} id="add-product" noValidate onSubmit={submit}>
          <label className={s.field}><span>Name <b className={s.req}>*</b></span><input aria-invalid={invalid || undefined} autoFocus className={invalid ? s.inputInvalid : s.input} name="nama" onInput={() => setInvalid(false)} /></label>
          <div className={s.row2}>
            <label className={s.field}><span>Type</span><select className={s.input} defaultValue="satuan" name="type"><option value="satuan">Single product</option><option value="bundling">Bundle</option></select></label>
            <label className={s.field}><span>Status</span><select className={s.input} defaultValue="Draft" name="status">{STATUSES.map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className={s.field}><span>Classification</span><input className={s.input} name="kategori" /></label>
            <label className={s.field}><span>Price</span><MoneyInput className={s.input} name="harga" /></label>
          </div>
          <label className={s.field}><span>Landing page URL</span><input className={s.input} name="link" placeholder="https://…" /></label>
          <label className={s.field}><span>Description</span><textarea className={s.input} name="deskripsi" rows={3} /></label>
        </form>
        <DialogFooter sticky><Button onClick={onClose} type="button" variant="outline">Cancel</Button><Button disabled={pending} form="add-product" type="submit">Save product</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
