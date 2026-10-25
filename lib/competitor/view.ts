// Competitor Intel rules (IJIS layout, Oct 2026). Pure: tested under `node --test`.
// Threat comes from the newest snapshot when there is one, else from the profile.

type Row = Record<string, unknown>;
export type Threat = "high" | "medium" | "low" | "";

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }

export function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter((item) => item.trim());
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) { try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* fall through */ } }
    return trimmed ? trimmed.split("|").map((item) => item.trim()).filter(Boolean) : [];
  }
  return [];
}
export function parseObj(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string" && value.trim().startsWith("{")) { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } }
  return {};
}
export function fmtN(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return text(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
export function followers(row: Row, platform: string) { return Number(parseObj(row.followers)[platform] || 0); }

export const CATEGORY_LABEL: Record<string, string> = { direct: "Direct", indirect: "Indirect", substitusi: "Substitute" };

export function threatOf(profile: Row, snapshots: Row[]): Threat {
  const id = text(profile.id);
  const latest = snapshots.filter((s) => text(s.competitor_id) === id).sort((a, b) => text(b.snapshot_date).localeCompare(text(a.snapshot_date)))[0];
  const value = (text(latest?.threat_level) || text(profile.threat_level)).toLowerCase();
  return value === "high" || value === "medium" || value === "low" ? value : "";
}

export type CompetitorFilter = { query?: string; category?: string; threat?: Threat | ""; audience?: string; sort?: "" | "name" | "ig" | "tt" | "yt" };

export function filterCompetitors<T extends Row>(rows: T[], snapshots: Row[], f: CompetitorFilter): T[] {
  const q = text(f.query).toLowerCase();
  const out = rows.filter((row) => (!q || `${text(row.name)} ${text(row.niche)}`.toLowerCase().includes(q))
    && (!f.category || text(row.category) === f.category)
    && (!f.threat || threatOf(row, snapshots) === f.threat)
    && (!f.audience || list(row.target_audience).includes(f.audience)));
  const by = { ig: "Instagram", tt: "TikTok", yt: "YouTube" } as const;
  if (f.sort === "name") return [...out].sort((a, b) => text(a.name).localeCompare(text(b.name)));
  if (f.sort && f.sort in by) { const p = by[f.sort as keyof typeof by]; return [...out].sort((a, b) => followers(b, p) - followers(a, p)); }
  return out;
}

export function competitorSummary(rows: Row[], snapshots: Row[], flags: Row[]) {
  const threat = { high: 0, medium: 0, low: 0, none: 0 };
  rows.forEach((row) => { const t = threatOf(row, snapshots); threat[t || "none"] += 1; });
  const category = Object.fromEntries(Object.keys(CATEGORY_LABEL).map((key) => [key, rows.filter((row) => text(row.category) === key).length]));
  return { total: rows.length, threat, category, flags: flags.length };
}

/** Latest price per product (price history first, else the product's own price), grouped by category, cheapest first. */
export function priceBoard(products: Row[], prices: Row[]) {
  const latest = (product: Row) => {
    const rows = prices.filter((p) => text(p.product_id) === text(product.id)).sort((a, b) => text(b.recorded_at).localeCompare(text(a.recorded_at)));
    // The tables keep price_min / price_max; price and harga are older names.
    const row = rows[0] || product;
    return Number(row.price_min ?? row.price ?? row.harga ?? 0) || 0;
  };
  const groups = new Map<string, Array<{ product: Row; price: number }>>();
  products.forEach((product) => { const key = text(product.kategori) || text(product.category) || "Other"; groups.set(key, [...(groups.get(key) || []), { product, price: latest(product) }]); });
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([category, items]) => {
    const sorted = [...items].sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    const priced = sorted.filter((i) => i.price > 0).map((i) => i.price);
    return { category, items: sorted, min: priced.length ? Math.min(...priced) : 0, max: priced.length ? Math.max(...priced) : 0 };
  });
}
