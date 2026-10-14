// How the generic record form and table present each catalog field to a person.
// Pure (type-only imports) so the rules are unit-tested; RecordManager renders them and
// /api/record-options serves the dropdown choices for "reference" fields.

import type { ManagedField } from "./catalog";

/**
 * reference  → dropdown of names, submits the id (server unchanged)
 * references → checkbox list of names, submits "id, id" (uuid-array format)
 * tags       → list editor for JSON arrays of text, submits JSON
 * advanced   → kept editable but folded under "Advanced" (structured JSON, external ids)
 * system     → not shown; current value re-submitted unchanged so an edit never wipes it
 * plain      → the field's own input
 */
export type FieldKind = "reference" | "references" | "tags" | "advanced" | "system" | "plain";

export type ReferenceSource = { table: string; label: readonly string[]; orderBy?: string; guard?: "tickets" };

const PRODUCTS: ReferenceSource = { table: "products", label: ["nama"], orderBy: "nama" };
const PEOPLE: ReferenceSource = { table: "tkt_people", label: ["nama"], orderBy: "nama" };
const DIVISIONS: ReferenceSource = { table: "tkt_divisi", label: ["nama"], orderBy: "nama" };
const EVENTS: ReferenceSource = { table: "events", label: ["nama", "tanggal"], orderBy: "tanggal" };

/** "definitionKey.field" → where the names come from. Field names alone are ambiguous (product_id). */
export const REFERENCES: Record<string, ReferenceSource> = {
  "ads_contents.eval_id": { table: "content_evaluations", label: ["judul"], orderBy: "tanggal" },
  "crm_deals.buyer_id": { table: "buyers", label: ["name", "email"], orderBy: "name" },
  "tasks.project_id": EVENTS,
  "tasks.assignee_id": PEOPLE,
  "tasks.assignee_ids": PEOPLE,
  "tasks.ticket_id": { table: "tickets", label: ["ticket_no", "title"], orderBy: "created_at", guard: "tickets" },
  "partner_deals.partner_id": { table: "partners", label: ["name"], orderBy: "name" },
  "partner_outreach.partner_id": { table: "partners", label: ["name"], orderBy: "name" },
  "org_deals.org_partner_id": { table: "org_partners", label: ["name"], orderBy: "name" },
  "org_outreach.org_partner_id": { table: "org_partners", label: ["name"], orderBy: "name" },
  "competitor_snapshots.competitor_id": { table: "competitor_profiles", label: ["name"], orderBy: "name" },
  "competitor_flags.competitor_id": { table: "competitor_profiles", label: ["name"], orderBy: "name" },
  "competitor_products.competitor_id": { table: "competitor_profiles", label: ["name"], orderBy: "name" },
  "competitor_product_prices.product_id": { table: "competitor_products", label: ["name"], orderBy: "name" },
  "tkt_people.divisi_id": DIVISIONS,
  "tkt_types.divisi_id": DIVISIONS,
  "product_features.product_id": PRODUCTS,
  "product_benefits.product_id": PRODUCTS,
  "product_pain_points.product_id": PRODUCTS,
  "product_passion_points.product_id": PRODUCTS,
  "sub_products.product_id": PRODUCTS,
  "product_bundles.bundle_id": PRODUCTS,
  "product_bundles.item_id": PRODUCTS,
  "product_feature_links.feature_id": { table: "product_features", label: ["name"], orderBy: "name" },
  "sub_product_links.sub_product_id": { table: "sub_products", label: ["name"], orderBy: "name" },
  "event_rundown.event_id": EVENTS,
  "story_plan_items.date_id": { table: "story_plan_dates", label: ["tanggal"], orderBy: "tanggal" },
  "carousel_plans.assignee_id": PEOPLE,
  "carousel_plan_links.plan_id": { table: "carousel_plans", label: ["judul"], orderBy: "tanggal_posting" },
  "tickets.type_id": { table: "tkt_types", label: ["nama"], orderBy: "nama" },
  "tickets.divisi_id": DIVISIONS,
  "tickets.assigned_to_id": PEOPLE,
  "tickets.assigned_to_ids": PEOPLE,
  "tickets.requester_id": PEOPLE,
};

/** Ids that point outside this app (Instagram post/account ids, login accounts): kept as text, folded. */
const EXTERNAL_IDS = new Set(["content_evaluations.post_id", "content_evaluations.account_id", "tkt_people.auth_user_id"]);

/** Values maintained by the module pages themselves (history, comments, uploaded files). */
const SYSTEM_FIELDS = new Set([
  "buyers.riwayat", "tickets.komentar", "tickets.files", "tasks.attachments",
  "content_library.storage_paths", "design_assets.storage_paths", "competitor_products.image_urls",
]);

/** JSON arrays of plain text, edited as a list. */
const TAG_FIELDS = new Set([
  "content_library.labels", "pain_points.labels", "competitor_profiles.platforms",
  "competitor_products.features", "competitor_products.links", "tickets.cc",
]);

export function fieldKind(definitionKey: string, field: ManagedField): FieldKind {
  const key = `${definitionKey}.${field.name}`;
  if (SYSTEM_FIELDS.has(key)) return "system";
  if (REFERENCES[key]) return field.type === "uuid-array" ? "references" : "reference";
  if (TAG_FIELDS.has(key)) return "tags";
  if (EXTERNAL_IDS.has(key) || field.type === "json") return "advanced";
  return "plain";
}

/** Every id-like field must be classified on purpose; used by the traceability test. */
export function isIdLike(field: ManagedField) {
  return field.type === "uuid-array" || /(^|_)ids?$/.test(field.name);
}

/** "Product ID" → "Product", "Assignee UUIDs" → "Assignees", "Event links JSON" → "Event links". */
export function displayLabel(label: string) {
  return label
    .replace(/\s+UUIDs$/i, "s")
    .replace(/\s+IDs$/i, "s")
    .replace(/\s+ID$/i, "")
    .replace(/\s+JSON$/i, "")
    .replace(/^R2\s+/i, "")
    .trim();
}

export type FormSections<T> = { main: T[]; more: T[]; advanced: T[]; system: T[] };

/** Required fields first (prinsip 1 & 4); optional ones folded; advanced/system separate. */
export function planForm<T extends ManagedField>(definitionKey: string, fields: readonly T[]): FormSections<T> {
  const plan: FormSections<T> = { main: [], more: [], advanced: [], system: [] };
  for (const field of fields) {
    const kind = fieldKind(definitionKey, field);
    if (kind === "system") plan.system.push(field);
    else if (kind === "advanced") plan.advanced.push(field);
    else if (field.required) plan.main.push(field);
    else plan.more.push(field);
  }
  // A form with no required field still shows its first useful fields up front.
  if (!plan.main.length) plan.main.push(...plan.more.splice(0, Math.min(3, plan.more.length)));
  return plan;
}

/** Tags editor accepts only arrays of plain values; anything else falls back to the JSON box. */
export function asTagList(value: unknown): string[] | null {
  if (value === null || value === undefined || value === "") return [];
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return null; }
  }
  if (!Array.isArray(parsed)) return null;
  if (!parsed.every((item) => ["string", "number"].includes(typeof item))) return null;
  return parsed.map(String).map((item) => item.trim()).filter(Boolean);
}

export function addTag(list: string[], raw: string) {
  const value = raw.trim();
  if (!value || list.some((item) => item.toLowerCase() === value.toLowerCase())) return list;
  return [...list, value];
}

/** What a person calls one item of each table, for "Add feature", "No features yet", etc. */
export const ITEM_NOUN: Record<string, string> = {
  events: "program", buyers: "buyer", content_evaluations: "evaluation", ads_contents: "ad",
  ig_snapshots: "weekly snapshot", partners: "partner", org_partners: "organization",
  design_assets: "design asset", competitor_profiles: "competitor", content_library: "content",
  resources: "resource", app_settings: "setting", crm_deals: "deal", tasks: "task",
  event_link_templates: "link template", ig_targets: "target", partner_deals: "deal",
  partner_outreach: "outreach log", org_deals: "deal", org_outreach: "outreach log",
  competitor_snapshots: "snapshot", competitor_flags: "market flag", competitor_products: "competitor product",
  competitor_product_prices: "price record", pain_point_platforms: "platform", pain_point_categories: "category",
  tkt_divisi: "division", tkt_people: "person", tkt_types: "request type", pain_points: "pain point",
  products: "product", product_features: "feature", product_feature_links: "feature link",
  product_benefits: "benefit", product_pain_points: "pain point", product_passion_points: "passion point",
  sub_products: "sub-product", sub_product_links: "sub-product link", product_bundles: "bundle item",
  product_klasifikasi: "classification", master_produk: "product mapping", event_rundown: "rundown item",
  story_plan_dates: "story date", story_plan_items: "story slide", story_plan_links: "story link",
  carousel_plans: "carousel plan", carousel_cta_options: "CTA", carousel_plan_links: "carousel link",
  kol_list: "KOL", mt_story_list: "MT story", talent_pool: "candidate", collaborators: "collaborator",
  tickets: "ticket",
};

const IRREGULAR: Record<string, string> = { person: "people", content: "content", KOL: "KOLs", CTA: "CTAs", "MT story": "MT stories" };

export function plural(noun: string, count = 2) {
  if (count === 1) return noun;
  if (IRREGULAR[noun]) return IRREGULAR[noun];
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (/(s|x|ch|sh)$/.test(noun)) return `${noun}es`;
  return `${noun}s`;
}

/** Option label from the chosen columns, e.g. "Webinar MT · 2026-10-20". */
export function optionLabel(row: Record<string, unknown>, columns: readonly string[]) {
  const parts = columns.map((column) => {
    const value = row[column];
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const text = String(value).trim();
    // Timestamps from the database read better as a date.
    return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
  }).filter(Boolean);
  return parts.join(" · ") || "Untitled";
}
