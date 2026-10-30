import { answer } from "@/lib/mcp/server";
import { userForAccessToken } from "@/lib/mcp/oauth";
import { bearer } from "@/lib/mcp/oauth-rules";
import { originOf } from "@/lib/mcp/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The CareerCclub connector for Claude (remote MCP server, Putaran 62). Add it in Claude as a
// custom connector with this URL; Claude signs the person in (OAuth) and calls tools as them.

function unauthorized(request: Request, hadToken: boolean) {
  const metadata = `${originOf(request)}/.well-known/oauth-protected-resource/api/mcp`;
  const challenge = `Bearer resource_metadata="${metadata}"${hadToken ? ', error="invalid_token"' : ""}`;
  return Response.json({ error: "unauthorized", error_description: "Connect this server in Claude and sign in." }, { status: 401, headers: { "WWW-Authenticate": challenge, "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const token = bearer(request.headers.get("authorization"));
  const user = token ? await userForAccessToken(token) : null;
  if (!user) return unauthorized(request, Boolean(token));
  if (Number(request.headers.get("content-length") || 0) > 2_000_000) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large (max 2 MB)." } }, { status: 413 });
  const text = await request.text();
  if (text.length > 2_000_000) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large (max 2 MB)." } }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } }, { status: 400 }); }
  const reply = await answer(body, user);
  if (!reply) return new Response(null, { status: 202 });
  return Response.json(reply, { headers: { "Cache-Control": "no-store" } });
}

// No server-to-client stream: every answer comes back on the POST.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
