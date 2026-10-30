import { agentCaller } from "@/lib/api/agent-tokens";
import { MT_GUIDE, syncMtProspects } from "@/lib/agent/sync";

export const runtime = "nodejs";

// Claude access → Job Vacancy MT. GET explains the format; POST previews or applies.

export async function GET(request: Request) {
  if (!(await agentCaller(request, "job-vacancy-mt"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(MT_GUIDE);
}

export async function POST(request: Request) {
  const caller = await agentCaller(request, "job-vacancy-mt");
  if (!caller) return Response.json({ error: "Unauthorized: a Claude access key for Job Vacancy MT, or sign in." }, { status: 401 });
  const result = await syncMtProspects(await request.json().catch(() => null), caller.label);
  return Response.json(result.json, { status: result.status });
}
