// Customer Knowledge (pain points) through Claude access: one set of rules for preview and apply.
// A pain point is a comment in the customer's own words. Same comment (ignoring case, spaces
// and punctuation) on the same platform = the same pain point: it is not added twice, only its
// empty fields are filled and missing labels are added. Nothing is changed that a person wrote,
// and nothing is deleted. Platform and category must be ones the module already has.

import { MONTH_VALUES } from "./view.ts";

export const MAX_PAIN_POINTS = 200;

const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ID_MONTHS = MONTH_VALUES.map((m) => m.toLowerCase());

export type ExistingPainPoint = { id: string; komentar: string; platform: string; kategori: string; username: string; bulan: string; source_url: string; notes: string; labels: string[] };
export type PainItem = {
  action: "add" | "update" | "unchanged" | "invalid";
  id?: string; comment: string;
  set: Record<string, string>; addLabels: string[]; labels: string[];
  errors: string[];
};

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown, max = 300) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "").slice(0, max);
/** "Susah cari loker!!" and "susah  cari loker" are the same comment. */
export const commentKey = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** "Okt", "oct", "October", 10, "2026-10-12" → "Okt" (the module's month words). */
export function monthValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const text = str(value).toLowerCase();
  const iso = /^\d{4}-(\d{2})/.exec(text);
  const number = iso ? Number(iso[1]) : /^\d{1,2}$/.test(text) ? Number(text) : 0;
  if (number >= 1 && number <= 12) return MONTH_VALUES[number - 1];
  const short = text.slice(0, 3);
  const index = ID_MONTHS.indexOf(short) > -1 ? ID_MONTHS.indexOf(short) : EN_MONTHS.indexOf(short) > -1 ? EN_MONTHS.indexOf(short) : ["agt", "ags"].includes(short) ? 7 : -1;
  return index > -1 ? MONTH_VALUES[index] : "";
}

function pick(value: string, allowed: string[]) {
  return allowed.find((item) => item.toLowerCase() === value.toLowerCase()) || "";
}

export function planPainPoints(raws: unknown[], existing: ExistingPainPoint[], platforms: string[], categories: string[]): PainItem[] {
  const byKey = new Map(existing.map((row) => [`${row.platform.toLowerCase()}|${commentKey(row.komentar)}`, row]));
  const seen = new Set<string>();
  return raws.map((raw) => {
    const errors: string[] = [];
    if (!isRecord(raw)) return { action: "invalid", comment: "", set: {}, addLabels: [], labels: [], errors: ["Each pain point must be an object."] };
    const comment = str(raw.comment ?? raw.komentar, 3000);
    if (!comment) errors.push("comment is required.");
    const platformGiven = str(raw.platform, 80);
    const platform = pick(platformGiven, platforms);
    if (!platformGiven) errors.push("platform is required.");
    else if (!platform) errors.push(`platform "${platformGiven}" is not in Customer Knowledge. Use one of: ${platforms.join(", ")}.`);
    const categoryGiven = str(raw.category ?? raw.kategori, 80);
    const category = pick(categoryGiven, categories);
    if (!categoryGiven) errors.push("category is required.");
    else if (!category) errors.push(`category "${categoryGiven}" is not in Customer Knowledge. Use one of: ${categories.join(", ")}.`);
    const monthGiven = raw.month ?? raw.bulan ?? raw.date;
    const month = monthValue(monthGiven);
    if (!month) errors.push(monthGiven ? `month "${str(monthGiven)}" is not a month (use 1–12, Okt/Oct or a date).` : "month is required.");
    const sourceUrl = str(raw.source_url, 500);
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) errors.push("source_url must start with https://.");
    const labels = [...new Set((Array.isArray(raw.labels) ? raw.labels : []).map((label) => str(label, 40)).filter(Boolean))].slice(0, 12);
    const key = `${platform.toLowerCase()}|${commentKey(comment)}`;
    if (comment && platform && seen.has(key)) errors.push("This comment is listed twice in the request.");
    if (comment && platform) seen.add(key);
    if (errors.length) return { action: "invalid", comment, set: {}, addLabels: [], labels, errors };
    const values: Record<string, string> = { komentar: comment, platform, kategori: category, bulan: month, username: str(raw.username, 120), source_url: sourceUrl, notes: str(raw.notes, 2000) };
    const row = byKey.get(key);
    if (!row) return { action: "add", comment, set: Object.fromEntries(Object.entries(values).filter(([, value]) => value)), addLabels: labels, labels, errors: [] };
    // The same pain point: only what is still empty, and labels it does not have yet.
    const set: Record<string, string> = {};
    for (const field of ["username", "source_url", "notes"] as const) if (values[field] && !row[field]) set[field] = values[field];
    const have = new Set(row.labels.map((label) => label.toLowerCase()));
    const addLabels = labels.filter((label) => !have.has(label.toLowerCase()));
    return { action: Object.keys(set).length || addLabels.length ? "update" : "unchanged", id: row.id, comment: row.komentar, set, addLabels, labels: [...row.labels, ...addLabels], errors: [] };
  });
}

export function summarisePainPoints(items: PainItem[]) {
  const count = (action: string) => items.filter((item) => item.action === action).length;
  return { added: count("add"), updated: count("update"), unchanged: count("unchanged"), invalid: count("invalid") };
}
