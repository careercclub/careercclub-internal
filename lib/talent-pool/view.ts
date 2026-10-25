// Talent Pool list rules (IJIS layout, Oct 2026). Pure: tested under `node --test`.
// One "buyer" rule shared by the directory, the profile and Email blast segments.

type Row = Record<string, unknown>;

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }

export function isBuyer(row: Row) { return Boolean(row.buyer_match) || Boolean(text(row.produk_dibeli)); }

/** Comma-separated multi-value fields such as target_mt and posisi_mt. */
export function splitList(value: unknown) { return text(value).split(",").map((item) => item.trim()).filter(Boolean); }

/* ── Facets: one definition for the filters, the profile and Analytics ──
 * The Google Form answers are in Indonesian and vary in spelling; each facet turns the stored value
 * into one English option ("Aktif berkuliah" → "Student", "S1" → "Bachelor's (S1)", "3,62" → "3.51–3.75"). */

const lower = (value: unknown) => text(value).toLowerCase();
const yesNo = (value: unknown) => { const v = lower(value); return !v ? "" : /^(yes|ya|y\b|iya|sudah|pernah)/.test(v) ? "Yes" : /^(no|tidak|tdk|belum|n\b)/.test(v) ? "No" : text(value); };

export function statusLabel(value: unknown) {
  const v = lower(value);
  if (!v) return "";
  if (/kuliah|student|mahasiswa/.test(v)) return "Student";
  if (/fresh/.test(v)) return "Fresh graduate";
  if (/kerja|working|switch|employ/.test(v)) return "Working, career switch";
  return text(value);
}
export function educationLabel(value: unknown) {
  const v = lower(value).replace(/\s+/g, "");
  return ({ s1: "Bachelor's (S1)", s2: "Master's (S2)", s3: "Doctorate (S3)", d3: "Diploma (D3)", d4: "Applied bachelor's (D4)", sma: "High school", smk: "High school" } as Record<string, string>)[v] || text(value);
}
export function tierLabel(value: unknown) {
  const v = lower(value);
  const tier = /tier\s*(\d)/.exec(v);
  return tier ? `Tier ${tier[1]}` : /non|^x\b|^x\//.test(v) ? "Non-priority" : text(value);
}
export function orgLabel(value: unknown) {
  const v = lower(value);
  return !v ? "" : /leader|ketua/.test(v) ? "Leader" : /member|anggota/.test(v) ? "Member" : /^(no|tidak|belum)/.test(v) ? "No" : text(value);
}
export const GRADE_BANDS = ["3.76–4.00", "3.51–3.75", "3.26–3.50", "3.00–3.25", "Below 3.00"];
/** IPK → band ("3,62" and "3.62" alike). Not a GPA on a 4 scale → "". */
export function gradeBand(value: unknown) {
  const n = Number(text(value).replace(",", "."));
  if (!text(value) || !Number.isFinite(n) || n <= 0 || n > 4) return "";
  return n > 3.75 ? GRADE_BANDS[0] : n > 3.5 ? GRADE_BANDS[1] : n > 3.25 ? GRADE_BANDS[2] : n >= 3 ? GRADE_BANDS[3] : GRADE_BANDS[4];
}
export function cityLabel(value: unknown) {
  return text(value).replace(/\s+/g, " ").toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
}
const year = (value: unknown) => /(19|20)\d{2}/.exec(text(value))?.[0] || "";

export type Facet = { key: string; label: string; field: string; value: (value: unknown) => string; order?: "count" | "year" | "fixed"; fixed?: string[] };
export const FACETS: Facet[] = [
  { key: "status", label: "Status", field: "status", value: statusLabel },
  { key: "city", label: "City", field: "domisili", value: cityLabel },
  { key: "relocate", label: "Willing to relocate", field: "relocate", value: yesNo, order: "fixed", fixed: ["Yes", "No"] },
  { key: "education", label: "Education", field: "pendidikan", value: educationLabel },
  { key: "tier", label: "Campus tier", field: "campus_tier", value: tierLabel, order: "fixed", fixed: ["Tier 1", "Tier 2", "Tier 3", "Non-priority"] },
  { key: "grade", label: "Grade", field: "ipk", value: gradeBand, order: "fixed", fixed: GRADE_BANDS },
  { key: "intake", label: "Intake year", field: "angkatan", value: year, order: "year" },
  { key: "graduation", label: "Graduation year", field: "tahun_lulus", value: year, order: "year" },
  { key: "org", label: "Org Exp", field: "organisasi", value: orgLabel, order: "fixed", fixed: ["Leader", "Member", "No"] },
  { key: "abroad", label: "Study Abroad Exp", field: "exchange", value: yesNo, order: "fixed", fixed: ["Yes", "No"] },
  { key: "source", label: "Source", field: "sumber", value: text },
];
export const facet = (key: string) => FACETS.find((f) => f.key === key)!;
export const facetValue = (row: Row, key: string) => { const f = facet(key); return f.value(row[f.field]); };

/** Options of a facet with how many candidates have each, in a sensible order. */
export function facetOptions(rows: Row[], key: string): Array<[string, number]> {
  const f = facet(key);
  const counts = new Map<string, number>();
  for (const row of rows) { const v = f.value(row[f.field]); if (v) counts.set(v, (counts.get(v) || 0) + 1); }
  const entries = [...counts.entries()];
  if (f.order === "year") return entries.sort((a, b) => b[0].localeCompare(a[0]));
  if (f.order === "fixed") return entries.sort((a, b) => (f.fixed!.indexOf(a[0]) + 1 || 99) - (f.fixed!.indexOf(b[0]) + 1 || 99) || a[0].localeCompare(b[0]));
  return entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export type CandidateFilter = { query?: string; pipeline?: "" | "buyers" | "prospects"; facets?: Record<string, string> };

export function filterCandidates<T extends Row>(rows: T[], f: CandidateFilter): T[] {
  const q = text(f.query).toLowerCase();
  const chosen = Object.entries(f.facets || {}).filter(([, value]) => value);
  return rows.filter((row) => {
    if (q && !`${text(row.nama)} ${text(row.email)} ${text(row.wa)} ${text(row.universitas)} ${text(row.linkedin)}`.toLowerCase().includes(q)) return false;
    if (f.pipeline === "buyers" && !isBuyer(row)) return false;
    if (f.pipeline === "prospects" && isBuyer(row)) return false;
    return chosen.every(([key, value]) => facetValue(row, key) === value);
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
    topCity: top(rows.map((row) => cityLabel(row.domisili))),
  };
}
