// Product catalog rules (IJIS layout, Oct 2026). Pure: tested under `node --test`.
// A bundle is a product with type "bundling"; its knowledge base includes its members' items.
import { formatRupiah } from "../text/money.ts";

type Row = Record<string, unknown>;

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
export function isBundle(row: Row) { return (text(row.type) || "satuan") === "bundling"; }

export type ProductFilter = { query?: string; type?: "" | "satuan" | "bundling"; classification?: string; status?: string; sort?: "name" | "high" | "low" };

export function filterProducts<T extends Row>(rows: T[], f: ProductFilter): T[] {
  const q = text(f.query).toLowerCase();
  const list = rows.filter((row) => (!q || `${text(row.nama)} ${text(row.kategori)}`.toLowerCase().includes(q))
    && (!f.type || (text(row.type) || "satuan") === f.type)
    && (!f.classification || text(row.kategori) === f.classification)
    && (!f.status || (text(row.status) || "Draft") === f.status));
  const price = (row: Row) => Number(row.harga || 0);
  return [...list].sort((a, b) => f.sort === "high" ? price(b) - price(a) : f.sort === "low" ? price(a) - price(b) : text(a.nama).localeCompare(text(b.nama)));
}

export function catalogSummary(rows: Row[]) {
  return {
    total: rows.length,
    live: rows.filter((row) => text(row.status) === "Live").length,
    bundles: rows.filter(isBundle).length,
    single: rows.filter((row) => !isBundle(row)).length,
    value: rows.reduce((sum, row) => sum + Number(row.harga || 0), 0),
  };
}

/** Members of a bundle, their summed price, and the saving against the bundle price (never negative). */
export function bundleMath(bundle: Row, products: Row[], links: Row[]) {
  const id = text(bundle.id);
  const memberIds = links.filter((row) => text(row.bundle_id) === id).map((row) => text(row.item_id));
  const members = memberIds.map((memberId) => products.find((row) => text(row.id) === memberId)).filter((row): row is Row => Boolean(row));
  const subtotal = members.reduce((sum, row) => sum + Number(row.harga || 0), 0);
  const saving = subtotal > 0 ? Math.max(0, Math.round(((subtotal - Number(bundle.harga || 0)) / subtotal) * 100)) : 0;
  return { memberIds, members, subtotal, saving };
}

/** Knowledge items of a product (and, for a bundle, of every product inside it). */
export function knowledgeFor<T extends Row>(rows: T[], productId: string, memberIds: string[] = []) {
  const ids = new Set([productId, ...memberIds]);
  return rows.filter((row) => ids.has(text(row.product_id)));
}

export function rupiah(value: unknown) { return formatRupiah(value || 0) || "Rp 0"; }
