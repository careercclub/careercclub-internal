import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import postgres from "postgres";

type GlobalWithSql = typeof globalThis & {
  __cccPostgresSql?: postgres.Sql;
};

type ConnectionConfig = {
  connectionString: string;
  hyperdrive: boolean;
};

const globalWithSql = globalThis as GlobalWithSql;

function getHyperdriveConnectionString() {
  try {
    return getCloudflareContext().env.HYPERDRIVE?.connectionString || null;
  } catch {
    return null;
  }
}

function getConnectionConfig(): ConnectionConfig {
  const hyperdriveConnectionString = getHyperdriveConnectionString();

  if (hyperdriveConnectionString) {
    return { connectionString: hyperdriveConnectionString, hyperdrive: true };
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error("Missing DATABASE_URL or POSTGRES_URL for PostgreSQL connection.");
  }

  return { connectionString, hyperdrive: false };
}

function getMaxConnections() {
  const parsed = Number(process.env.POSTGRES_MAX_CONNECTIONS || 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function createPostgresClient(config: ConnectionConfig) {
  return postgres(config.connectionString, {
    max: config.hyperdrive ? 5 : getMaxConnections(),
    prepare: process.env.POSTGRES_PREPARE !== "false",
  });
}

function getLocalPostgresClient(config: ConnectionConfig) {
  const existingClient = globalWithSql.__cccPostgresSql;

  if (existingClient) {
    return existingClient;
  }

  const client = createPostgresClient(config);

  if (process.env.NODE_ENV !== "production") {
    globalWithSql.__cccPostgresSql = client;
  }

  return client;
}

export async function withPostgres<T>(operation: (sql: postgres.Sql) => Promise<T>) {
  const config = getConnectionConfig();
  const client = config.hyperdrive
    ? createPostgresClient(config)
    : getLocalPostgresClient(config);

  try {
    return await operation(client);
  } finally {
    if (config.hyperdrive) {
      await client.end({ timeout: 1 });
    }
  }
}

export async function closePostgresConnection() {
  const client = globalWithSql.__cccPostgresSql;

  if (!client) {
    return;
  }

  await client.end({ timeout: 5 });
  globalWithSql.__cccPostgresSql = undefined;
}
