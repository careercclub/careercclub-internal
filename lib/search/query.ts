import "server-only";
import type { Sql } from "postgres";
import { withPostgres } from "@/lib/db/postgres";
import { assertIdentifier, assertTableName } from "@/lib/db/tables";
import { recordDefinitions } from "@/lib/records/catalog";
import { TICKET_VISIBILITY_COLUMNS, ticketVisibility, type TicketViewer } from "@/lib/tickets/visibility";
import { extraSearchDefinitions } from "./extra-definitions";
import { buildSearchSpecs, rankSearchHits, rowMatches, searchTerms, toSearchHit, type SearchHit, type SearchSpec } from "./registry";

const PER_TABLE_LIMIT = 8;
const TOTAL_LIMIT = 40;
// Guarded tables fetch more candidates so hidden rows do not crowd out visible ones.
const GUARDED_FETCH_LIMIT = 200;

let cachedSpecs: SearchSpec[] | null = null;
export function searchSpecs() {
  cachedSpecs ??= buildSearchSpecs({ ...recordDefinitions, ...extraSearchDefinitions });
  return cachedSpecs;
}

function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

type RowGuard = { columns: readonly string[]; load: (sql: Sql, viewer: SearchViewer) => Promise<(row: Record<string, unknown>) => boolean> };
export type SearchViewer = TicketViewer;

// Tables whose page only shows some rows to some people. Search must apply the same rule,
// otherwise Ctrl+K would reveal what the page itself hides.
const ROW_GUARDS: Record<string, RowGuard> = {
  tickets: {
    columns: TICKET_VISIBILITY_COLUMNS,
    async load(sql, viewer) {
      const people = await sql<Record<string, unknown>[]>`select * from "tkt_people"`;
      return ticketVisibility(viewer, [...people]);
    },
  },
};

async function searchTable(sql: Sql, spec: SearchSpec, terms: string[], viewer: SearchViewer) {
  assertTableName(spec.table);
  const columns = spec.fields.map((field) => field.name);
  const guard = ROW_GUARDS[spec.key];
  columns.forEach(assertIdentifier);
  guard?.columns.forEach(assertIdentifier);
  const haystack = `concat_ws(' ', ${columns.map((column) => `"${column}"::text`).join(", ")})`;
  const selected = ["id", ...columns, ...(guard?.columns || [])].map((column) => `"${column}"`).join(", ");
  const rows = await sql<Record<string, unknown>[]>`
    select ${sql.unsafe(selected)}
    from ${sql.unsafe(`"${spec.table}"`)}
    where ${sql.unsafe(haystack)} ilike all(${terms.map(likePattern)}::text[])
    limit ${guard ? GUARDED_FETCH_LIMIT : PER_TABLE_LIMIT}
  `;
  // A guarded table checks per row; with a guard the limit is applied after filtering.
  const allowed = guard ? await guard.load(sql, viewer) : () => true;
  // Re-check in JS so JSON keys or casts never produce a hit the user cannot see.
  return [...rows].filter((row) => allowed(row) && rowMatches(row, spec, terms)).slice(0, PER_TABLE_LIMIT).map((row) => toSearchHit(row, spec, terms));
}

export async function searchEverything(query: string, viewer: SearchViewer): Promise<{ hits: SearchHit[]; failedTables: string[] }> {
  const terms = searchTerms(query);
  if (!terms.length) return { hits: [], failedTables: [] };
  const specs = searchSpecs();
  // One broken table (e.g. a column not migrated yet) must not take the whole search down.
  // All tables share one client: on Hyperdrive each withPostgres call opens its own connection.
  const settled = await withPostgres((sql) => Promise.allSettled(specs.map((spec) => searchTable(sql, spec, terms, viewer))));
  const hits: SearchHit[] = [];
  const failedTables: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") hits.push(...result.value);
    else failedTables.push(specs[index].table);
  });
  if (failedTables.length) console.warn("[search] tables failed:", failedTables.join(", "));
  return { hits: rankSearchHits(hits, terms).slice(0, TOTAL_LIMIT), failedTables };
}
