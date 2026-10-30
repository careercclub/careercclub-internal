import { exchangeCode, OAuthError, refreshTokens } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };

// Claude trades the sign-in code (with its PKCE verifier) for tokens, and refreshes them later.
export async function POST(request: Request) {
  const type = request.headers.get("content-type") || "";
  const form = type.includes("application/json")
    ? new URLSearchParams(Object.entries(((await request.json().catch(() => ({}))) || {}) as Record<string, string>).map(([k, v]) => [k, String(v)]))
    : new URLSearchParams(await request.text());
  const get = (name: string) => (form.get(name) || "").trim();
  try {
    const grant = get("grant_type");
    if (grant === "authorization_code") {
      return Response.json(await exchangeCode({ code: get("code"), clientId: get("client_id"), redirectUri: get("redirect_uri"), verifier: get("code_verifier") }), { headers: noStore });
    }
    if (grant === "refresh_token") {
      return Response.json(await refreshTokens({ refreshToken: get("refresh_token"), clientId: get("client_id") }), { headers: noStore });
    }
    throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch (error) {
    if (error instanceof OAuthError) return Response.json({ error: error.code, error_description: error.message }, { status: 400, headers: noStore });
    throw error;
  }
}
