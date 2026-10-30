import { agentCaller } from "@/lib/api/agent-tokens";
import { INSTAGRAM_GUIDE, syncInstagram } from "@/lib/agent/sync";

export const runtime = "nodejs";

// Claude access → Instagram & Content Evaluation. GET explains the format; POST previews or applies.

export async function GET(request: Request) {
  if (!(await agentCaller(request, "instagram"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(INSTAGRAM_GUIDE);
}

export async function POST(request: Request) {
  const caller = await agentCaller(request, "instagram");
  if (!caller) return Response.json({ error: "Unauthorized: a Claude access key for Instagram & Content Evaluation, or sign in and call it from an internal.ccclub.id page." }, { status: 401 });
  const result = await syncInstagram(await request.json().catch(() => null), caller.label);
  return Response.json(result.json, { status: result.status });
}
