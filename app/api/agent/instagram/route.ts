import { logActivity } from "@/lib/api/activity";
import { agentCaller } from "@/lib/api/agent-tokens";
import { applyInstagramSync, previewInstagramSync } from "@/lib/api/instagram-agent";
import { MAX_POSTS, MAX_WEEKS, POST_METRICS, WEEK_METRICS } from "@/lib/instagram/agent";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

// Claude access → Instagram & Content Evaluation. GET explains the format; POST previews or applies.
const GUIDE = {
  module: "Instagram & Content Evaluation",
  auth: "Authorization: Bearer <Claude access key from Settings → Claude access>, or a signed-in browser session (run fetch on an internal.ccclub.id page, e.g. with Claude in Chrome).",
  steps: [
    "Read the posts' insights (and, if wanted, weekly account numbers) from Instagram, e.g. with Composio.",
    "POST with mode \"preview\" and show the person the summary: new posts, updated posts and what changed, anything invalid.",
    "After they agree, POST the same body with mode \"apply\". Nothing is ever deleted.",
  ],
  request: { mode: "preview | apply", posts: `up to ${MAX_POSTS} posts (Content Evaluation)`, weeks: `optional, up to ${MAX_WEEKS} weeks (Instagram page)` },
  post: {
    post_id: "string, required: the Instagram media id as TEXT (a long number loses digits)",
    url: "string, the permalink https://www.instagram.com/p/…",
    posted_at: "YYYY-MM-DD", format: "Reel | Carousel | Feed Photo | Story (also accepts VIDEO / CAROUSEL_ALBUM / IMAGE)",
    caption: "string", title: "optional; default is the first 80 characters of the caption", account_username: "string", account_id: "string",
    followers_at_posting: "number, only filled when empty",
    ...Object.fromEntries(Object.keys(POST_METRICS).map((field) => [field, field === "non_follower_reach_pct" ? "number 0–100" : field === "watch_through_rate" ? "number, percent" : field.endsWith("_sec") ? "number, seconds" : "number"])),
  },
  week: { week_start: "YYYY-MM-DD (any day; stored as that week's Monday)", ...Object.fromEntries(WEEK_METRICS.map((field) => [field, field === "followers_total" ? "number, followers at the end of the week" : "number, total for the week"])) },
  rules: [
    "Posts are matched by post_id; weeks by their Monday.",
    "Numbers from Instagram replace the old ones (they are the newest). Fields you leave out stay as they are.",
    "URL, date, format and caption follow Instagram. A title someone typed and followers at posting are only filled when empty.",
    "Topic, hook rating, CTA, what worked, needs improvement, action and week notes are never changed.",
    "Rows show \"Synced by Claude\" with the date. The Meta CSV import keeps working as before.",
  ],
};

export async function GET(request: Request) {
  if (!(await agentCaller(request, "instagram"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(GUIDE);
}

export async function POST(request: Request) {
  const caller = await agentCaller(request, "instagram");
  if (!caller) return Response.json({ error: "Unauthorized: a Claude access key for Instagram & Content Evaluation, or sign in and call it from an internal.ccclub.id page." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { mode?: unknown; posts?: unknown; weeks?: unknown } | null;
  const mode = body?.mode === "apply" ? "apply" : body?.mode === "preview" ? "preview" : null;
  if (!mode) return Response.json({ error: "mode must be \"preview\" or \"apply\".", guide: GUIDE }, { status: 400 });
  const posts = body?.posts ?? [];
  const weeks = body?.weeks ?? [];
  if (!Array.isArray(posts) || !Array.isArray(weeks)) return Response.json({ error: "posts and weeks must be lists.", guide: GUIDE }, { status: 400 });
  if (!posts.length && !weeks.length) return Response.json({ error: "Send at least one post or week.", guide: GUIDE }, { status: 400 });
  if (posts.length > MAX_POSTS || weeks.length > MAX_WEEKS) return Response.json({ error: `At most ${MAX_POSTS} posts and ${MAX_WEEKS} weeks per request.` }, { status: 400 });
  try {
    if (mode === "preview") return Response.json({ mode, ...(await previewInstagramSync(posts, weeks)) });
    const result = await applyInstagramSync(posts, weeks, caller.label);
    const s = result.summary;
    await logActivity({ userName: caller.label, module: "Content Evaluation", action: "Claude sync", detail: `${s.postsAdded} posts added · ${s.postsUpdated} updated · ${s.weeksAdded + s.weeksUpdated} weeks`, table: "content_evaluations" });
    revalidatePath("/content-evaluation");
    revalidatePath("/instagram");
    return Response.json({ mode, ...result });
  } catch (error) {
    console.error("[api/agent/instagram] failed", error);
    return Response.json({ error: "Could not update Instagram & Content Evaluation. Nothing was changed." }, { status: 500 });
  }
}
