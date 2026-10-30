import { OAuthError, registerClient } from "@/lib/mcp/oauth";
import { withPostgres } from "@/lib/db/postgres";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const PER_ADDRESS = 20;
const seen = new Map<string, number[]>();
function allow(address: string) {
  const now = Date.now();
  const recent = (seen.get(address) || []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= PER_ADDRESS) return false;
  recent.push(now); seen.set(address, recent);
  if (seen.size > 5000) for (const [key, list] of seen) if (!list.some((at) => now - at < WINDOW_MS)) seen.delete(key);
  return true;
}

// Claude registers itself before signing someone in (RFC 7591). Only Claude's callbacks are allowed.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { client_name?: unknown; redirect_uris?: unknown } | null;
  if (!body) return Response.json({ error: "invalid_client_metadata", error_description: "Send JSON." }, { status: 400 });
  // A burst of registrations is not Claude connecting; it would only fill the table. Limited per
  // address on this server, with a high overall ceiling as a backstop.
  const address = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
  if (!allow(address)) return Response.json({ error: "temporarily_unavailable", error_description: "Too many registrations. Try again later." }, { status: 429 });
  const [recent] = await withPostgres((sql) => sql<Array<{ n: number }>>`select count(*)::int as n from oauth_clients where created_at > now() - interval '10 minutes'`);
  if (recent.n >= 1000) return Response.json({ error: "temporarily_unavailable", error_description: "Too many registrations. Try again later." }, { status: 429 });
  try {
    const client = await registerClient(body);
    return Response.json({ ...client, client_id_issued_at: Math.floor(Date.now() / 1000), token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }, { status: 201 });
  } catch (error) {
    if (error instanceof OAuthError) return Response.json({ error: error.code, error_description: error.message }, { status: 400 });
    throw error;
  }
}
