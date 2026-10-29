import "server-only";
import { withPostgres } from "@/lib/db/postgres";
import { errorFingerprint, maskMessage, type ErrorKind } from "./error-text";

// Unexpected server errors, kept where an admin can see them (Settings → Errors, migration 032).
// Recording never throws and never slows the request down noticeably: if the table is missing or
// the database is down, the error still goes to the server log as before.

export type ServerErrorRow = { id: string; kind: ErrorKind; place: string; message: string; count: number; first_at: string; last_at: string; fixed_at: string | null };

export async function recordServerError(input: { kind: ErrorKind; place: string; error: unknown; digest?: string }) {
  try {
    const raw = input.error instanceof Error ? `${input.error.name === "Error" ? "" : `${input.error.name}: `}${input.error.message}` : String(input.error);
    const message = maskMessage(raw) || "Unknown error";
    const place = maskMessage(input.place).slice(0, 200) || "unknown";
    const fingerprint = errorFingerprint(input.kind, place, message);
    await withPostgres((sql) => sql`
      insert into app_errors (fingerprint, kind, place, message, digest)
      values (${fingerprint}, ${input.kind}, ${place}, ${message}, ${input.digest || null})
      on conflict (fingerprint) do update
      set count = app_errors.count + 1, last_at = now(), fixed_at = null, digest = coalesce(excluded.digest, app_errors.digest)`);
  } catch {
    // The log line below is the fallback.
  }
}

/** Latest first; unfixed before fixed. null when migration 032 has not run. */
export async function listServerErrors(limit = 100): Promise<ServerErrorRow[] | null> {
  try {
    return await withPostgres(async (sql) => [...await sql<ServerErrorRow[]>`
      select id::text as id, kind, place, message, count, first_at, last_at, fixed_at
      from app_errors order by (fixed_at is null) desc, last_at desc limit ${limit}`]);
  } catch {
    return null;
  }
}

export function markServerErrorFixed(id: string) {
  return withPostgres((sql) => sql`update app_errors set fixed_at = now() where id = ${id}::bigint`);
}
