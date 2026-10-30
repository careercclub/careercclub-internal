// What the Claude connector (MCP, Putaran 62) may read and write. Pure: tested under `node --test`.
//
// - Every module of the record catalog can be read and added to / changed, by the same rules as
//   the app (lib/records/write.ts): who may change a module, ticket visibility, requester.
// - Nothing can be deleted through the connector.
// - Passwords, secrets and account links are never read or written. A resource says only whether
//   it has a password (has_password), like the Resources page.
// - Collaborators' bank accounts are shown masked and are changed in the app only (the decision on
//   who may edit them is still open).
// - Files are uploaded in the app; their storage keys are read-only here.
import type { ManagedField, RecordDefinition } from "../records/catalog.ts";

export const MCP_EXCLUDED_TABLES = new Set(["app_settings"]);
const SECRET = /(password|secret|token|api_key|apikey|_hash$)/i;

/** Never leaves the server through the connector. */
export function isHiddenField(name: string) {
  return SECRET.test(name) || name === "auth_user_id";
}

const MASKED: Record<string, string[]> = { collaborators: ["rekening"] };
export function isMaskedField(table: string, name: string) {
  return (MASKED[table] || []).includes(name);
}

/** "BCA 1234567890 a.n. Rina" → "•••• 7890". */
export function maskAccount(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits && !String(value ?? "").trim()) return "";
  return `•••• ${digits.slice(-4) || "set"}`;
}

/** Files and images are uploaded in the app; their keys and lists are read-only here. */
export const FILE_FIELDS = new Set(["attachments", "files", "storage_path", "storage_paths", "thumbnail_key", "thumbnail_url", "image_url", "image_urls", "logo_url", "foto_url", "cover_url", "rate_card_file_url"]);

/** Fields Claude may set through the connector. */
export function writableFields(table: string, fields: readonly ManagedField[]) {
  return fields.filter((field) => !isHiddenField(field.name) && !isMaskedField(table, field.name) && !field.storageArea && !FILE_FIELDS.has(field.name));
}

const iso = (value: Date) => (Number.isNaN(value.getTime()) ? null : value.toISOString());

/** A row as the connector shows it. */
export function cleanRow(table: string, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (isHiddenField(key)) continue;
    out[key] = isMaskedField(table, key) ? maskAccount(value) : value instanceof Date ? iso(value) : value;
  }
  if (table === "resources") out.has_password = Boolean(String(row.password ?? "").trim());
  return out;
}

const day = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10));

/**
 * Values for the app's record form (FormData entries), from the merged record. A change sends only
 * the fields to change; the rest are taken from the saved record so nothing is cleared by accident.
 */
export function formEntries(fields: readonly ManagedField[], values: Record<string, unknown>): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const field of fields) {
    const value = values[field.name];
    if (value === null || value === undefined) continue;
    if (field.type === "checkbox") { if (value === true || value === "on" || value === "true" || value === 1) entries.push([field.name, "on"]); continue; }
    if (field.type === "json") { entries.push([field.name, typeof value === "string" ? value : JSON.stringify(value)]); continue; }
    if (field.type === "uuid-array") { entries.push([field.name, Array.isArray(value) ? value.map(String).join(",") : String(value)]); continue; }
    if (field.type === "text-array") { for (const item of Array.isArray(value) ? value : String(value).split(",")) entries.push([field.name, String(item).trim()]); continue; }
    if (field.type === "date") { entries.push([field.name, day(value)]); continue; }
    entries.push([field.name, typeof value === "object" ? JSON.stringify(value) : String(value)]);
  }
  return entries;
}

/** Fields the connector was asked to set that it may not (so Claude can say so instead of guessing). */
export function refusedFields(table: string, definition: Pick<RecordDefinition, "fields">, values: Record<string, unknown>) {
  const allowed = new Set(writableFields(table, definition.fields).map((field) => field.name));
  return Object.keys(values).filter((key) => !allowed.has(key));
}

/** Required fields still empty after merging. */
export function missingRequired(table: string, definition: Pick<RecordDefinition, "fields">, values: Record<string, unknown>) {
  return writableFields(table, definition.fields).filter((field) => field.required && (values[field.name] === null || values[field.name] === undefined || String(values[field.name]).trim() === "" || (Array.isArray(values[field.name]) && !(values[field.name] as unknown[]).length))).map((field) => field.name);
}

/** Every typed word appears somewhere in the row's text (case-insensitive). */
export function rowMatches(row: Record<string, unknown>, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = JSON.stringify(row).toLowerCase();
  return words.every((word) => text.includes(word));
}

/** Exact match on the given fields (text compared without case; dates by day). */
export function rowFilter(filters: Record<string, unknown>) {
  const entries = Object.entries(filters || {}).filter(([key]) => !isHiddenField(key));
  return (row: Record<string, unknown>) => entries.every(([key, want]) => {
    const have = row[key];
    if (Array.isArray(have)) return have.map(String).includes(String(want));
    if (have instanceof Date) return day(have) === String(want).slice(0, 10);
    return String(have ?? "").toLowerCase() === String(want ?? "").toLowerCase();
  });
}

export const LIST_DEFAULT = 50;
export const LIST_MAX = 200;
export function pageOf<T>(rows: T[], limit?: unknown, offset?: unknown) {
  const size = Math.min(LIST_MAX, Math.max(1, Number(limit) || LIST_DEFAULT));
  const start = Math.max(0, Number(offset) || 0);
  return { total: rows.length, offset: start, limit: size, rows: rows.slice(start, start + size), more: start + size < rows.length };
}
