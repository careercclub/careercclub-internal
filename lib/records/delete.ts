import "server-only";
import type postgres from "postgres";
import { withPostgres } from "@/lib/db/postgres";
import { alsoDeletesText, DELETE_RULES, SIGN_IN_TEXT, stillUsedText, type UsedBy } from "./delete-rules";

// Every delete goes through here (rules in lib/records/delete-rules.ts): refused while other
// records still use it, otherwise the record and the rows that belong to it go in one transaction.

type Sql = postgres.Sql | postgres.TransactionSql;
type Counted = { one: string; many: string; n: number };

async function columnsOf(sql: Sql) {
  const tables = new Set<string>();
  for (const [table, rule] of Object.entries(DELETE_RULES)) {
    tables.add(table);
    for (const item of [...(rule.children || []), ...(rule.usedBy || [])]) tables.add(item.table);
  }
  const rows = await sql<Array<{ table_name: string; column_name: string }>>`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name = any(${[...tables]}::text[])`;
  const set = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
  return (table: string, column: string) => set.has(`${table}.${column}`);
}

type Has = Awaited<ReturnType<typeof columnsOf>>;

function matches(sql: Sql, item: UsedBy, ids: string[], names: string[]) {
  if (item.match === "ids") return sql`${sql(item.column)}::text[] && ${ids}::text[]`;
  if (item.match === "name") return sql`lower(trim(${sql(item.column)}::text)) = any(${names}::text[])`;
  return sql`${sql(item.column)}::text = any(${ids}::text[])`;
}

/** Who still uses these records: one count per table (a ticket holding the person twice counts once). */
async function stillUsed(sql: Sql, table: string, ids: string[], has: Has): Promise<string> {
  const rule = DELETE_RULES[table];
  if (!rule?.usedBy?.length && !rule?.signInColumn) return "";
  if (rule.signInColumn && has(table, rule.signInColumn)) {
    const [linked] = await sql`select 1 from ${sql(table)} where id::text = any(${ids}::text[]) and ${sql(rule.signInColumn)} is not null limit 1`;
    if (linked) return SIGN_IN_TEXT;
  }
  let names: string[] = [];
  if (rule.nameColumn) {
    const rows = await sql<Array<{ name: string | null }>>`select ${sql(rule.nameColumn)}::text as name from ${sql(table)} where id::text = any(${ids}::text[])`;
    names = rows.map((row) => String(row.name || "").trim().toLowerCase()).filter(Boolean);
  }
  const groups = new Map<string, UsedBy[]>();
  for (const item of rule.usedBy || []) {
    if (!has(item.table, item.column)) continue;
    groups.set(item.table, [...(groups.get(item.table) || []), item]);
  }
  const counts: Counted[] = [];
  for (const [other, items] of groups) {
    const conditions = items.map((item) => matches(sql, item, ids, names));
    const where = conditions.reduce((all, next) => sql`${all} or ${next}`);
    // A record that is part of what is being deleted does not block it (a product in its own bundle).
    const self = other === table ? sql` and not (id::text = any(${ids}::text[]))` : sql``;
    const [row] = await sql<Array<{ n: number }>>`select count(*)::int as n from ${sql(other)} where (${where})${self}`;
    // Several labels for one table (ticket / ticket request): the first names it.
    counts.push({ one: items[0].one, many: items[0].many, n: row.n });
  }
  return stillUsedText(counts);
}

async function childIds(sql: Sql, table: string, ids: string[], has: Has) {
  const found: Array<{ table: string; ids: string[]; one: string; many: string }> = [];
  for (const item of DELETE_RULES[table]?.children || []) {
    if (!has(item.table, item.column)) continue;
    const rows = await sql<Array<{ id: string }>>`select id::text as id from ${sql(item.table)} where ${sql(item.column)}::text = any(${ids}::text[])`;
    if (!rows.length) continue;
    const childList = rows.map((row) => row.id);
    found.push({ table: item.table, ids: childList, one: item.one, many: item.many });
    found.push(...await childIds(sql, item.table, childList, has));
  }
  return found;
}

/** For the confirm message: why it can't be deleted, or what goes with it. */
export function describeDelete(table: string, ids: string[]) {
  return withPostgres(async (sql) => {
    const has = await columnsOf(sql);
    const blocked = await stillUsed(sql, table, ids, has);
    if (blocked) return { blocked, also: "" };
    const children = await childIds(sql, table, ids, has);
    return { blocked: "", also: alsoDeletesText(children.map((item) => ({ one: item.one, many: item.many, n: item.ids.length }))) };
  });
}

/** Delete records and the rows that belong to them, in one transaction; refused while still in use. */
export async function deleteWithDependents(table: string, ids: string[], tx?: Sql): Promise<number> {
  const clean = [...new Set(ids.map(String).filter(Boolean))];
  if (!clean.length) return 0;
  const run = async (sql: Sql) => {
    const has = await columnsOf(sql);
    const blocked = await stillUsed(sql, table, clean, has);
    if (blocked) throw new Error(blocked);
    const children = await childIds(sql, table, clean, has);
    // Deepest first, so nothing is left pointing at a deleted row even for a moment.
    for (const item of [...children].reverse()) await sql`delete from ${sql(item.table)} where id::text = any(${item.ids}::text[])`;
    const result = await sql`delete from ${sql(table)} where id::text = any(${clean}::text[])`;
    return result.count || 0;
  };
  if (tx) return run(tx);
  return withPostgres((sql) => sql.begin((inner) => run(inner)));
}
