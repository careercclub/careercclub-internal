import "server-only";
import { FLAG_TYPES, MAX_COMPETITORS } from "@/lib/competitor/agent";
import { MAX_COMPANIES } from "@/lib/mt-prospects/agent";
import { MAX_PAIN_POINTS } from "@/lib/customer-knowledge/agent";
import { MAX_POSTS, MAX_WEEKS, POST_METRICS, WEEK_METRICS } from "@/lib/instagram/agent";
import { applyAgentCompanies, previewAgentCompanies } from "@/lib/api/mt-agent";
import { applyCompetitors, previewCompetitors } from "@/lib/api/competitor-agent";
import { applyInstagramSync, previewInstagramSync } from "@/lib/api/instagram-agent";
import { applyPainPoints, painPointLists, previewPainPoints } from "@/lib/api/customer-knowledge-agent";
import { logActivity } from "@/lib/api/activity";
import { revalidatePath } from "next/cache";
import { withPostgres } from "@/lib/db/postgres";

// Claude access (app/api/agent/*) and the Claude connector (MCP) send data the same way: one guide
// and one check-preview-apply per module, so both paths follow the same rules (Putaran 62).

export type SyncResult = { status: number; json: unknown };
const out = (json: unknown, init?: { status: number }): SyncResult => ({ status: init?.status ?? 200, json });

export const INSTAGRAM_GUIDE = {
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
/** Claude access (instagram) and the connector: checks the body, previews or applies, logs. */
export async function syncInstagram(body: { mode?: unknown; posts?: unknown; weeks?: unknown } | null, actor: string): Promise<SyncResult> {
  const mode = body?.mode === "apply" ? "apply" : body?.mode === "preview" ? "preview" : null;
  if (!mode) return out({ error: "mode must be \"preview\" or \"apply\".", guide: INSTAGRAM_GUIDE }, { status: 400 });
  const posts = body?.posts ?? [];
  const weeks = body?.weeks ?? [];
  if (!Array.isArray(posts) || !Array.isArray(weeks)) return out({ error: "posts and weeks must be lists.", guide: INSTAGRAM_GUIDE }, { status: 400 });
  if (!posts.length && !weeks.length) return out({ error: "Send at least one post or week.", guide: INSTAGRAM_GUIDE }, { status: 400 });
  if (posts.length > MAX_POSTS || weeks.length > MAX_WEEKS) return out({ error: `At most ${MAX_POSTS} posts and ${MAX_WEEKS} weeks per request.` }, { status: 400 });
  try {
    if (mode === "preview") return out({ mode, ...(await previewInstagramSync(posts, weeks)) });
    const result = await applyInstagramSync(posts, weeks, actor);
    const s = result.summary;
    await logActivity({ userName: actor, module: "Content Evaluation", action: "Claude sync", detail: `${s.postsAdded} posts added · ${s.postsUpdated} updated · ${s.weeksAdded + s.weeksUpdated} weeks`, table: "content_evaluations" });
    revalidatePath("/content-evaluation");
    revalidatePath("/instagram");
    return out({ mode, ...result });
  } catch (error) {
    console.error("[api/agent/instagram] failed", error);
    return out({ error: "Could not update Instagram & Content Evaluation. Nothing was changed." }, { status: 500 });
  }
}

export const MT_GUIDE = {
  module: "Job Vacancy MT",
  auth: "Authorization: Bearer <Claude access key from Settings → Claude access>, or a signed-in browser session.",
  steps: ["POST with mode \"preview\" and show the person the summary and every possible_duplicate / conflict.", "After they agree, POST the same companies with mode \"apply\". Nothing is ever deleted."],
  request: {
    mode: "preview | apply",
    companies: `up to ${MAX_COMPANIES} items`,
  },
  company: {
    brand: "string (brand or legal_name required)",
    legal_name: "string, e.g. PT Garudafood Putra Putri Jaya Tbk",
    industry: "string", program: "string, the MT programme name", status: "active | predicted | older | excluded (new companies only; default active)",
    active_years: "string, e.g. \"2024, 2025\"", usual_months: "number[] 1-12 or text like \"Agustus–Oktober\"",
    openings: "{ \"2026\": { months: number[] | \"Maret–April\", dates?: string } }",
    notes: "string", contacts: "[{ name, title?, link? }] HR contacts",
    updates: "[{ text, date?: YYYY-MM-DD, source_url? }] dated research notes",
    requirements: "[{ text, program?, source_url? }]",
    selection_steps: "[{ text, program?, source_url?, date? }] e.g. \"Administrasi → Psikotes → Interview HR → Interview User → MCU\"",
    match_id: "string, the company id from a possible_duplicate candidate, to update that company",
    as_new: "true to add as a new company although a similar name exists",
  },
  rules: [
    "Matched by name like the Excel upload (PT/Tbk/(Persero) ignored).",
    "Existing companies: only empty fields are filled; a different value is reported as a conflict and not written.",
    "Opening years, HR contacts and notes that are not there yet are added; duplicates are skipped.",
    "A similar but different name is a possible_duplicate and is skipped until match_id or as_new is given.",
    "Companies from the Excel upload are refreshed by the next upload; notes added here stay.",
  ],
};
/** Claude access (job-vacancy-mt) and the connector: checks the body, previews or applies, logs. */
export async function syncMtProspects(body: { mode?: unknown; companies?: unknown } | null, actor: string): Promise<SyncResult> {
  const mode = body?.mode === "apply" ? "apply" : body?.mode === "preview" ? "preview" : null;
  if (!mode) return out({ error: "mode must be \"preview\" or \"apply\".", guide: MT_GUIDE }, { status: 400 });
  if (!Array.isArray(body?.companies) || !body.companies.length) return out({ error: "companies must be a non-empty list.", guide: MT_GUIDE }, { status: 400 });
  if (body.companies.length > MAX_COMPANIES) return out({ error: `At most ${MAX_COMPANIES} companies per request.` }, { status: 400 });
  try {
    if (mode === "preview") return out({ mode, ...(await previewAgentCompanies(body.companies)) });
    const result = await applyAgentCompanies(body.companies, actor);
    const s = result.summary;
    await logActivity({ userName: actor, module: "Job Vacancy MT", action: "Claude update", detail: `${s.added} added · ${s.updated} updated · ${s.contactsAdded} contacts · ${s.notesAdded} notes`, table: "mt_prospects" });
    revalidatePath("/job-vacancy-mt");
    return out({ mode, ...result });
  } catch (error) {
    console.error("[api/agent/mt-prospects] failed", error);
    return out({ error: "Could not update Job Vacancy MT. Nothing was changed." }, { status: 500 });
  }
}

export const COMPETITOR_GUIDE = {
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
    threat_level: "low | medium | high (only filled when empty; the team decides)", notes: "string",
    followers: "{ \"Instagram\": 120000, \"TikTok\": 5000, \"YouTube\": 800 }, counted today",
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
/** Claude access (competitor-intel) and the connector: checks the body, previews or applies, logs. */
export async function syncCompetitorIntel(body: { mode?: unknown; competitors?: unknown } | null, actor: string): Promise<SyncResult> {
  const mode = body?.mode === "apply" ? "apply" : body?.mode === "preview" ? "preview" : null;
  if (!mode) return out({ error: "mode must be \"preview\" or \"apply\".", guide: COMPETITOR_GUIDE }, { status: 400 });
  if (!Array.isArray(body?.competitors) || !body.competitors.length) return out({ error: "competitors must be a non-empty list.", guide: COMPETITOR_GUIDE }, { status: 400 });
  if (body.competitors.length > MAX_COMPETITORS) return out({ error: `At most ${MAX_COMPETITORS} competitors per request.` }, { status: 400 });
  try {
    if (mode === "preview") return out({ mode, ...(await previewCompetitors(body.competitors)) });
    const result = await applyCompetitors(body.competitors, actor);
    const s = result.summary;
    await logActivity({ userName: actor, module: "Competitor Intel", action: "Claude update", detail: `${s.added} added · ${s.updated} updated · ${s.flagsAdded} flags · ${s.productsAdded} products · ${s.pricesAdded} prices`, table: "competitor_profiles" });
    revalidatePath("/competitor-intel");
    return out({ mode, ...result });
  } catch (error) {
    console.error("[api/agent/competitor-intel] failed", error);
    return out({ error: "Could not update Competitor Intel. Nothing was changed." }, { status: 500 });
  }
}

export const CUSTOMER_KNOWLEDGE_GUIDE = {
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
/** Claude access (customer-knowledge) and the connector: checks the body, previews or applies, logs. */
export async function syncCustomerKnowledge(body: { mode?: unknown; pain_points?: unknown } | null, actor: string): Promise<SyncResult> {
  const mode = body?.mode === "apply" ? "apply" : body?.mode === "preview" ? "preview" : null;
  if (!mode) return out({ error: "mode must be \"preview\" or \"apply\".", guide: CUSTOMER_KNOWLEDGE_GUIDE }, { status: 400 });
  if (!Array.isArray(body?.pain_points) || !body.pain_points.length) return out({ error: "pain_points must be a non-empty list.", guide: CUSTOMER_KNOWLEDGE_GUIDE }, { status: 400 });
  if (body.pain_points.length > MAX_PAIN_POINTS) return out({ error: `At most ${MAX_PAIN_POINTS} pain points per request.` }, { status: 400 });
  try {
    if (mode === "preview") return out({ mode, ...(await previewPainPoints(body.pain_points)) });
    const result = await applyPainPoints(body.pain_points, actor);
    const s = result.summary;
    await logActivity({ userName: actor, module: "Customer Knowledge", action: "Claude update", detail: `${s.added} added · ${s.updated} updated · ${s.invalid} skipped`, table: "pain_points" });
    revalidatePath("/customer-knowledge");
    return out({ mode, ...result });
  } catch (error) {
    console.error("[api/agent/customer-knowledge] failed", error);
    return out({ error: "Could not update Customer Knowledge. Nothing was changed." }, { status: 500 });
  }
}
