import "server-only";
import type ExcelJS from "exceljs";
import { normalizeName } from "@/lib/mt-prospects/parse";
import { SheetProblem } from "@/lib/imports/talent-pool-sheet";
import { findTab, list, readTable, sheetDate } from "@/lib/imports/sheet-table";

// The "Competitor Intel" Google Sheet (filled by Claude every week, or by the team):
//   Competitors — one row per competitor (update the row each check; the app keeps the history)
//   Flags       — one row per news item (new product, price change, campaign…)
//   Products    — one row per product, with its current price
// Turned into the same input as Claude access, so the same rules apply (lib/competitor/agent.ts).

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "X", "LinkedIn"] as const;
const COMPETITOR_COLUMNS: Record<string, string[]> = {
  name: ["competitor", "name", "brand"], date: ["checked on", "date", "tanggal"], category: ["category", "kategori"],
  primary_url: ["website", "primary url", "url"], platforms: ["platforms"], niche: ["niche", "positioning"],
  target_audience: ["target audience", "audience"], threat_level: ["threat level", "threat"], ads_active: ["ads active", "ads running", "ads"],
  notes: ["notes", "catatan"], match: ["match", "match id"],
  ...Object.fromEntries(PLATFORMS.map((p) => [p, [`${p} followers`, p]])),
};
const FLAG_COLUMNS: Record<string, string[]> = { competitor: ["competitor", "brand", "name"], date: ["date", "tanggal"], type: ["type", "flag type"], description: ["description", "what happened", "news"], source_url: ["source link", "source", "link"] };
const PRODUCT_COLUMNS: Record<string, string[]> = {
  competitor: ["competitor", "brand"], name: ["product", "name"], category: ["category", "kategori"], description: ["description"],
  price_min: ["price min", "price", "harga"], price_max: ["price max"], price_date: ["price date", "date"], status: ["status"], features: ["features"], links: ["links", "link"],
};
const FLAG_TYPES: Record<string, string> = { "new product": "new_product", "price change": "price_change", "new campaign": "new_campaign", campaign: "new_campaign", other: "other" };
const yes = (value: string) => /^(yes|y|true|ya|1|active|running)$/i.test(value) ? true : /^(no|n|false|tidak|0)$/i.test(value) ? false : undefined;
const number = (value: string) => value.replace(/[^\d]/g, "");

export function competitorRows(workbook: ExcelJS.Workbook) {
  const tab = findTab(workbook, ["competitors", "competitor"]);
  if (!tab) throw new SheetProblem("The sheet needs a “Competitors” tab (plus “Flags” and “Products” if you track them).");
  const byName = new Map<string, Record<string, unknown> & { rows: number[]; date: string }>();
  for (const row of readTable(tab, COMPETITOR_COLUMNS, ["name"])) {
    const key = normalizeName(row.get("name"));
    const date = sheetDate(row.get("date"));
    const current = byName.get(key);
    // The same competitor on several rows (a weekly log): the newest row wins, empty cells never clear.
    const isNewer = !current || !current.date || (date && date >= current.date);
    const values: Record<string, unknown> = {};
    for (const field of ["name", "category", "primary_url", "niche", "target_audience", "threat_level", "notes"]) { const v = row.get(field); if (v) values[field] = field === "category" ? v.toLowerCase() : v; }
    const platforms = list(row.get("platforms"));
    const followers = Object.fromEntries(PLATFORMS.map((p) => [p, number(row.get(p))]).filter(([, v]) => v));
    const ads = yes(row.get("ads_active"));
    const match = row.get("match");
    const base = current || { rows: [], date: "" };
    const next = isNewer ? { ...base, ...values } : { ...values, ...base };
    next.rows = [...base.rows, row.row];
    next.date = isNewer && date ? date : base.date;
    if (platforms.length) next.platforms = [...new Set([...(Array.isArray(base.platforms) ? base.platforms as string[] : []), ...platforms])];
    if (Object.keys(followers).length) next.followers = isNewer ? { ...(base.followers as object || {}), ...followers } : { ...followers, ...(base.followers as object || {}) };
    if (ads !== undefined && (isNewer || base.ads_active === undefined)) next.ads_active = ads;
    if (/^new$/i.test(match)) next.as_new = true; else if (match) next.match_id = match;
    byName.set(key, next);
  }
  const flagsTab = findTab(workbook, ["flags", "news"]);
  const productsTab = findTab(workbook, ["products", "produk"]);
  const warnings: string[] = [];
  const owner = (name: string, tabName: string, row: number) => {
    const item = byName.get(normalizeName(name));
    if (!item) warnings.push(`${tabName} row ${row}: “${name}” is not on the Competitors tab.`);
    return item;
  };
  if (flagsTab) for (const row of readTable(flagsTab, FLAG_COLUMNS, ["competitor", "description"])) {
    const item = owner(row.get("competitor"), flagsTab.name, row.row); if (!item) continue;
    const typed = row.get("type").toLowerCase().replace(/_/g, " ");
    item.flags = [...((item.flags as unknown[]) || []), { type: FLAG_TYPES[typed] || typed, date: sheetDate(row.get("date")), description: row.get("description"), source_url: row.get("source_url") }];
  }
  if (productsTab) for (const row of readTable(productsTab, PRODUCT_COLUMNS, ["competitor", "name"])) {
    const item = owner(row.get("competitor"), productsTab.name, row.row); if (!item) continue;
    const product: Record<string, unknown> = { name: row.get("name") };
    for (const field of ["category", "description", "status"]) { const v = row.get(field); if (v) product[field] = v; }
    if (number(row.get("price_min"))) product.price_min = Number(number(row.get("price_min")));
    if (number(row.get("price_max"))) product.price_max = Number(number(row.get("price_max")));
    if (row.get("price_date")) product.price_date = sheetDate(row.get("price_date"));
    const features = list(row.get("features")); if (features.length) product.features = features;
    const links = list(row.get("links")); if (links.length) product.links = links;
    item.products = [...((item.products as unknown[]) || []), product];
  }
  const competitors = [...byName.values()].map(({ rows, date, ...rest }) => ({ ...rest, ...(date ? { snapshot: { date } } : {}), __rows: rows }));
  return { competitors, warnings };
}
