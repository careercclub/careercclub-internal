import { auth } from "@/auth";
import { MIN_SEARCH_LENGTH } from "@/lib/search/registry";
import { searchEverything } from "@/lib/search/query";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const query = (new URL(request.url).searchParams.get("q") || "").slice(0, 120).trim();
  if (query.length < MIN_SEARCH_LENGTH) return Response.json({ hits: [] }, { headers: { "Cache-Control": "no-store" } });

  const { hits } = await searchEverything(query, { role: session.user.role, userId: session.user.id, email: session.user.email });
  return Response.json({ hits }, { headers: { "Cache-Control": "no-store" } });
}
