import { auth } from "@/auth";
import { requestAnthropicJson } from "@/lib/ai/anthropic";
import { AI_QUERY_MAX, aiSearchSystemPrompt, parseAiPlan, planCacheKey, type AiSearchPlan } from "@/lib/search/ai-plan";
import { searchSpecs, searchWithKeywords } from "@/lib/search/query";

// "Ask AI" in Ctrl+K (level 1). Only the typed question goes to the AI; records never do.
const PLAN_TTL_MS = 10 * 60_000;
const PER_MINUTE = 20;
const plans = new Map<string, { at: number; plan: AiSearchPlan }>();
const recent = new Map<string, number[]>();

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { q?: unknown };
  const query = typeof body.q === "string" ? body.q.trim().slice(0, AI_QUERY_MAX) : "";
  if (query.length < 2) return Response.json({ error: "Type a question first." }, { status: 400 });

  // A small per-person limit so a stuck key or a loop cannot run up the AI bill.
  const userKey = String(session.user.id || session.user.email || "user");
  const now = Date.now();
  const calls = (recent.get(userKey) || []).filter((at) => now - at < 60_000);
  const key = planCacheKey(query);
  let cached = plans.get(key);
  if (cached && now - cached.at > PLAN_TTL_MS) { plans.delete(key); cached = undefined; }

  let plan: AiSearchPlan;
  if (cached) plan = cached.plan;
  else {
    if (calls.length >= PER_MINUTE) return Response.json({ error: "Too many AI searches in a minute. Try again shortly." }, { status: 429 });
    recent.set(userKey, [...calls, now]);
    const specs = searchSpecs();
    try {
      const raw = await requestAnthropicJson(aiSearchSystemPrompt(specs, jakartaToday()), [{ type: "text", text: query }], {
        model: process.env.ANTHROPIC_SEARCH_MODEL || "claude-haiku-5-5",
        maxTokens: 200,
        timeoutMs: 8_000,
      });
      plan = parseAiPlan(raw, specs.map((spec) => spec.key));
    } catch (error) {
      console.error("[api/search/ai] AI failed:", error instanceof Error ? error.message : error);
      return Response.json({ error: "AI search is not available right now. The normal results still work." }, { status: 502 });
    }
    plans.set(key, { at: now, plan });
    if (plans.size > 500) plans.delete(plans.keys().next().value as string);
  }

  const hits = await searchWithKeywords(plan.keywords, plan.modules, { role: session.user.role, userId: session.user.id, email: session.user.email });
  return Response.json({ plan, hits }, { headers: { "Cache-Control": "no-store" } });
}
