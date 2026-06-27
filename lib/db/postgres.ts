import "server-only";
import postgres from "postgres";

type GlobalWithSql = typeof globalThis & {
  __cccPostgresSql?: postgres.Sql;
};

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error("Missing DATABASE_URL or POSTGRES_URL for PostgreSQL connection.");
  }

  return connectionString;
}

function getMaxConnections() {
  const parsed = Number(process.env.POSTGRES_MAX_CONNECTIONS || 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

const globalWithSql = globalThis as GlobalWithSql;

let client: postgres.Sql | undefined;

function createPostgresClient() {
  const existingClient = globalWithSql.__cccPostgresSql;

  if (existingClient) {
    return existingClient;
  }

  const nextClient = postgres(getConnectionString(), {
    max: getMaxConnections(),
    prepare: process.env.POSTGRES_PREPARE !== "false",
  });

  if (process.env.NODE_ENV !== "production") {
    globalWithSql.__cccPostgresSql = nextClient;
  }

  return nextClient;
}

function getPostgresClient() {
  client ??= createPostgresClient();
  return client;
}

const lazySqlTarget = function sqlProxy() {} as unknown as postgres.Sql;

export const sql = new Proxy(lazySqlTarget, {
  apply(_target, thisArg, argArray) {
    return Reflect.apply(getPostgresClient() as unknown as (...args: unknown[]) => unknown, thisArg, argArray);
  },
  get(_target, property) {
    const target = getPostgresClient();
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as postgres.Sql;

export async function closePostgresConnection() {
  if (!client) {
    return;
  }

  await client.end({ timeout: 5 });
  client = undefined;
}
