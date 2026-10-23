// CRM buyers list rules (IJIS layout, Oct 2026). Pure: tested under `node --test`.
// A "customer" is every transaction row sharing one WhatsApp number (or email when no WA).

type Row = Record<string, unknown>;

export type Transaction = { produk?: string; klasifikasi?: string; harga?: number; tanggal?: string; paymentStatus?: string };
export type Customer = Row & { _key: string; ids: string[]; transactions: Transaction[]; spend: number; txCount: number };

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }

/** Blast status values are stored in Indonesian; the funnel groups them and the UI shows English labels. */
export const CRM_STATUSES = ["Belum diblast", "Diblast", "Sedang di-upsell", "Sedang di-downsell", "Sedang di-cross sell", "Sudah convert — Upsell", "Sudah convert — Downsell", "Sudah convert — Cross sell"];
const STATUS_LABELS: Record<string, string> = {
  "Belum diblast": "Not blasted", Diblast: "Blasted",
  // Same shape as the funnel stage it belongs to ("Following up"), like "Converted · upsell".
  "Sedang di-upsell": "Following up · upsell", "Sedang di-downsell": "Following up · downsell", "Sedang di-cross sell": "Following up · cross-sell",
  "Sudah convert — Upsell": "Converted · upsell", "Sudah convert — Downsell": "Converted · downsell", "Sudah convert — Cross sell": "Converted · cross-sell",
};
export function statusLabel(value: unknown) { const v = text(value); return STATUS_LABELS[v] || v || "Not blasted"; }

export type FunnelStage = "new" | "blasted" | "followup" | "converted";
export const FUNNEL: Array<[FunnelStage, string]> = [["new", "Not blasted"], ["blasted", "Blasted"], ["followup", "Following up"], ["converted", "Converted"]];
export function funnelStage(status: unknown): FunnelStage {
  const v = text(status).toLowerCase();
  if (v.startsWith("sudah convert")) return "converted";
  if (v.startsWith("sedang")) return "followup";
  if (v === "diblast") return "blasted";
  return "new";
}

export function normalizedWa(value: unknown) {
  let digits = text(value).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`; else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

// riwayat written before the sql.json() fix is a JSON string; parse it instead of collapsing the history to one row.
function jsonRows(value: unknown): Transaction[] {
  if (typeof value === "string") { try { return jsonRows(JSON.parse(value)); } catch { return []; } }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === "string" ? jsonRows(item) : item && typeof item === "object" ? [item as Transaction] : []));
}
export function history(row: Row): Transaction[] {
  const value = jsonRows(row.riwayat);
  return value.length ? value : [{ produk: text(row.produk), klasifikasi: text(row.klasifikasi), harga: Number(row.harga || 0), tanggal: text(row.tanggal) }];
}

export function groupCustomers(rows: Row[]): Customer[] {
  const groups = new Map<string, Row[]>();
  rows.forEach((row) => { const key = normalizedWa(row.wa) || text(row.email) || text(row.id); groups.set(key, [...(groups.get(key) || []), row]); });
  return [...groups.entries()].map(([key, group]) => {
    const sorted = [...group].sort((a, b) => text(b.tanggal || b.created_at).localeCompare(text(a.tanggal || a.created_at)));
    const transactions = group.flatMap(history);
    return { ...sorted[0], _key: key, ids: group.map((row) => text(row.id)), transactions, txCount: transactions.length, spend: transactions.reduce((sum, item) => sum + Number(item.harga || 0), 0) };
  });
}

export function inTalentPool(row: Row) { return Boolean(row.talent_pool || row.talent_pool_match); }

export type CrmFilter = { query?: string; stage?: FunnelStage | ""; classification?: string; payment?: string; pool?: "" | "yes" | "no"; repeat?: "" | "repeat" | "single"; industry?: string; tahap?: string; source?: string; status?: string };

export function filterCustomers(rows: Customer[], f: CrmFilter): Customer[] {
  const q = text(f.query).toLowerCase();
  return rows.filter((row) =>
    (!q || `${text(row.name)} ${text(row.wa)} ${text(row.email)} ${text(row.produk)}`.toLowerCase().includes(q))
    && (!f.stage || funnelStage(row.status) === f.stage)
    && (!f.status || text(row.status) === f.status)
    && (!f.classification || text(row.klasifikasi) === f.classification)
    && (!f.industry || text(row.industri) === f.industry)
    && (!f.tahap || text(row.tahap) === f.tahap)
    && (!f.source || text(row.sumber) === f.source)
    && (!f.payment || (f.payment === "none" ? !text(row.payment_status) : text(row.payment_status) === f.payment))
    && (!f.pool || (f.pool === "yes") === inTalentPool(row))
    && (!f.repeat || (f.repeat === "repeat" ? row.txCount > 1 : row.txCount === 1)));
}

export function crmSummary(customers: Customer[]) {
  const funnel = Object.fromEntries(FUNNEL.map(([id]) => [id, 0])) as Record<FunnelStage, number>;
  customers.forEach((row) => { funnel[funnelStage(row.status)] += 1; });
  return {
    buyers: customers.length,
    transactions: customers.reduce((sum, row) => sum + row.txCount, 0),
    spend: customers.reduce((sum, row) => sum + row.spend, 0),
    repeat: customers.filter((row) => row.txCount > 1).length,
    notInPool: customers.filter((row) => !inTalentPool(row)).length,
    funnel,
  };
}

export function rupiah(value: number) {
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  return `Rp${Math.round(value / 1000)}k`;
}
