import { agentCaller } from "@/lib/api/agent-tokens";
import { COMPETITOR_GUIDE, syncCompetitorIntel } from "@/lib/agent/sync";

export const runtime = "nodejs";

// Claude access → Competitor Intel. GET explains the format; POST previews or applies.

export async function GET(request: Request) {
  if (!(await agentCaller(request, "competitor-intel"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(COMPETITOR_GUIDE);
}

export async function POST(request: Request) {
  const caller = await agentCaller(request, "competitor-intel");
  if (!caller) return Response.json({ error: "Unauthorized: a Claude access key for Competitor Intel, or sign in and call it from an internal.ccclub.id page." }, { status: 401 });
  const result = await syncCompetitorIntel(await request.json().catch(() => null), caller.label);
  return Response.json(result.json, { status: result.status });
}
