import { logActivity } from "@/lib/api/activity";
import { agentCaller } from "@/lib/api/agent-tokens";
import { applyCompetitors, previewCompetitors } from "@/lib/api/competitor-agent";
import { FLAG_TYPES, MAX_COMPETITORS } from "@/lib/competitor/agent";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

// Claude access → Competitor Intel. GET explains the format; POST previews or applies.
const GUIDE = {
  module: "Competitor Intel",
  auth: "Authorization: Bearer <Claude access key from Settings → Claude access>, or a signed-in browser session (run fetch on an internal.ccclub.id page, e.g. with Claude in Chrome).",
  steps: [
    "Research competitors (their sites, Instagram, TikTok, YouTube, ads library, pricing pages).",
    "POST with mode \"preview\" and show the person the summary, every possible_duplicate (with candidates) and every conflict.",
    "After they agree, POST the same body with mode \"apply\". For a possible duplicate add match_id (to update that competitor) or as_new: true. Nothing is ever deleted.",
  ],
  request: { mode: "preview | apply", competitors: `up to ${MAX_COMPETITORS} items` },
  competitor: {
    name: "string, required",
    category: "direct | indirect | substitute",
    primary_url: "https://…", platforms: "[\"Instagram\", \"TikTok\", \"YouTube\", \"X\", \"LinkedIn\", \"Website\"]",
    niche: "string, e.g. MT test prep", target_audience: "string or string[] (e.g. [\"Fresh grad\", \"Jobseeker\"])",
    threat_level: "low | medium | high (only filled when empty — the team decides)", notes: "string",
    followers: "{ \"Instagram\": 120000, \"TikTok\": 5000, \"YouTube\": 800 } — counted today",
    snapshot: "optional { date: YYYY-MM-DD (default today), ads_active: true|false, notes }",
    flags: `[{ type: ${FLAG_TYPES.join(" | ")}, date: YYYY-MM-DD, description, source_url? }]`,
    products: "[{ name, category?, description?, status?, price_min? (rupiah), price_max?, price_date? YYYY-MM-DD, features?: string[], links?: string[] }]",
    match_id: "string, the competitor id from a possible_duplicate candidate", as_new: "true to add as new although a similar name exists",
  },
  rules: [
    "Competitors are matched by name (case, PT, punctuation ignored); a close but different name is a possible_duplicate.",
    "An existing competitor only gets its empty fields filled; a different value is a conflict and is not written.",
    "Followers: the newest number per platform wins, and each day keeps a snapshot (follower history).",
    "Platforms, features and links are added, never removed. Flags are added once (same type, date and description = same flag).",
    "Products are matched by name per competitor. A new price is kept as a dated price; old prices stay.",
    "New competitors, products and flags show \"Added by Claude\".",
  ],
};

export async function GET(request: Request) {
  if (!(await agentCaller(request, "competitor-intel"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(GUIDE);
}

export async function POST(request: Request) {
  const caller = await agentCaller(request, "competitor-intel");
  if (!caller) return Response.json({ error: "Unauthorized: a Claude access key for Competitor Intel, or sign in and call it from an internal.ccclub.id page." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { mode?: unknown; competitors?: unknown } | null;
  const mode = body?.mode === "apply" ? "apply" : body?.mode === "preview" ? "preview" : null;
  if (!mode) return Response.json({ error: "mode must be \"preview\" or \"apply\".", guide: GUIDE }, { status: 400 });
  if (!Array.isArray(body?.competitors) || !body.competitors.length) return Response.json({ error: "competitors must be a non-empty list.", guide: GUIDE }, { status: 400 });
  if (body.competitors.length > MAX_COMPETITORS) return Response.json({ error: `At most ${MAX_COMPETITORS} competitors per request.` }, { status: 400 });
  try {
    if (mode === "preview") return Response.json({ mode, ...(await previewCompetitors(body.competitors)) });
    const result = await applyCompetitors(body.competitors, caller.label);
    const s = result.summary;
    await logActivity({ userName: caller.label, module: "Competitor Intel", action: "Claude update", detail: `${s.added} added · ${s.updated} updated · ${s.flagsAdded} flags · ${s.productsAdded} products · ${s.pricesAdded} prices`, table: "competitor_profiles" });
    revalidatePath("/competitor-intel");
    return Response.json({ mode, ...result });
  } catch (error) {
    console.error("[api/agent/competitor-intel] failed", error);
    return Response.json({ error: "Could not update Competitor Intel. Nothing was changed." }, { status: 500 });
  }
}
