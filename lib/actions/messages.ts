// Turning a failure into a sentence for the person (pure: tested under `node --test`).
import { recordDefinitions } from "../records/catalog.ts";

export const GENERIC = "Something went wrong on the server, so nothing was saved. Try again; if it keeps happening, tell the admin.";

/** "tipe" on "resources" → "Type", using the labels the forms show; otherwise the column name. */
function columnLabel(table: string | undefined, column: string | undefined) {
  if (!column) return "A required field";
  for (const definition of Object.values(recordDefinitions)) {
    if (table && definition.table !== table) continue;
    const field = definition.fields.find((item) => item.name === column);
    if (field) return field.label;
  }
  return column.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

type PgError = { code?: string; column_name?: string; table_name?: string; constraint_name?: string; detail?: string };

/** A database error in words; null when it is not one we can explain. */
export function databaseMessage(error: unknown): string | null {
  const pg = error as PgError;
  if (!pg || typeof pg.code !== "string" || !/^[0-9A-Z]{5}$/.test(pg.code)) return null;
  const label = columnLabel(pg.table_name, pg.column_name);
  switch (pg.code) {
    case "23502": return `${label} is required.`;
    case "23505": return `This already exists${pg.detail ? ` (${pg.detail.replace(/^Key \((.+?)\)=\((.+?)\).*$/, "$1: $2")})` : ""}. Change it or edit the existing one.`;
    case "23503": return "It refers to something that no longer exists. Reload the page and try again.";
    case "23514": return `${pg.column_name ? label : "A field"} has a value that is not allowed${pg.constraint_name ? ` (${pg.constraint_name})` : ""}.`;
    case "22P02": case "22007": case "22008": return `${pg.column_name ? label : "A field"} has the wrong format.`;
    case "22001": return `${pg.column_name ? label : "A field"} is too long.`;
    case "22003": return `${pg.column_name ? label : "A number"} is too large.`;
    default: return null;
  }
}

/** The person-facing message of a failure, or null for a bug (logged, generic message). */
export function failureMessage(error: unknown): string | null {
  const fromDatabase = databaseMessage(error);
  if (fromDatabase) return fromDatabase;
  // Our own `throw new Error("…")` messages are written for people. TypeError & co. are bugs.
  if (error instanceof Error && error.constructor === Error && error.message && !/^(fetch failed|Unexpected token|Cannot read)/.test(error.message)) return error.message;
  return null;
}

