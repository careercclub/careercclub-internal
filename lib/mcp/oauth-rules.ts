// Rules for signing Claude in to the connector (OAuth 2.1 with PKCE, Putaran 62). Pure: tested
// under `node --test`; the database side is lib/mcp/oauth.ts.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const ACCESS_TTL_S = 60 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SCOPES = ["data", "offline_access"] as const;

/** Where Claude's hosted apps (claude.ai, Desktop, mobile) come back after signing in. */
export const CLAUDE_CALLBACKS = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"];

function loopback(uri: URL) {
  return uri.protocol === "http:" && (uri.hostname === "localhost" || uri.hostname === "127.0.0.1") && !uri.username && !uri.password;
}

/** Only Claude may register: its hosted callback, or Claude Code's loopback on any port. */
export function isAllowedRedirect(value: string) {
  if (CLAUDE_CALLBACKS.includes(value)) return true;
  try { const uri = new URL(value); return loopback(uri) && !uri.hash; } catch { return false; }
}

/** The redirect sent at sign-in matches a registered one (loopback: any port, same path). */
export function redirectMatches(registered: readonly string[], given: string) {
  if (registered.includes(given)) return true;
  let target: URL;
  try { target = new URL(given); } catch { return false; }
  if (!loopback(target)) return false;
  return registered.some((item) => {
    try { const uri = new URL(item); return loopback(uri) && uri.hostname === target.hostname && uri.pathname === target.pathname; } catch { return false; }
  });
}

const base64url = (buffer: Buffer) => buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function pkceChallenge(verifier: string) {
  return base64url(createHash("sha256").update(verifier).digest());
}

/** RFC 7636: verifier is 43–128 characters from the unreserved set, and S256 of it equals the challenge. */
export function verifyPkce(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier) || !challenge) return false;
  const a = Buffer.from(pkceChallenge(verifier)); const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A new secret (code, token, client id) and what is stored of it. Only the hash reaches the database. */
export function newSecret(prefix: string) {
  return `${prefix}_${base64url(randomBytes(32))}`;
}
export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** "Bearer abc" → "abc". */
export function bearer(header: string | null) {
  const match = /^Bearer\s+(\S+)$/i.exec(String(header || "").trim());
  return match ? match[1] : "";
}

/** Text shown on the consent screen: where Claude will send the person back. */
export function redirectHost(value: string) {
  try { return new URL(value).host; } catch { return ""; }
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...SCOPES],
  };
}

export function protectedResourceMetadata(origin: string) {
  return { resource: `${origin}/api/mcp`, authorization_servers: [origin], scopes_supported: [...SCOPES], bearer_methods_supported: ["header"], resource_name: "CareerCclub Internal" };
}

/** The public address of the app: AUTH_URL in production, else what the proxy says. */
export function publicOrigin(headers: { get(name: string): string | null }, url: string, configured = "") {
  if (configured) return configured.replace(/\/+$/, "");
  const host = (headers.get("x-forwarded-host") || headers.get("host") || new URL(url).host).split(",")[0].trim();
  const proto = (headers.get("x-forwarded-proto") || new URL(url).protocol.replace(":", "")).split(",")[0].trim();
  return `${proto}://${host}`;
}
