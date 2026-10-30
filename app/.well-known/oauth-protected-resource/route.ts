import { originOf } from "@/lib/mcp/origin";
import { protectedResourceMetadata } from "@/lib/mcp/oauth-rules";

// Claude connector: which sign-in protects /api/mcp (RFC 9728).
export function GET(request: Request) {
  return Response.json(protectedResourceMetadata(originOf(request)), { headers: { "Cache-Control": "no-store" } });
}
