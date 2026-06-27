import "server-only";
import type { Row } from "postgres";
import { sql } from "./postgres";
import { assertIdentifier, assertTableName, type TableName } from "./tables";

export type QueryOptions = {
  eq?: Record<string, string | number | boolean | null>;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
};

type RowValues = Record<string, unknown>;

function tableSql(table: TableName) {
  assertTableName(table);
  return sql.unsafe(`"${table}"`);
}

function columnSql(column: string) {
  assertIdentifier(column);
  return sql.unsafe(`"${column}"`);
}

function whereSql(options?: QueryOptions) {
  const entries = Object.entries(options?.eq ?? {});

  if (!entries.length) {
    return sql``;
  }

  return sql`where ${entries.map(([column, value]) => {
    const identifier = columnSql(column);
    return value === null ? sql`${identifier} is null` : sql`${identifier} = ${value}`;
  })}`;
}

function orderSql(options?: QueryOptions) {
  if (!options?.orderBy) {
    return sql``;
  }

  const direction = options.ascending === false ? sql`desc` : sql`asc`;
  return sql`order by ${columnSql(options.orderBy)} ${direction}`;
}

function limitSql(options?: QueryOptions) {
  if (!options?.limit) {
    return sql``;
  }

  return sql`limit ${options.limit}`;
}

export async function listRows<T extends Row>(
  table: TableName,
  options?: QueryOptions,
): Promise<T[]> {
  const rows = await sql<T[]>`
    select *
    from ${tableSql(table)}
    ${whereSql(options)}
    ${orderSql(options)}
    ${limitSql(options)}
  `;

  return [...rows];
}

export async function countRows(table: TableName, options?: Pick<QueryOptions, "eq">) {
  const rows = await sql<{ count: string }[]>`
    select count(*)::text as count
    from ${tableSql(table)}
    ${whereSql(options)}
  `;

  return Number(rows[0]?.count ?? 0);
}

export async function getRowById<T extends Row>(table: TableName, id: string): Promise<T | null> {
  const rows = await listRows<T>(table, { eq: { id }, limit: 1 });
  return rows[0] ?? null;
}

export async function insertRow<T extends Row>(table: TableName, values: RowValues): Promise<T> {
  const [row] = await sql<T[]>`
    insert into ${tableSql(table)}
    ${sql(values)}
    returning *
  `;

  return row;
}

export async function updateRow<T extends Row>(
  table: TableName,
  id: string,
  values: RowValues,
): Promise<T | null> {
  const [row] = await sql<T[]>`
    update ${tableSql(table)}
    set ${sql(values)}
    where "id" = ${id}
    returning *
  `;

  return row ?? null;
}

export async function deleteRow(table: TableName, id: string) {
  const result = await sql`
    delete from ${tableSql(table)}
    where "id" = ${id}
  `;

  return result.count ?? 0;
}
