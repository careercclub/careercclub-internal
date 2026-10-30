import "server-only";
import type { Sql } from "postgres";
import { withPostgres } from "@/lib/db/postgres";
import { assertIdentifier, assertTableName } from "@/lib/db/tables";
import { recordDefinitions } from "@/lib/records/catalog";
import { TICKET_VISIBILITY_COLUMNS, ticketVisibility, type TicketViewer } from "@/lib/tickets/visibility";
import { extraSearchDefinitions } from "./extra-definitions";
import { buildSearchSpecs, rankSearchHits, rowMatches, rowMatchesClosely, searchTerms, termGroups, toSearchHit, type SearchHit, type SearchSpec } from "./registry";
import { typoBudget } from "./synonyms";

const PER_TABLE_LIMIT = 8;
// Spelling tolerance runs only when the exact pass finds fewer than this many records.
const CLOSE_PASS_BELOW = 3;
// pg_trgm word_similarity cut-off for the candidate query; the exact typo rule is re-checked in JS.
const CLOSE_SIMILARITY = 0.4;
const TOTAL_LIMIT = 40;
// Guarded tables fetch more candidates so hidden rows do not crowd out visible ones.
const GUARDED_FETCH_LIMIT = 200;

let cachedSpecs: SearchSpec[] | null = null;
export function searchSpecs() {
  cachedSpecs ??= buildSearchSpecs({ ...recordDefinitions, ...extraSearchDefinitions });
  return cachedSpecs;
}

/** PostgreSQL regex: the word at the start of the text or after a non-letter/digit. */
function wordStartPattern(word: string) {
  return `(^|[^[:alnum:]])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
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

async function searchTable(sql: Sql, spec: SearchSpec, terms: string[], viewer: SearchViewer, close = false) {
  assertTableName(spec.table);
  const columns = spec.fields.map((field) => field.name);
  const guard = ROW_GUARDS[spec.key];
  columns.forEach(assertIdentifier);
  guard?.columns.forEach(assertIdentifier);
  const haystack = `concat_ws(' ', ${columns.map((column) => `"${column}"::text`).join(", ")})`;
  const selected = ["id", ...columns, ...(guard?.columns || [])].map((column) => `"${column}"`).join(", ");
  // Every typed word must match; a word matches through itself or a synonym. In the close pass
  // a long word may instead be a near spelling (pg_trgm candidates, confirmed in JS below).
  const conditions = termGroups(terms).map((group) => {
    // The typed word anywhere; its synonyms only at the start of a word (same rule as rowMatches).
    const [typed, ...synonyms] = group;
    const exact = synonyms.length
      ? sql`(${sql.unsafe(haystack)} ilike ${likePattern(typed)} or ${sql.unsafe(haystack)} ~* any(${synonyms.map(wordStartPattern)}::text[]))`
      : sql`${sql.unsafe(haystack)} ilike ${likePattern(typed)}`;
    return close && typoBudget(group[0]) ? sql`(${exact} or word_similarity(${group[0]}, lower(${sql.unsafe(haystack)})) >= ${CLOSE_SIMILARITY})` : exact;
  });
  const where = conditions.reduce((all, condition) => sql`${all} and ${condition}`);
  const rows = await sql<Record<string, unknown>[]>`
    select ${sql.unsafe(selected)}
    from ${sql.unsafe(`"${spec.table}"`)}
    where ${where}
    limit ${guard || close ? GUARDED_FETCH_LIMIT : PER_TABLE_LIMIT}
  `;
  // A guarded table checks per row; with a guard the limit is applied after filtering.
  const allowed = guard ? await guard.load(sql, viewer) : () => true;
  // Re-check in JS so JSON keys or casts never produce a hit the user cannot see.
  const confirm = close ? (row: Record<string, unknown>) => !rowMatches(row, spec, terms) && rowMatchesClosely(row, spec, terms) : (row: Record<string, unknown>) => rowMatches(row, spec, terms);
  return [...rows].filter((row) => allowed(row) && confirm(row)).slice(0, PER_TABLE_LIMIT).map((row) => toSearchHit(row, spec, terms, close));
}

async function searchAllTables(sql: Sql, specs: SearchSpec[], terms: string[], viewer: SearchViewer, close: boolean) {
  return Promise.allSettled(specs.map((spec) => searchTable(sql, spec, terms, viewer, close)));
}

/** `omit`: fields that must not be searched or shown for this caller (the Claude connector masks bank accounts). */
export async function searchEverything(query: string, viewer: SearchViewer, options: { omit?: (table: string, field: string) => boolean } = {}): Promise<{ hits: SearchHit[]; failedTables: string[] }> {
  const terms = searchTerms(query);
  if (!terms.length) return { hits: [], failedTables: [] };
  const omit = options.omit;
  const specs = omit ? searchSpecs().map((spec) => ({ ...spec, fields: spec.fields.filter((field) => !omit(spec.table, field.name)) })).filter((spec) => spec.fields.length) : searchSpecs();
  // One broken table (e.g. a column not migrated yet) must not take the whole search down.
  // All tables share one client: on Hyperdrive each withPostgres call opens its own connection.
  const { settled, close } = await withPostgres(async (sql) => {
    const exact = await searchAllTables(sql, specs, terms, viewer, false);
    const found = exact.reduce((total, result) => total + (result.status === "fulfilled" ? result.value.length : 0), 0);
    // Few results and a word long enough for a typo: look for close spellings too. Needs the
    // pg_trgm extension (migration 026); without it this pass fails quietly and search stays exact.
    const wantsClose = found < CLOSE_PASS_BELOW && terms.some((term) => typoBudget(term) > 0);
    return { settled: exact, close: wantsClose ? await searchAllTables(sql, specs, terms, viewer, true) : [] };
  });
  const hits: SearchHit[] = [];
  const failedTables: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") hits.push(...result.value);
    else failedTables.push(specs[index].table);
  });
  const seen = new Set(hits.map((hit) => `${hit.key}:${hit.id}`));
  close.forEach((result) => { if (result.status === "fulfilled") hits.push(...result.value.filter((hit) => !seen.has(`${hit.key}:${hit.id}`))); });
  if (failedTables.length) console.warn("[search] tables failed:", failedTables.join(", "));
  return { hits: rankSearchHits(hits, terms).slice(0, TOTAL_LIMIT), failedTables };
}

/**
 * "Ask AI" (level 1): search with the keywords the AI derived from a question. A record needs
 * one keyword (or synonym), more keywords rank higher; modules the AI named are searched and
 * ranked first. Same tables, columns and row guards as the normal search.
 */
export async function searchWithKeywords(keywords: string[], moduleKeys: string[], viewer: SearchViewer): Promise<SearchHit[]> {
  const words = [...new Set(termGroups(keywords).flat())].filter((word) => word.length >= 2);
  if (!words.length) return [];
  const all = searchSpecs();
  const named = moduleKeys.length ? all.filter((spec) => moduleKeys.includes(spec.key)) : [];
  const specs = named.length ? named : all;
  const order = (key: string) => { const index = moduleKeys.indexOf(key); return index < 0 ? moduleKeys.length : index; };
  const settled = await withPostgres((sql) => Promise.allSettled(specs.map(async (spec) => {
    assertTableName(spec.table);
    const columns = spec.fields.map((field) => field.name);
    const guard = ROW_GUARDS[spec.key];
    columns.forEach(assertIdentifier);
    guard?.columns.forEach(assertIdentifier);
    const haystack = `concat_ws(' ', ${columns.map((column) => `"${column}"::text`).join(", ")})`;
    const selected = ["id", ...columns, ...(guard?.columns || [])].map((column) => `"${column}"`).join(", ");
    const rows = await sql<Record<string, unknown>[]>`
      select ${sql.unsafe(selected)} from ${sql.unsafe(`"${spec.table}"`)}
      where ${sql.unsafe(haystack)} ilike any(${words.map(likePattern)}::text[])
      limit ${GUARDED_FETCH_LIMIT}
    `;
    const allowed = guard ? await guard.load(sql, viewer) : () => true;
    return [...rows].filter(allowed).map((row) => {
      const matched = keywords.filter((keyword) => rowMatches(row, spec, [keyword]));
      return { hit: toSearchHit(row, spec, matched.length ? matched : keywords), score: matched.length, order: order(spec.key) };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, PER_TABLE_LIMIT);
  })));
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => b.score - a.score || a.order - b.order || a.hit.title.localeCompare(b.hit.title))
    .slice(0, TOTAL_LIMIT)
    .map((item) => item.hit);
}
