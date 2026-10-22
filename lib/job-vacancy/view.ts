// Job Vacancy MT rules (IJIS layout, Oct 2026). Pure: tested under `node --test`.
// "months" holds the opening months (1–12) of a vacancy; "created_at" is when it was added.

type Row = Record<string, unknown>;

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEK_RANGES = ["1–7", "8–14", "15–21", "22–31"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }

export function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) { try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* fall through */ } }
    return trimmed ? trimmed.split(/[;,|]/).map((item) => item.trim()).filter(Boolean) : [];
  }
  return [];
}
export function monthsOf(row: Row) { return [...new Set(list(row.months).map(Number).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b); }
export function toDate(value: unknown) { if (!value) return null; const d = value instanceof Date ? value : new Date(String(value)); return Number.isFinite(d.getTime()) ? d : null; }
/** Week of the month as the team counts it: 1–7, 8–14, 15–21, 22–end. */
export function weekOfMonth(d: Date) { const day = d.getDate(); return day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4; }
export function fmtShort(d: Date) { return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`; }

export function industryOf(row: Row) { return text(row.industry) || "Lainnya"; }

export function vacancySummary(rows: Row[], now: Date) {
  const month = now.getMonth() + 1;
  return {
    total: rows.length,
    openNow: rows.filter((row) => monthsOf(row).includes(month)).length,
    addedThisWeek: rows.filter((row) => { const c = toDate(row.created_at); return c && c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth() && weekOfMonth(c) === weekOfMonth(now); }).length,
    companies: new Set(rows.map((row) => text(row.company).toLowerCase()).filter(Boolean)).size,
  };
}

/** Vacancies opening in each month of a year. */
export function openingsByMonth(rows: Row[], year: string) {
  const counts = Array<number>(12).fill(0);
  rows.forEach((row) => { if (text(row.year) !== year) return; monthsOf(row).forEach((m) => { counts[m - 1] += 1; }); });
  return counts;
}

/** Industries ranked by distinct companies; "open" counts companies opening in the given month. */
export function industryRanking(rows: Row[], month: number) {
  const map = new Map<string, { companies: Set<string>; open: Set<string> }>();
  rows.forEach((row) => {
    const key = industryOf(row); const entry = map.get(key) || { companies: new Set<string>(), open: new Set<string>() };
    entry.companies.add(text(row.company)); if (monthsOf(row).includes(month)) entry.open.add(text(row.company));
    map.set(key, entry);
  });
  return [...map.entries()].map(([name, e]) => ({ name, companies: e.companies.size, open: e.open.size })).sort((a, b) => b.companies - a.companies || a.name.localeCompare(b.name));
}

export type VacancyFilter = { query?: string; industry?: string; month?: string; year?: string };
export function filterVacancies<T extends Row>(rows: T[], f: VacancyFilter): T[] {
  const q = text(f.query).toLowerCase();
  return rows.filter((row) => (!q || `${text(row.company)} ${text(row.program)}`.toLowerCase().includes(q))
    && (!f.industry || industryOf(row) === f.industry)
    && (!f.month || monthsOf(row).includes(Number(f.month)))
    && (!f.year || text(row.year) === f.year));
}

/** Newsletter: added in that month/week, opening in that month, optional industries. */
export function newsletterRows<T extends Row>(rows: T[], month: number, year: number, week: number, industries: string[]) {
  return rows.filter((row) => {
    const created = toDate(row.created_at);
    return Boolean(created) && created!.getMonth() === month && created!.getFullYear() === year && weekOfMonth(created!) === week
      && monthsOf(row).includes(month + 1) && (!industries.length || industries.includes(text(row.industry)));
  });
}

/** Company → programs → yearly history, and whether a program's opening months changed between years. */
export function companyHistory<T extends Row>(rows: T[]) {
  const map = new Map<string, { industry: string; programs: Map<string, T[]> }>();
  rows.forEach((row) => {
    const company = text(row.company); const entry = map.get(company) || { industry: text(row.industry), programs: new Map<string, T[]>() };
    entry.industry = text(row.industry) || entry.industry;
    entry.programs.set(text(row.program), [...(entry.programs.get(text(row.program)) || []), row]);
    map.set(company, entry);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([company, entry]) => ({
    company, industry: entry.industry,
    programs: [...entry.programs.entries()].map(([program, history]) => {
      const sorted = [...history].sort((a, b) => Number(a.year) - Number(b.year));
      const sets = sorted.map((row) => monthsOf(row).join(","));
      return { program, history: sorted, patternChanged: sorted.length > 1 && sets.some((set) => set !== sets[0]) };
    }),
  }));
}
