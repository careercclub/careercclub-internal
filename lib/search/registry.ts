// Global search ("Cari apa saja" in the Ctrl+K palette).
//
// Which tables and columns can be searched is derived from the record catalog, so a
// new field added there becomes searchable without a second list to maintain. This
// file is pure (no runtime imports) so it can be tested directly under `node --test`.

export type SearchFieldInput = {
  name: string;
  label: string;
  type?: string;
  storageArea?: string;
};

export type SearchDefinitionInput = {
  table: string;
  title: string;
  path: string;
  fields: ReadonlyArray<SearchFieldInput>;
};

export type SearchField = { name: string; label: string };

export type SearchSpec = {
  key: string;
  table: string;
  module: string;
  path: string;
  titleFields: string[];
  fields: SearchField[];
};

export type SearchHit = {
  key: string;
  id: string;
  title: string;
  module: string;
  path: string;
  href: string;
  matchLabel: string;
  snippet: string;
};

/** Tables that are never searchable: configuration can hold secrets. */
export const EXCLUDED_SEARCH_TABLES = new Set(["app_settings"]);

/** Columns that are never searchable or shown in results, whatever table they are in. */
export function isSensitiveSearchField(field: SearchFieldInput) {
  const name = field.name.toLowerCase();
  if (name === "id" || name.endsWith("_id") || name.endsWith("_ids")) return true;
  if (/(password|secret|token|api_key|apikey)/.test(name)) return true;
  if (field.storageArea) return true; // R2 object keys, not human text
  if (/(storage_path|thumbnail_key)/.test(name)) return true;
  return false;
}

const TEXT_TYPES = new Set([undefined, "text", "textarea", "select", "json", "text-array"]);

// First match wins. These read as a record's "name" across the catalog.
const TITLE_PREFERENCE = ["nama", "name", "title", "judul", "nama_event", "label", "activity", "komentar", "isi", "produk_target", "kode", "description"];

// Fields that best identify a record when its title alone already matched the query.
const CONTEXT_PREFERENCE = ["industry", "email", "username", "contact_email", "contact_name", "wa", "kode", "url", "link", "kategori", "category", "platform", "status"];

// Records without a natural name are titled from a combination of fields.
const TITLE_OVERRIDES: Record<string, string[]> = {
  mt_vacancies: ["company", "program"],
  content_library: ["platform", "jenis"],
  partner_outreach: ["channel", "respons"],
  org_outreach: ["channel", "respons"],
  competitor_flags: ["flag_type", "description"],
};

export function buildSearchSpecs(definitions: Record<string, SearchDefinitionInput>): SearchSpec[] {
  const specs: SearchSpec[] = [];
  for (const [key, definition] of Object.entries(definitions)) {
    if (EXCLUDED_SEARCH_TABLES.has(definition.table)) continue;
    const fields = definition.fields
      .filter((field) => TEXT_TYPES.has(field.type) && !isSensitiveSearchField(field))
      .map((field) => ({ name: field.name, label: field.label }));
    if (!fields.length) continue;
    const names = new Set(fields.map((field) => field.name));
    const override = TITLE_OVERRIDES[key]?.filter((name) => names.has(name));
    const preferred = TITLE_PREFERENCE.find((name) => names.has(name));
    specs.push({
      key,
      table: definition.table,
      module: definition.title,
      path: definition.path,
      titleFields: override?.length ? override : preferred ? [preferred] : [fields[0].name],
      fields,
    });
  }
  return specs;
}

/** "  Email   CCC " -> ["email", "ccc"]. Every term must match somewhere in the record. */
export function searchTerms(query: string) {
  return [...new Set(query.toLowerCase().split(/\s+/).map((term) => term.trim()).filter((term) => term.length > 0))].slice(0, 6);
}

export const MIN_SEARCH_LENGTH = 2;

export function plainText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean).join(", ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(plainText).filter(Boolean).join(", ");
  return String(value);
}

/** True when every term appears in at least one searchable field of the row. */
export function rowMatches(row: Record<string, unknown>, spec: SearchSpec, terms: string[]) {
  const haystack = spec.fields.map((field) => plainText(row[field.name]).toLowerCase()).join(" \u0001 ");
  return terms.every((term) => haystack.includes(term));
}

function excerpt(text: string, term: string, width = 70) {
  const clean = text.replace(/\s+/g, " ").trim();
  const at = clean.toLowerCase().indexOf(term);
  if (clean.length <= width || at < 0) return clean.length <= width ? clean : `${clean.slice(0, width - 1)}…`;
  const start = Math.max(0, Math.min(at - Math.floor(width / 3), clean.length - width));
  return `${start > 0 ? "…" : ""}${clean.slice(start, start + width)}${start + width < clean.length ? "…" : ""}`;
}

export function toSearchHit(row: Record<string, unknown>, spec: SearchSpec, terms: string[]): SearchHit {
  const id = plainText(row.id);
  const title = spec.titleFields.map((name) => plainText(row[name]).trim()).filter(Boolean).join(" · ") || spec.module;
  // Show the field that explains the match best: the first non-title field that contains a term,
  // otherwise the title itself matched and the first other filled field gives context.
  const titleNames = new Set(spec.titleFields);
  const candidates = spec.fields.filter((field) => !titleNames.has(field.name) && plainText(row[field.name]).trim());
  const titleText = title.toLowerCase();
  const titleHasAll = terms.every((term) => titleText.includes(term));
  // When the name already explains the match, show what identifies the record (its email,
  // username, link...) instead of an incidental word in the notes.
  const context = titleHasAll ? CONTEXT_PREFERENCE.map((name) => candidates.find((field) => field.name === name)).find(Boolean) : undefined;
  const matched = context ? undefined : candidates.find((field) => terms.some((term) => plainText(row[field.name]).toLowerCase().includes(term)));
  const shown = context || matched || candidates[0];
  const term = matched ? terms.find((value) => plainText(row[matched.name]).toLowerCase().includes(value)) || "" : "";
  return {
    key: spec.key,
    id,
    title: excerpt(title, terms[0] || "", 80),
    module: spec.module,
    path: spec.path,
    href: `${spec.path}?focus=${encodeURIComponent(id)}`,
    matchLabel: shown ? shown.label : "",
    snippet: shown ? excerpt(plainText(row[shown.name]), term) : "",
  };
}

/** Exact title hits first, then title-contains, then matches in other fields. */
export function rankSearchHits(hits: SearchHit[], terms: string[]) {
  const query = terms.join(" ");
  const score = (hit: SearchHit) => {
    const title = hit.title.toLowerCase();
    if (title === query) return 0;
    if (title.startsWith(query)) return 1;
    if (terms.every((term) => title.includes(term))) return 2;
    if (terms.some((term) => title.includes(term))) return 3;
    return 4;
  };
  return [...hits].sort((a, b) => score(a) - score(b) || a.title.length - b.title.length || a.title.localeCompare(b.title));
}

export type HighlightPart = { text: string; match: boolean };

/** Splits text into matched / unmatched parts (case-insensitive) so the UI can bold the hits. */
export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  const needles = [...new Set(terms.map((term) => term.toLowerCase()).filter(Boolean))];
  if (!text || !needles.length) return text ? [{ text, match: false }] : [];
  const lower = text.toLowerCase();
  const marked = new Array<boolean>(text.length).fill(false);
  for (const needle of needles) {
    for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + needle.length)) {
      marked.fill(true, at, at + needle.length);
    }
  }
  const parts: HighlightPart[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[index]) last.text += text[index];
    else parts.push({ text: text[index], match: marked[index] });
  }
  return parts;
}
