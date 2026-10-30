import { revokeToken } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

// RFC 7009: Claude (or anyone holding the token) ends the connection. Always 200.
export async function POST(request: Request) {
  const form = new URLSearchParams(await request.text());
  const token = (form.get("token") || "").trim();
  if (token) await revokeToken(token);
  return new Response(null, { status: 200 });
}
