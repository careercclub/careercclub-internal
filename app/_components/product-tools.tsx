"use client";

import { duplicateProductAction } from "@/app/actions/product-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useState } from "react";
import styles from "../record-manager.module.css";

type Workspace = {
  products: ApiRecord[]; painPoints: ApiRecord[]; passionPoints: ApiRecord[];
  benefits: ApiRecord[]; features: ApiRecord[]; featureLinks: ApiRecord[];
  bundles: ApiRecord[]; subProducts: ApiRecord[]; subProductLinks: ApiRecord[];
};

function belongs(rows: ApiRecord[], productIds: Set<string>) {
  return rows.filter((row) => productIds.has(String(row.product_id)));
}

export function ProductTools({ workspace }: { workspace: Workspace }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("name");
  const visible = useMemo(() => [...workspace.products]
    .filter((product) => !query || `${product.nama} ${product.kategori}`.toLowerCase().includes(query.toLowerCase()))
    .filter((product) => !status || String(product.status) === status)
    .sort((left, right) => sort === "price"
      ? Number(right.harga || 0) - Number(left.harga || 0)
      : String(left.nama || "").localeCompare(String(right.nama || ""))), [workspace.products, query, status, sort]);

  function exportJson() {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ccc-products-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.toolStack}>
      <div className={styles.filterBar}>
        <input aria-label="Search products" placeholder="Search product or classification" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Product status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option>Active</option><option>Draft</option><option>Archived</option></select>
        <select aria-label="Sort products" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Name</option><option value="price">Highest price</option></select>
        <button className={styles.secondaryButton} type="button" onClick={exportJson}><i className="ti ti-download" /> Export JSON</button>
      </div>
      <div className={styles.summaryGrid}>
        {visible.map((product) => {
          const productIds = new Set([String(product.id)]);
          workspace.bundles.filter((bundle) => String(bundle.bundle_id) === String(product.id)).forEach((bundle) => productIds.add(String(bundle.item_id)));
          const features = belongs(workspace.features, productIds);
          return <article key={String(product.id)}><header><strong>{String(product.nama || "Untitled")}</strong><span>{String(product.status || "Draft")}</span></header><p>{String(product.deskripsi || "No description")}</p><footer><span>{belongs(workspace.painPoints, productIds).length} pain points</span><span>{belongs(workspace.passionPoints, productIds).length} passion points</span><span>{belongs(workspace.benefits, productIds).length} benefits</span><span>{features.length} features</span></footer></article>;
        })}
      </div>
      <details className={styles.createPanel}>
        <summary><i className="ti ti-copy" /> Duplicate product and knowledge base</summary>
        <form action={duplicateProductAction} className={styles.formGrid}>
          <label className={styles.field}><span>Source product</span><select name="product_id" required><option value="">Select...</option>{workspace.products.map((product) => <option value={String(product.id)} key={String(product.id)}>{String(product.nama || product.id)}</option>)}</select></label>
          <label className={styles.field}><span>Duplicate name</span><input name="name" required /></label>
          <button className={styles.primaryButton} type="submit">Duplicate</button>
        </form>
      </details>
    </div>
  );
}
