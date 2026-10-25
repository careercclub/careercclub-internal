// Competitor Intel through Claude access: one set of rules for preview and apply.
//   - Competitors are matched by name (case, "PT", punctuation ignored). A close but different
//     name is a possible duplicate and is skipped until match_id or as_new is given.
//   - A competitor that is there only gets its EMPTY fields filled; a different value is
//     reported as a conflict and not written. Threat level is the team's call: fill-only too.
//   - Followers are numbers that change: the newest per platform wins, and each sync keeps a
//     dated snapshot (follower history). Platforms and features are added, never removed.
//   - Flags (new product, price change, campaign…) are added once per competitor, type, date
//     and description. Products are matched by name per competitor; a new price is kept as a
//     dated price, the old prices stay. Nothing is ever deleted.

import { normalizeName } from "../mt-prospects/parse.ts";
import { similar } from "../mt-prospects/agent.ts";

export const MAX_COMPETITORS = 50;
export const CATEGORIES = ["direct", "indirect", "substitusi"] as const;
export const THREATS = ["low", "medium", "high"] as const;
export const FLAG_TYPES = ["new_product", "price_change", "new_campaign", "other"] as const;
const PROFILE_TEXT = ["category", "primary_url", "niche", "target_audience", "threat_level", "notes"] as const;
const PRODUCT_TEXT = ["category", "description", "status"] as const;

type Raw = Record<string, unknown>;
type ReadProduct = { name: string; values: Record<string, string>; min: number | null; max: number | null; priceDate: string; features: string[]; links: string[] };
export type ExistingProduct = { id: string; name: string; category: string; description: string; status: string; price_min: number | null; price_max: number | null; features: string[]; links: string[]; latestPrice: { min: number | null; max: number | null; date: string } | null };
export type ExistingCompetitor = { id: string; name: string; category: string; primary_url: string; niche: string; target_audience: string; threat_level: string; notes: string; platforms: string[]; followers: Record<string, number>; snapshotDates: string[]; flagKeys: string[]; products: ExistingProduct[] };
export type Conflict = { field: string; current: string; proposed: string };
export type ProductPlan = { action: "add" | "update" | "unchanged"; id?: string; name: string; set: Record<string, string | number>; features: string[]; links: string[]; addPrice: { min: number | null; max: number | null; date: string } | null; conflicts: Conflict[] };
export type FlagPlan = { flag_type: string; flag_date: string; description: string };
export type CompetitorItem = {
  index: number; name: string;
  action: "add" | "update" | "unchanged" | "possible_duplicate" | "invalid";
  id?: string; candidates?: Array<{ id: string; name: string }>;
  set: Record<string, string>; platforms: string[]; followers: Record<string, number>; followerChanges: Array<{ platform: string; from: number | null; to: number }>;
  snapshot: { date: string; followers: Record<string, number>; ads_active: boolean | null; notes: string } | null;
  flags: FlagPlan[]; products: ProductPlan[]; conflicts: Conflict[]; errors: string[];
};

const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown, max = 300) => (typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "").slice(0, max);
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const words = (value: string) => normalizeName(value);
const PLATFORMS: Record<string, string> = { instagram: "Instagram", ig: "Instagram", tiktok: "TikTok", youtube: "YouTube", yt: "YouTube", x: "X", twitter: "X", linkedin: "LinkedIn", website: "Website", web: "Website" };
const platformName = (value: string) => PLATFORMS[value.toLowerCase().replace(/[^a-z]/g, "")] || "";

function money(value: unknown, field: string, errors: string[]): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^\d]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) { errors.push(`${field} must be a price in rupiah, e.g. 250000.`); return null; }
  return Math.round(parsed);
}
function urlList(value: unknown, errors: string[], field: string) {
  return (Array.isArray(value) ? value : []).map((item) => str(isRecord(item) ? item.url : item, 500)).filter((url) => {
    if (!url) return false;
    if (!/^https?:\/\//i.test(url)) { errors.push(`${field}: "${url.slice(0, 40)}" must start with https://.`); return false; }
    return true;
  });
}
const union = (have: string[], add: string[]) => { const seen = new Set(have.map((v) => v.toLowerCase())); return [...have, ...add.filter((v) => !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()))]; };

/** One competitor from the request → clean values (only what was given) and its errors. */
export function readCompetitor(raw: unknown, today: string) {
  const errors: string[] = [];
  if (!isRecord(raw)) return { name: "", values: {} as Record<string, string>, platforms: [] as string[], followers: {} as Record<string, number>, snapshot: { date: today, adsActive: null as boolean | null, notes: "" }, flags: [] as FlagPlan[], products: [] as ReadProduct[], match_id: "", as_new: false, errors: ["Each competitor must be an object."] };
  const name = str(raw.name, 160);
  if (!name) errors.push("name is required.");
  const values: Record<string, string> = {};
  const category = str(raw.category).toLowerCase().replace(/^substitute$/, "substitusi");
  if (category) { if ((CATEGORIES as readonly string[]).includes(category)) values.category = category; else errors.push(`category must be direct, indirect or substitute.`); }
  const threat = str(raw.threat_level).toLowerCase();
  if (threat) { if ((THREATS as readonly string[]).includes(threat)) values.threat_level = threat; else errors.push("threat_level must be low, medium or high."); }
  const primaryUrl = str(raw.primary_url ?? raw.website, 500);
  if (primaryUrl) { if (/^https?:\/\//i.test(primaryUrl)) values.primary_url = primaryUrl; else errors.push("primary_url must start with https://."); }
  for (const field of ["niche", "notes"] as const) { const value = str(raw[field], 2000); if (value) values[field] = value; }
  const audience = Array.isArray(raw.target_audience) ? raw.target_audience.map((v) => str(v, 60)).filter(Boolean).join(" | ") : str(raw.target_audience, 500);
  if (audience) values.target_audience = audience;
  const platforms: string[] = [];
  for (const item of Array.isArray(raw.platforms) ? raw.platforms : []) { const p = platformName(str(item)); if (p && !platforms.includes(p)) platforms.push(p); else if (!p && str(item)) errors.push(`platform "${str(item)}" is not one of Instagram, TikTok, YouTube, X, LinkedIn, Website.`); }
  const followers: Record<string, number> = {};
  if (raw.followers !== undefined && !isRecord(raw.followers)) errors.push("followers must be like { \"Instagram\": 120000 }.");
  for (const [key, value] of Object.entries(isRecord(raw.followers) ? raw.followers : {})) {
    const p = platformName(key); const n = typeof value === "number" ? value : Number(String(value).replace(/[,.\s]/g, ""));
    if (!p) errors.push(`followers: "${key}" is not a platform.`); else if (!Number.isFinite(n) || n < 0) errors.push(`followers.${p} must be a number.`); else { followers[p] = Math.round(n); if (!platforms.includes(p)) platforms.push(p); }
  }
  const snapRaw = isRecord(raw.snapshot) ? raw.snapshot : {};
  const snapDate = str(snapRaw.date ?? raw.observed_at, 10) || today;
  if (!isDate(snapDate)) errors.push("snapshot.date must be YYYY-MM-DD.");
  const adsActive = typeof (snapRaw.ads_active ?? raw.ads_active) === "boolean" ? Boolean(snapRaw.ads_active ?? raw.ads_active) : null;
  const snapNotes = str(snapRaw.notes, 1000);
  const flags: FlagPlan[] = [];
  for (const f of Array.isArray(raw.flags) ? raw.flags : []) {
    if (!isRecord(f)) continue;
    const type = str(f.type ?? f.flag_type).toLowerCase(); const date = str(f.date ?? f.flag_date, 10); const description = str(f.description ?? f.text, 2000);
    const sourceUrl = str(f.source_url, 500);
    if (!description) { errors.push("flags: description is required."); continue; }
    if (!(FLAG_TYPES as readonly string[]).includes(type)) { errors.push(`flags: type must be one of ${FLAG_TYPES.join(", ")}.`); continue; }
    if (!isDate(date)) { errors.push(`flags: date "${date}" must be YYYY-MM-DD.`); continue; }
    flags.push({ flag_type: type, flag_date: date, description: sourceUrl && /^https?:\/\//i.test(sourceUrl) ? `${description}\n${sourceUrl}` : description });
  }
  const products: ReadProduct[] = [];
  for (const p of Array.isArray(raw.products) ? raw.products : []) {
    if (!isRecord(p)) continue;
    const productName = str(p.name, 160);
    if (!productName) { errors.push("products: name is required."); continue; }
    const pv: Record<string, string> = {};
    for (const field of PRODUCT_TEXT) { const value = str(p[field], field === "description" ? 2000 : 120); if (value) pv[field] = value; }
    const min = money(p.price_min ?? p.price, `products "${productName}": price_min`, errors);
    const max = money(p.price_max, `products "${productName}": price_max`, errors);
    if (min !== null && max !== null && max < min) errors.push(`products "${productName}": price_max is lower than price_min.`);
    const priceDate = str(p.price_date, 10) || today;
    if (!isDate(priceDate)) errors.push(`products "${productName}": price_date must be YYYY-MM-DD.`);
    products.push({ name: productName, values: pv, min, max: max ?? min, priceDate, features: (Array.isArray(p.features) ? p.features : []).map((f) => str(f, 160)).filter(Boolean), links: urlList(p.links, errors, `products "${productName}": links`) });
  }
  return { name, values, platforms, followers, snapshot: { date: snapDate, adsActive, notes: snapNotes }, flags, products, match_id: str(raw.match_id, 40), as_new: raw.as_new === true, errors };
}

const flagKey = (f: FlagPlan) => `${f.flag_type}|${f.flag_date}|${words(f.description)}`;

export function planCompetitors(raws: unknown[], existing: ExistingCompetitor[], today: string): CompetitorItem[] {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const seen = new Set<string>();
  return raws.slice(0, MAX_COMPETITORS).map((raw, index) => {
    const read = readCompetitor(raw, today);
    const blank: CompetitorItem = { index, name: read.name, action: "invalid", set: {}, platforms: [], followers: {}, followerChanges: [], snapshot: null, flags: [], products: [], conflicts: [], errors: [...read.errors] };
    if (read.errors.length) return blank;
    const key = words(read.name);
    if (seen.has(key)) return { ...blank, errors: ["This competitor is listed twice in the request."] };
    seen.add(key);
    let target = read.match_id ? byId.get(read.match_id) : existing.find((row) => words(row.name) === key);
    if (read.match_id && !target) return { ...blank, errors: [`match_id ${read.match_id} is not a competitor.`] };
    if (!target && !read.as_new) {
      const close = existing.filter((row) => similar(words(row.name), key));
      if (close.length) return { ...blank, action: "possible_duplicate", errors: [], candidates: close.slice(0, 5).map((row) => ({ id: row.id, name: row.name })) };
    }
    const hasFollowers = Object.keys(read.followers).length > 0;
    const snapshot = hasFollowers || read.snapshot.adsActive !== null || read.snapshot.notes ? { date: read.snapshot.date, followers: read.followers, ads_active: read.snapshot.adsActive, notes: read.snapshot.notes } : null;
    if (!target) {
      return { ...blank, action: "add", errors: [], set: { name: read.name, ...read.values }, platforms: read.platforms, followers: read.followers, snapshot, flags: dedupeFlags(read.flags, []),
        products: read.products.map((p) => ({ action: "add", name: p.name, set: { name: p.name, ...p.values, ...(p.min !== null ? { price_min: p.min, price_max: p.max ?? p.min } : {}) }, features: p.features, links: p.links, addPrice: p.min !== null ? { min: p.min, max: p.max, date: p.priceDate } : null, conflicts: [] })) };
    }
    const row = target;
    const set: Record<string, string> = {}; const conflicts: Conflict[] = [];
    for (const field of PROFILE_TEXT) {
      const value = read.values[field]; if (!value) continue;
      const current = row[field] || "";
      if (!current.trim()) set[field] = value;
      else if (words(current) !== words(value)) conflicts.push({ field, current, proposed: value });
    }
    const platforms = union(row.platforms, read.platforms);
    const followerChanges = Object.entries(read.followers).filter(([p, n]) => row.followers[p] !== n).map(([platform, to]) => ({ platform, from: row.followers[platform] ?? null, to }));
    const followers = { ...row.followers, ...read.followers };
    // One snapshot per day: a new day adds one (history); the same day is only refreshed when the numbers moved.
    const snap = !snapshot ? null : !row.snapshotDates.includes(snapshot.date) ? snapshot : followerChanges.length ? snapshot : null;
    const flags = dedupeFlags(read.flags, row.flagKeys);
    const products: ProductPlan[] = read.products.map((p) => {
      const have = row.products.find((item) => words(item.name) === words(p.name));
      if (!have) return { action: "add", name: p.name, set: { name: p.name, ...p.values, ...(p.min !== null ? { price_min: p.min, price_max: p.max ?? p.min } : {}) }, features: p.features, links: p.links, addPrice: p.min !== null ? { min: p.min, max: p.max, date: p.priceDate } : null, conflicts: [] };
      const pset: Record<string, string | number> = {}; const pconf: Conflict[] = [];
      for (const field of PRODUCT_TEXT) { const value = p.values[field]; if (!value) continue; if (!have[field].trim()) pset[field] = value; else if (words(have[field]) !== words(value)) pconf.push({ field, current: have[field], proposed: value }); }
      const latest = have.latestPrice || (have.price_min !== null ? { min: have.price_min, max: have.price_max, date: "" } : null);
      const priceChanged = p.min !== null && (!latest || latest.min !== p.min || (latest.max ?? latest.min) !== (p.max ?? p.min));
      if (p.min !== null && have.price_min === null) { pset.price_min = p.min; pset.price_max = p.max ?? p.min; }
      const features = union(have.features, p.features); const links = union(have.links, p.links);
      const changed = Object.keys(pset).length || priceChanged || features.length > have.features.length || links.length > have.links.length;
      return { action: changed ? "update" : "unchanged", id: have.id, name: have.name, set: pset, features, links, addPrice: priceChanged ? { min: p.min, max: p.max, date: p.priceDate } : null, conflicts: pconf };
    });
    const changed = Object.keys(set).length || platforms.length > row.platforms.length || followerChanges.length || snap || flags.length || products.some((p) => p.action !== "unchanged");
    return { ...blank, action: changed ? "update" : "unchanged", errors: [], id: row.id, name: row.name, set, platforms, followers, followerChanges, snapshot: snap, flags, products, conflicts };
  });
}

function dedupeFlags(flags: FlagPlan[], have: string[]) {
  const seen = new Set(have);
  return flags.filter((f) => { const key = flagKey(f); if (seen.has(key)) return false; seen.add(key); return true; });
}
export const existingFlagKey = (flag_type: string, flag_date: string, description: string) => flagKey({ flag_type, flag_date, description });

export function summariseCompetitors(items: CompetitorItem[]) {
  const count = (action: string) => items.filter((item) => item.action === action).length;
  const all = items.filter((item) => item.action === "add" || item.action === "update");
  return {
    added: count("add"), updated: count("update"), unchanged: count("unchanged"), possibleDuplicates: count("possible_duplicate"), invalid: count("invalid"),
    conflicts: items.reduce((n, item) => n + item.conflicts.length + item.products.reduce((m, p) => m + p.conflicts.length, 0), 0),
    snapshots: all.filter((item) => item.snapshot).length, flagsAdded: all.reduce((n, item) => n + item.flags.length, 0),
    productsAdded: all.reduce((n, item) => n + item.products.filter((p) => p.action === "add").length, 0),
    productsUpdated: all.reduce((n, item) => n + item.products.filter((p) => p.action === "update").length, 0),
    pricesAdded: all.reduce((n, item) => n + item.products.filter((p) => p.addPrice).length, 0),
  };
}
