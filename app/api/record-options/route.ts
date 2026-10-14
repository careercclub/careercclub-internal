import { auth } from "@/auth";
import { isRecordDefinitionKey } from "@/lib/records/catalog";
import { getReferenceOptions } from "@/lib/records/options";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!isRecordDefinitionKey(key)) return Response.json({ error: "Unknown record definition." }, { status: 400 });
  const options = await getReferenceOptions(key, { role: session.user.role, userId: session.user.id, email: session.user.email });
  return Response.json({ options }, { headers: { "Cache-Control": "no-store" } });
}
