// What Job Vacancy MT shows, computed in one place so every tab counts the same way.
// Pure functions over plain rows; used by the page and by lib/mt-prospects/view.test.mjs.

import type { Opening, Prediction, ProspectStatus } from "./parse";

export type { Opening, Prediction, ProspectStatus };

export type ProspectRow = {
  id: string;
  legal_name: string;
  brand: string;
  status: ProspectStatus;
  industry: string;
  program: string;
  active_years: string;
  total_openings: number | null;
  usual_months: number[];
  openings: Record<string, Opening>;
  prediction: Partial<Prediction> | null;
  notes: string;
  exclusion_reason: string;
  source: "import" | "manual";
};
export type ContactRow = { id: string; prospect_id: string; name: string; title: string; link: string; mt_status: string; source: "import" | "manual" };

export const STATUSES: ProspectStatus[] = ["active", "predicted", "older", "excluded"];
export const STATUS_LABEL: Record<ProspectStatus, string> = { active: "Active", predicted: "Predicted", older: "Older", excluded: "Excluded" };
export const STATUS_HELP: Record<ProspectStatus, string> = {
  active: "Opening an MT programme this year.",
  predicted: "Opened last year; expected to open again.",
  older: "Only seen in earlier years.",
  excluded: "Taken off the active list (kept for reference).",
};

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTHS_SHORT = MONTHS.map((month) => month.slice(0, 3));

const compareText = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true });

/** "PT Garudafood Putra Putri Jaya Tbk" → "Garudafood Putra Putri Jaya". */
export function shortLegalName(value: string) {
  const text = String(value || "").replace(/^PT\.?\s+/i, "").replace(/,?\s+Tbk\.?$/i, "").replace(/\s*\(Persero\)/i, "").trim();
  return text || String(value || "");
}

/** The name people know: the brand, else the legal name without "PT … Tbk". */
export function displayName(prospect: Pick<ProspectRow, "brand" | "legal_name">) {
  return prospect.brand.trim() || shortLegalName(prospect.legal_name) || "Unnamed company";
}

export function sortByName<T extends Pick<ProspectRow, "brand" | "legal_name">>(rows: T[]) {
  return [...rows].sort((a, b) => compareText(displayName(a), displayName(b)));
}

export const monthsIn = (prospect: Pick<ProspectRow, "openings">, year: number | string) => prospect.openings?.[String(year)]?.months || [];

/** A year counts as "opened" when it has any month or date recorded; this year also counts every Active company. */
export function openedIn(prospect: Pick<ProspectRow, "openings" | "status">, year: number | string, currentYear: number) {
  const opening = prospect.openings?.[String(year)];
  return Boolean(opening && (opening.label || opening.dates || opening.months.length)) || (Number(year) === currentYear && prospect.status === "active");
}

/** Years worth a tab in the charts: those in the data plus this year, newest first, at most three. */
export function yearsOf(rows: Pick<ProspectRow, "openings">[], currentYear: number) {
  const years = new Set<number>([currentYear]);
  rows.forEach((row) => Object.keys(row.openings || {}).forEach((year) => { if (/^\d{4}$/.test(year) && Number(year) <= currentYear + 1) years.add(Number(year)); }));
  return [...years].sort((a, b) => b - a).slice(0, 3);
}

/** Companies opening in each month (index 0 = January) of a year. */
export function monthCounts(rows: Pick<ProspectRow, "openings">[], year: number) {
  return MONTHS.map((_, index) => rows.filter((row) => monthsIn(row, year).includes(index + 1)).length);
}

export function openIn<T extends Pick<ProspectRow, "openings" | "brand" | "legal_name">>(rows: T[], year: number, month: number) {
  return sortByName(rows.filter((row) => monthsIn(row, year).includes(month)));
}

export function industryCounts(rows: Pick<ProspectRow, "openings" | "status" | "industry">[], year: number, currentYear: number) {
  const counts = new Map<string, number>();
  rows.filter((row) => row.status !== "excluded" && openedIn(row, year, currentYear)).forEach((row) => { const key = row.industry || "Other"; counts.set(key, (counts.get(key) || 0) + 1); });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]));
}

export type Expected<T> = { row: T; scheduled: boolean; pastYears: number[] };

/**
 * Companies expected to open in the month `offset` months after the reference month:
 * scheduled for it this year, or opened in it in either of the two years before.
 * Older/excluded companies and those already open in the reference month are left out.
 */
export function expectedIn<T extends ProspectRow>(rows: T[], reference: Date, offset: number) {
  const index = reference.getMonth() + offset;
  const month = (index % 12) + 1;
  const year = reference.getFullYear() + Math.floor(index / 12);
  const openNow = new Set(rows.filter((row) => monthsIn(row, reference.getFullYear()).includes(reference.getMonth() + 1)).map((row) => row.id));
  const items: Expected<T>[] = [];
  for (const row of rows) {
    if (row.status === "older" || row.status === "excluded" || openNow.has(row.id)) continue;
    const scheduled = monthsIn(row, year).includes(month);
    const pastYears = [year - 1, year - 2].filter((past) => monthsIn(row, past).includes(month));
    if (scheduled || pastYears.length) items.push({ row, scheduled, pastYears });
  }
  items.sort((a, b) => (Number(b.scheduled) * 10 + b.pastYears.length) - (Number(a.scheduled) * 10 + a.pastYears.length) || compareText(displayName(a.row), displayName(b.row)));
  return { month, year, items };
}

/** Calendar for one month of the current year: scheduled now vs. usually opens (past two years). */
export function calendarMonth<T extends ProspectRow>(rows: T[], year: number, month: number) {
  const live = rows.filter((row) => row.status !== "older" && row.status !== "excluded");
  const scheduled = sortByName(live.filter((row) => monthsIn(row, year).includes(month)));
  const usual = sortByName(live.filter((row) => !monthsIn(row, year).includes(month) && [year - 1, year - 2].some((past) => monthsIn(row, past).includes(month))));
  return { scheduled, usual };
}

/** "Mei–Agustus 2026" — the most recent year with an opening recorded. */
export function latestOpening(prospect: Pick<ProspectRow, "openings">) {
  const years = Object.keys(prospect.openings || {}).filter((year) => prospect.openings[year]?.label || prospect.openings[year]?.months.length).sort().reverse();
  const year = years[0];
  if (!year) return "";
  const opening = prospect.openings[year];
  return `${opening.label || opening.months.map((month) => MONTHS_SHORT[month - 1]).join(", ")} ${year}`;
}

export const monthList = (months: number[]) => months.map((month) => MONTHS_SHORT[month - 1]).filter(Boolean).join(", ");

/** "3 dari 3" → "3 of 3 years". */
export function activeYearsLabel(value: string) {
  const match = /(\d+)\s*(?:dari|of|\/)\s*(\d+)/i.exec(value || "");
  return match ? `${match[1]} of ${match[2]} years` : value || "";
}

export function prospectSearchText(prospect: Pick<ProspectRow, "brand" | "legal_name" | "program" | "industry">) {
  return `${prospect.brand} ${prospect.legal_name} ${prospect.program} ${prospect.industry}`.toLowerCase();
}

export function matchesQuery(haystack: string, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word));
}

/** General recruitment inboxes are stored as contacts named "(…)"; they are not people. */
export const isPerson = (contact: Pick<ContactRow, "name">) => !contact.name.trim().startsWith("(");

export function linkKind(link: string): "linkedin" | "email" | "web" | "" {
  const text = String(link || "").trim();
  if (!text) return "";
  if (/linkedin\.com/i.test(text)) return "linkedin";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return "email";
  return "web";
}

export function linkHref(link: string) {
  const text = String(link || "").trim();
  const kind = linkKind(text);
  if (kind === "email") return `mailto:${text}`;
  if (!kind) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

/** Research placeholders ("TIDAK KETEMU", "Belum disebut di poster") read as missing. */
export function isMissing(value: unknown) {
  const text = String(value ?? "").trim();
  return !text || /^(tidak ketemu|belum disebut( di poster)?|none|n\/a|-|–)$/i.test(text);
}

/** "CV Screening > Psikotes > Interview" → ["CV Screening", "Psikotes", "Interview"]. */
export function splitSteps(value: string) {
  const parts = String(value || "").split(/\s*(?:>|→|»)\s*/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [];
}

export function initials(name: string) {
  const words = String(name || "").replace(/[()]/g, "").trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
}
