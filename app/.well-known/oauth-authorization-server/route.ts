import { originOf } from "@/lib/mcp/origin";
import { authorizationServerMetadata } from "@/lib/mcp/oauth-rules";

// Claude connector: where Claude signs in (RFC 8414).
export function GET(request: Request) {
  return Response.json(authorizationServerMetadata(originOf(request)), { headers: { "Cache-Control": "no-store" } });
}
