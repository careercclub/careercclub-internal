import "server-only";
import { withPostgres } from "@/lib/db/postgres";
import { assertIdentifier, assertTableName, type TableName } from "@/lib/db/tables";
import { TICKET_VISIBILITY_COLUMNS, ticketVisibility, type TicketViewer } from "@/lib/tickets/visibility";
import { isRecordDefinitionKey, recordDefinitions } from "./catalog";
import { REFERENCES, optionLabel, type ReferenceSource } from "./form-plan";

export type RecordOption = { value: string; label: string };

const OPTION_LIMIT = 2000;
// Dated choices list the newest first; names list alphabetically.
const NEWEST_FIRST = new Set(["tanggal", "created_at", "tanggal_posting"]);

/**
 * Dropdown choices for every reference field of one record definition: only id + a
 * readable name, never other columns. Ticket choices follow the ticket role rule.
 */
export async function getReferenceOptions(definitionKey: string, viewer: TicketViewer) {
  if (!isRecordDefinitionKey(definitionKey)) throw new Error("Unknown record definition.");
  const fields = (recordDefinitions[definitionKey].fields as ReadonlyArray<{ name: string }>)
    .map((field) => ({ field: field.name, source: REFERENCES[`${definitionKey}.${field.name}`] }))
    .filter((entry): entry is { field: string; source: ReferenceSource } => Boolean(entry.source));
  if (!fields.length) return {} as Record<string, RecordOption[]>;

  return withPostgres(async (sql) => {
    const cache = new Map<string, RecordOption[]>();
    const result: Record<string, RecordOption[]> = {};
    for (const { field, source } of fields) {
      const cacheKey = JSON.stringify(source);
      if (!cache.has(cacheKey)) {
        assertTableName(source.table as TableName);
        const extra = source.guard === "tickets" ? TICKET_VISIBILITY_COLUMNS : [];
        const columns = ["id", ...source.label, ...extra];
        columns.forEach(assertIdentifier);
        if (source.orderBy) assertIdentifier(source.orderBy);
        const rows = await sql<Record<string, unknown>[]>`
          select ${sql.unsafe(columns.map((column) => `"${column}"`).join(", "))}
          from ${sql.unsafe(`"${source.table}"`)}
          ${source.orderBy ? sql.unsafe(`order by "${source.orderBy}" ${NEWEST_FIRST.has(source.orderBy) ? "desc" : "asc"} nulls last`) : sql``}
          limit ${OPTION_LIMIT}
        `;
        let visible = [...rows];
        if (source.guard === "tickets") {
          const people = await sql<Record<string, unknown>[]>`select * from "tkt_people"`;
          visible = visible.filter(ticketVisibility(viewer, [...people]));
        }
        cache.set(cacheKey, visible.map((row) => ({ value: String(row.id), label: optionLabel(row, source.label) })));
      }
      result[field] = cache.get(cacheKey) || [];
    }
    return result;
  });
}
