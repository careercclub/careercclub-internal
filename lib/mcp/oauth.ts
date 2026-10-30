import "server-only";
import { withPostgres } from "@/lib/db/postgres";
import { ACCESS_TTL_S, CODE_TTL_MS, hashSecret, isAllowedRedirect, newSecret, REFRESH_TTL_MS, redirectMatches, verifyPkce } from "./oauth-rules";

// Claude connector sign-in, database side (rules in oauth-rules.ts, tables in migration 034).
// Codes and tokens are random; only their SHA-256 is stored.

export type OAuthClient = { client_id: string; client_name: string; redirect_uris: string[] };
export type ConnectorUser = { id: string; email: string; name: string; role: string };
export class OAuthError extends Error {
  constructor(public code: "invalid_request" | "invalid_client" | "invalid_grant" | "invalid_redirect_uri" | "unsupported_grant_type", message: string) { super(message); }
}

/** Dynamic client registration (RFC 7591): only Claude's callbacks are accepted. */
export async function registerClient(input: { client_name?: unknown; redirect_uris?: unknown }): Promise<OAuthClient> {
  const uris = Array.isArray(input.redirect_uris) ? input.redirect_uris.map(String) : [];
  if (!uris.length || uris.length > 10 || !uris.every(isAllowedRedirect)) throw new OAuthError("invalid_redirect_uri", "Only Claude's sign-in callbacks can be registered.");
  const name = String(input.client_name || "Claude").slice(0, 80);
  return withPostgres(async (sql) => {
    // Registrations nobody finished signing in with are cleared after a day.
    await sql`delete from oauth_clients c where c.created_at < now() - interval '1 day'
      and not exists (select 1 from oauth_tokens t where t.client_id = c.client_id)`;
    // Public clients without a secret: the same app with the same callbacks reuses its client.
    const [same] = await sql<OAuthClient[]>`select client_id, client_name, redirect_uris from oauth_clients where client_name = ${name} and redirect_uris = ${uris} order by created_at desc limit 1`;
    if (same) return same;
    const client: OAuthClient = { client_id: newSecret("ccc_client"), client_name: name, redirect_uris: uris };
    await sql`insert into oauth_clients (client_id, client_name, redirect_uris) values (${client.client_id}, ${client.client_name}, ${client.redirect_uris})`;
    return client;
  });
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId) return null;
  return withPostgres(async (sql) => {
    const [row] = await sql<OAuthClient[]>`select client_id, client_name, redirect_uris from oauth_clients where client_id = ${clientId}`;
    return row ?? null;
  });
}

/** The person agreed on the consent screen: a one-time code for Claude (10 minutes). */
export async function issueCode(input: { clientId: string; userId: string; redirectUri: string; codeChallenge: string }) {
  const client = await getClient(input.clientId);
  if (!client || !redirectMatches(client.redirect_uris, input.redirectUri)) throw new OAuthError("invalid_client", "Unknown app or callback.");
  const code = newSecret("ccc_code");
  await withPostgres((sql) => sql`insert into oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, expires_at) values (${hashSecret(code)}, ${input.clientId}, ${input.userId}, ${input.redirectUri}, ${input.codeChallenge}, ${new Date(Date.now() + CODE_TTL_MS)})`);
  return code;
}

async function accountOf(userId: string): Promise<ConnectorUser | null> {
  return withPostgres(async (sql) => {
    const [row] = await sql<Array<{ id: string; email: string; name: string | null; role: string | null; is_active: boolean | null }>>`select id::text as id, email, name, role, is_active from auth_users where id::text = ${userId} limit 1`;
    if (!row || row.is_active === false) return null;
    return { id: row.id, email: row.email, name: row.name || row.email, role: (row.role || "member").toLowerCase() };
  });
}

async function issueTokens(clientId: string, user: ConnectorUser, codeHash: string | null) {
  const access = newSecret("ccc_at"); const refresh = newSecret("ccc_rt");
  await withPostgres((sql) => sql`insert into oauth_tokens (client_id, user_id, user_label, code_hash, access_hash, refresh_hash, access_expires_at, refresh_expires_at)
    values (${clientId}, ${user.id}, ${user.name}, ${codeHash}, ${hashSecret(access)}, ${hashSecret(refresh)}, ${new Date(Date.now() + ACCESS_TTL_S * 1000)}, ${new Date(Date.now() + REFRESH_TTL_MS)})`);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: "data offline_access" };
}

/** authorization_code grant: one use, unexpired, same client and callback, PKCE verified. */
export async function exchangeCode(input: { code: string; clientId: string; redirectUri: string; verifier: string }) {
  const codeHash = hashSecret(input.code);
  const row = await withPostgres(async (sql) => {
    const [found] = await sql<Array<{ client_id: string; user_id: string; redirect_uri: string; code_challenge: string; expires_at: Date }>>`
      update oauth_codes set used_at = now() where code_hash = ${codeHash} and used_at is null
      returning client_id, user_id, redirect_uri, code_challenge, expires_at`;
    // A code used a second time may have been stolen: end whatever the first use connected.
    if (!found) await sql`update oauth_tokens set revoked_at = now() where code_hash = ${codeHash} and revoked_at is null`;
    return found;
  });
  if (!row || row.expires_at.getTime() < Date.now()) throw new OAuthError("invalid_grant", "The sign-in code is invalid or expired.");
  if (row.client_id !== input.clientId || row.redirect_uri !== input.redirectUri) throw new OAuthError("invalid_grant", "The sign-in code was issued to another app.");
  if (!verifyPkce(input.verifier, row.code_challenge)) throw new OAuthError("invalid_grant", "PKCE check failed.");
  const user = await accountOf(row.user_id);
  if (!user) throw new OAuthError("invalid_grant", "This account can no longer sign in.");
  return issueTokens(row.client_id, user, codeHash);
}

/** refresh_token grant: the old pair stops working (rotation). A reused refresh token ends the whole connection. */
export async function refreshTokens(input: { refreshToken: string; clientId: string }) {
  const hash = hashSecret(input.refreshToken);
  const row = await withPostgres(async (sql) => {
    const [found] = await sql<Array<{ id: string; client_id: string; user_id: string; code_hash: string | null; refresh_expires_at: Date; revoked_at: Date | null }>>`
      select id, client_id, user_id, code_hash, refresh_expires_at, revoked_at from oauth_tokens where refresh_hash = ${hash}`;
    return found;
  });
  if (!row || row.client_id !== input.clientId) throw new OAuthError("invalid_grant", "Unknown refresh token.");
  if (row.revoked_at) {
    await withPostgres((sql) => sql`update oauth_tokens set revoked_at = now() where client_id = ${row.client_id} and user_id = ${row.user_id} and revoked_at is null`);
    throw new OAuthError("invalid_grant", "This refresh token was already used. Connect again.");
  }
  if (row.refresh_expires_at.getTime() < Date.now()) throw new OAuthError("invalid_grant", "The connection expired. Connect again.");
  const user = await accountOf(row.user_id);
  if (!user) throw new OAuthError("invalid_grant", "This account can no longer sign in.");
  const revoked = await withPostgres((sql) => sql`update oauth_tokens set revoked_at = now() where id = ${row.id} and revoked_at is null`);
  if (!revoked.count) throw new OAuthError("invalid_grant", "This refresh token was already used. Connect again.");
  return issueTokens(row.client_id, user, row.code_hash);
}

/** The person behind a connector call, or null (unknown, expired, disconnected, or account Blocked). */
export async function userForAccessToken(token: string): Promise<ConnectorUser | null> {
  if (!token) return null;
  const row = await withPostgres(async (sql) => {
    const [found] = await sql<Array<{ user_id: string }>>`
      update oauth_tokens set last_used_at = now()
      where access_hash = ${hashSecret(token)} and revoked_at is null and access_expires_at > now()
      returning user_id`;
    return found;
  });
  return row ? accountOf(row.user_id) : null;
}

/** RFC 7009: ends the connection a token belongs to (access or refresh). */
export async function revokeToken(token: string) {
  const hash = hashSecret(token);
  await withPostgres((sql) => sql`update oauth_tokens set revoked_at = now() where (access_hash = ${hash} or refresh_hash = ${hash}) and revoked_at is null`);
}

export type ConnectorConnection = { id: string; client_name: string; user_label: string; created_at: string; last_used_at: string | null };

/** Settings → Claude access: who has Claude connected (one row per sign-in, newest token). */
export async function listConnections(): Promise<ConnectorConnection[]> {
  return withPostgres(async (sql) => {
    const rows = await sql<Array<{ id: string; client_name: string; user_label: string; created_at: Date; last_used_at: Date | null }>>`
      select t.id::text as id, c.client_name, t.user_label, t.created_at, t.last_used_at
      from oauth_tokens t join oauth_clients c using (client_id)
      where t.revoked_at is null and t.refresh_expires_at > now()
      order by coalesce(t.last_used_at, t.created_at) desc`;
    return rows.map((row) => ({ ...row, created_at: row.created_at.toISOString(), last_used_at: row.last_used_at ? row.last_used_at.toISOString() : null }));
  });
}

/**
 * Ends a person's connection. The listed row may already have been replaced by a refresh (every
 * hour), so every live row of that person and app is ended. Returns how many were still live.
 */
export async function disconnect(id: string) {
  return withPostgres(async (sql) => {
    const result = await sql`update oauth_tokens t set revoked_at = now()
      from oauth_tokens picked
      where picked.id::text = ${id} and t.client_id = picked.client_id and t.user_id = picked.user_id and t.revoked_at is null`;
    return result.count || 0;
  });
}
