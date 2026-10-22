// Talent Pool list rules (IJIS layout, Oct 2026). Pure: tested under `node --test`.
// One "buyer" rule shared by the directory, the profile and Email blast segments.

type Row = Record<string, unknown>;

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }

export function isBuyer(row: Row) { return Boolean(row.buyer_match) || Boolean(text(row.produk_dibeli)); }

/** Comma-separated multi-value fields such as target_mt and posisi_mt. */
export function splitList(value: unknown) { return text(value).split(",").map((item) => item.trim()).filter(Boolean); }

export type CandidateFilter = { query?: string; pipeline?: "" | "buyers" | "prospects"; status?: string; source?: string; tier?: string };

export function filterCandidates<T extends Row>(rows: T[], f: CandidateFilter): T[] {
  const q = text(f.query).toLowerCase();
  return rows.filter((row) => {
    if (q && !`${text(row.nama)} ${text(row.email)} ${text(row.wa)} ${text(row.universitas)} ${text(row.linkedin)}`.toLowerCase().includes(q)) return false;
    if (f.pipeline === "buyers" && !isBuyer(row)) return false;
    if (f.pipeline === "prospects" && isBuyer(row)) return false;
    if (f.status && text(row.status) !== f.status) return false;
    if (f.source && text(row.sumber) !== f.source) return false;
    if (f.tier && text(row.campus_tier) !== f.tier) return false;
    return true;
  });
}

function top(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || null;
}

/** Numbers for the page header and the "pool at a glance" panel. */
export function poolSummary(rows: Row[]) {
  const buyers = rows.filter(isBuyer).length;
  return {
    total: rows.length,
    buyers,
    prospects: rows.length - buyers,
    withEmail: rows.filter((row) => text(row.email).includes("@")).length,
    topUniversity: top(rows.map((row) => text(row.universitas))),
    topTarget: top(rows.flatMap((row) => splitList(row.target_mt))),
    topCity: top(rows.map((row) => text(row.domisili))),
  };
}
