import { agentCaller } from "@/lib/api/agent-tokens";
import { withPostgres } from "@/lib/db/postgres";
import { painPointLists } from "@/lib/api/customer-knowledge-agent";
import { CUSTOMER_KNOWLEDGE_GUIDE, syncCustomerKnowledge } from "@/lib/agent/sync";

export const runtime = "nodejs";

// Claude access → Customer Knowledge (pain points). GET explains the format and lists the
// platforms and categories to use; POST previews or applies.

export async function GET(request: Request) {
  if (!(await agentCaller(request, "customer-knowledge"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ ...CUSTOMER_KNOWLEDGE_GUIDE, ...(await withPostgres((sql) => painPointLists(sql))) });
}

export async function POST(request: Request) {
  const caller = await agentCaller(request, "customer-knowledge");
  if (!caller) return Response.json({ error: "Unauthorized: a Claude access key for Customer Knowledge, or sign in and call it from an internal.ccclub.id page." }, { status: 401 });
  const result = await syncCustomerKnowledge(await request.json().catch(() => null), caller.label);
  return Response.json(result.json, { status: result.status });
}
