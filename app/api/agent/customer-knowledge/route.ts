import { logActivity } from "@/lib/api/activity";
import { agentCaller } from "@/lib/api/agent-tokens";
import { applyPainPoints, painPointLists, previewPainPoints } from "@/lib/api/customer-knowledge-agent";
import { MAX_PAIN_POINTS } from "@/lib/customer-knowledge/agent";
import { withPostgres } from "@/lib/db/postgres";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

// Claude access → Customer Knowledge (pain points). GET explains the format and lists the
// platforms and categories to use; POST previews or applies.
const GUIDE = {
  module: "Customer Knowledge",
  auth: "Authorization: Bearer <Claude access key from Settings → Claude access>, or a signed-in browser session (run fetch on an internal.ccclub.id page, e.g. with Claude in Chrome).",
  steps: [
    "Collect comments in the customer's own words (Instagram, TikTok, X, forums…) and classify each one.",
    "POST with mode \"preview\" and show the person the summary and anything invalid.",
    "After they agree, POST the same body with mode \"apply\". Nothing is ever deleted.",
  ],
  request: { mode: "preview | apply", pain_points: `up to ${MAX_PAIN_POINTS} items` },
  pain_point: {
    comment: "string, required: the comment as the person wrote it",
    platform: "string, required: one of platforms below",
    category: "string, required: one of categories below",
    month: "required: 1–12, Okt / Oct, or the comment's date YYYY-MM-DD",
    username: "string", source_url: "https://… link to the comment or post", notes: "string",
    labels: "string[], short tags such as \"BUMN\", \"Psikotes\"",
  },
  rules: [
    "The same comment (ignoring case, spaces and punctuation) on the same platform is not added twice.",
    "For a comment that is already there, only empty username / source / notes are filled and missing labels are added.",
    "Platform and category must already exist in Customer Knowledge (ask the person to add a new one first).",
    "New pain points show \"Added by Claude\".",
  ],
};

export async function GET(request: Request) {
  if (!(await agentCaller(request, "customer-knowledge"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ ...GUIDE, ...(await withPostgres((sql) => painPointLists(sql))) });
}

export async function POST(request: Request) {
  const caller = await agentCaller(request, "customer-knowledge");
  if (!caller) return Response.json({ error: "Unauthorized: a Claude access key for Customer Knowledge, or sign in and call it from an internal.ccclub.id page." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { mode?: unknown; pain_points?: unknown } | null;
  const mode = body?.mode === "apply" ? "apply" : body?.mode === "preview" ? "preview" : null;
  if (!mode) return Response.json({ error: "mode must be \"preview\" or \"apply\".", guide: GUIDE }, { status: 400 });
  if (!Array.isArray(body?.pain_points) || !body.pain_points.length) return Response.json({ error: "pain_points must be a non-empty list.", guide: GUIDE }, { status: 400 });
  if (body.pain_points.length > MAX_PAIN_POINTS) return Response.json({ error: `At most ${MAX_PAIN_POINTS} pain points per request.` }, { status: 400 });
  try {
    if (mode === "preview") return Response.json({ mode, ...(await previewPainPoints(body.pain_points)) });
    const result = await applyPainPoints(body.pain_points, caller.label);
    const s = result.summary;
    await logActivity({ userName: caller.label, module: "Customer Knowledge", action: "Claude update", detail: `${s.added} added · ${s.updated} updated · ${s.invalid} skipped`, table: "pain_points" });
    revalidatePath("/customer-knowledge");
    return Response.json({ mode, ...result });
  } catch (error) {
    console.error("[api/agent/customer-knowledge] failed", error);
    return Response.json({ error: "Could not update Customer Knowledge. Nothing was changed." }, { status: 500 });
  }
}
