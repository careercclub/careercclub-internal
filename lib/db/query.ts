import "server-only";
import type { Row, Sql } from "postgres";
import { withPostgres } from "./postgres";
import { assertIdentifier, assertTableName, type TableName } from "./tables";

export type QueryOptions = {
  eq?: Record<string, string | number | boolean | null>;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
};

type RowValues = Record<string, unknown>;

function tableSql(sql: Sql, table: TableName) {
  assertTableName(table);
  return sql.unsafe(`"${table}"`);
}

function columnSql(sql: Sql, column: string) {
  assertIdentifier(column);
  return sql.unsafe(`"${column}"`);
}

function whereSql(sql: Sql, options?: QueryOptions) {
  const entries = Object.entries(options?.eq ?? {});

  if (!entries.length) {
    return sql``;
  }

  return sql`where ${entries.map(([column, value]) => {
    const identifier = columnSql(sql, column);
    return value === null ? sql`${identifier} is null` : sql`${identifier} = ${value}`;
  })}`;
}

function orderSql(sql: Sql, options?: QueryOptions) {
  if (!options?.orderBy) {
    return sql``;
  }

  const direction = options.ascending === false ? sql`desc` : sql`asc`;
  return sql`order by ${columnSql(sql, options.orderBy)} ${direction}`;
}

function limitSql(sql: Sql, options?: QueryOptions) {
  if (!options?.limit) {
    return sql``;
  }

  return sql`limit ${options.limit}`;
}

export function listRows<T extends Row>(table: TableName, options?: QueryOptions): Promise<T[]> {
  return withPostgres(async (sql) => {
    const rows = await sql<T[]>`
      select *
      from ${tableSql(sql, table)}
      ${whereSql(sql, options)}
      ${orderSql(sql, options)}
      ${limitSql(sql, options)}
    `;

    return [...rows];
  });
}

export function countRows(table: TableName, options?: Pick<QueryOptions, "eq">) {
  return withPostgres(async (sql) => {
    const rows = await sql<{ count: string }[]>`
      select count(*)::text as count
      from ${tableSql(sql, table)}
      ${whereSql(sql, options)}
    `;

    return Number(rows[0]?.count ?? 0);
  });
}

export async function getRowById<T extends Row>(table: TableName, id: string): Promise<T | null> {
  const rows = await listRows<T>(table, { eq: { id }, limit: 1 });
  return rows[0] ?? null;
}

export function insertRow<T extends Row>(table: TableName, values: RowValues): Promise<T> {
  return withPostgres(async (sql) => {
    const [row] = await sql<T[]>`
      insert into ${tableSql(sql, table)}
      ${sql(values)}
      returning *
    `;

    return row;
  });
}

export function updateRow<T extends Row>(
  table: TableName,
  id: string,
  values: RowValues,
): Promise<T | null> {
  return withPostgres(async (sql) => {
    const [row] = await sql<T[]>`
      update ${tableSql(sql, table)}
      set ${sql(values)}
      where "id" = ${id}
      returning *
    `;

    return row ?? null;
  });
}

export function deleteRow(table: TableName, id: string) {
  return withPostgres(async (sql) => {
    const result = await sql`
      delete from ${tableSql(sql, table)}
      where "id" = ${id}
    `;

    return result.count ?? 0;
  });
}
