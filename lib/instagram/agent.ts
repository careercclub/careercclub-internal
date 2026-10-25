// Instagram & Content Evaluation through Claude access: one set of rules for preview and apply.
// Posts are matched by Post ID; weeks by their Monday. Numbers from Instagram are the newest
// truth, so they replace what is there. What people write themselves (topic, hook rating, CTA,
// what worked, needs improvement, action, week notes) is never touched. Nothing is deleted.

export const MAX_POSTS = 100;
export const MAX_WEEKS = 60;

/** Request field → content_evaluations column. Instagram's numbers: the newest value wins. */
export const POST_METRICS: Record<string, string> = {
  views: "views", reach: "reach", likes: "likes", comments: "comments", saves: "saves", shares: "shares",
  follows: "follows", profile_visits: "profile_visits", link_taps: "link_taps", accounts_engaged: "engaged",
  non_follower_reach_pct: "nf_pct", from_home: "from_home", from_profile: "from_profile", from_other: "from_other",
  duration_sec: "duration", avg_watch_time_sec: "watchtime", watch_through_rate: "wtr", replays: "replays",
  dropoff: "dropoff", taps_forward: "taps_forward", taps_back: "taps_back", exits: "exits", replies: "replies",
  sticker_taps: "stickers_interact",
};
/** Facts about the post itself; Instagram is the source, so a different value replaces the old one. */
const POST_FACTS = ["url", "tanggal", "format", "description", "account_id", "account_username"] as const;
/** Only filled while empty (a title someone renamed, followers on the day it was posted). */
const POST_FILL_ONLY = ["judul", "followers"] as const;

export const WEEK_METRICS = ["followers_total", "follows_gained", "reach", "views", "interactions", "link_clicks", "profile_visits"] as const;

export type ExistingPost = { id: string } & Record<string, string | number | null>;
export type ExistingWeek = { id: string; week_start: string } & Record<string, string | number | null>;
export type Change = { field: string; from: string | number | null; to: string | number };
export type PostItem = { post_id: string; action: "add" | "update" | "unchanged" | "invalid"; id?: string; title: string; set: Record<string, string | number>; changes: Change[]; errors: string[] };
export type WeekItem = { week_start: string; action: "add" | "update" | "unchanged" | "invalid"; id?: string; set: Record<string, number>; changes: Change[]; errors: string[] };

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "");

function number(value: unknown, field: string, errors: string[]): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[,\s]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) { errors.push(`${field} must be a number of 0 or more.`); return undefined; }
  return parsed;
}

function day(value: unknown): string {
  const text = str(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (!match) return "";
  const parsed = new Date(`${match[1]}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === match[1] ? match[1] : "";
}

export function monday(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  const weekday = parsed.getUTCDay();
  parsed.setUTCDate(parsed.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return parsed.toISOString().slice(0, 10);
}

/** Same words as the Meta CSV import. */
export function postFormat(value: string) {
  const lower = value.toLowerCase();
  if (!lower) return "";
  if (lower.includes("reel") || lower.includes("video")) return "Reel";
  if (lower.includes("story")) return "Story";
  if (lower.includes("photo") || lower.includes("image")) return "Feed Photo";
  return "Carousel";
}

export function titleFrom(caption: string, postId: string) {
  return caption.replace(/\s+/g, " ").trim().slice(0, 80) || `Post ${postId}`;
}

/** One post from the request → the columns it carries (only fields that were given). */
export function readPost(raw: unknown): { postId: string; values: Record<string, string | number>; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(raw)) return { postId: "", values: {}, errors: ["Each post must be an object."] };
  // Instagram ids are longer than JavaScript can hold exactly: a number would merge different posts.
  if (typeof raw.post_id === "number" && !Number.isSafeInteger(raw.post_id)) errors.push("post_id must be sent as text (a long number loses digits).");
  const postId = str(raw.post_id).replace(/^'/, "");
  if (!postId) errors.push("post_id is required.");
  else if (!/^[\w-]{1,64}$/.test(postId)) errors.push("post_id may only contain letters, digits, _ and -.");
  const values: Record<string, string | number> = {};
  const url = str(raw.url ?? raw.permalink);
  if (url) { if (/^https?:\/\//i.test(url)) values.url = url.slice(0, 500); else errors.push("url must start with https://."); }
  const postedAt = raw.posted_at ?? raw.date;
  if (postedAt !== undefined && postedAt !== null && postedAt !== "") { const parsed = day(postedAt); if (parsed) values.tanggal = parsed; else errors.push("posted_at must be a date like 2026-10-20."); }
  const format = postFormat(str(raw.format ?? raw.media_type));
  if (format) values.format = format;
  const caption = typeof raw.caption === "string" ? raw.caption.trim() : "";
  if (caption) values.description = caption.slice(0, 5000);
  for (const [field, column] of [["account_id", "account_id"], ["account_username", "account_username"]] as const) { const value = str(raw[field]); if (value) values[column] = value.slice(0, 120); }
  const title = str(raw.title);
  values.judul = (title || titleFrom(caption, postId)).slice(0, 120);
  const followers = number(raw.followers_at_posting, "followers_at_posting", errors);
  if (followers !== undefined) values.followers = followers;
  for (const [field, column] of Object.entries(POST_METRICS)) { const value = number(raw[field], field, errors); if (value !== undefined) values[column] = value; }
  if ("non_follower_reach_pct" in raw && typeof values.nf_pct === "number" && values.nf_pct > 100) errors.push("non_follower_reach_pct must be 0–100.");
  return { postId, values, errors };
}

const empty = (value: unknown) => value === null || value === undefined || String(value).trim() === "";
/** Existing values come in as text/number (dates as YYYY-MM-DD, see the loader). */
const same = (a: unknown, b: string | number) => !empty(a) && (typeof b === "number" ? Number(a) === b : String(a) === b);

export function planPosts(raws: unknown[], existing: ExistingPost[]): PostItem[] {
  const byPostId = new Map(existing.filter((row) => row.post_id).map((row) => [String(row.post_id), row]));
  const seen = new Set<string>();
  return raws.map((raw) => {
    const { postId, values, errors } = readPost(raw);
    const title = String(values.judul || postId || "Post");
    if (postId && seen.has(postId)) errors.push("This post_id is listed twice in the request.");
    if (postId) seen.add(postId);
    if (errors.length) return { post_id: postId, action: "invalid", title, set: {}, changes: [], errors };
    const row = byPostId.get(postId);
    if (!row) return { post_id: postId, action: "add", title, set: { post_id: postId, format: "Carousel", ...values }, changes: [], errors: [] };
    const set: Record<string, string | number> = {};
    const changes: Change[] = [];
    for (const [column, value] of Object.entries(values)) {
      const fillOnly = (POST_FILL_ONLY as readonly string[]).includes(column);
      const fact = (POST_FACTS as readonly string[]).includes(column);
      const metric = Object.values(POST_METRICS).includes(column);
      if (!fillOnly && !fact && !metric) continue;
      if (fillOnly && !empty(row[column])) continue;
      if (same(row[column], value)) continue;
      set[column] = value;
      // Long text is listed by name only; the summary stays readable.
      changes.push({ field: column, from: column === "description" ? (empty(row[column]) ? null : "…") : (row[column] ?? null), to: column === "description" ? "new caption" : value });
    }
    return { post_id: postId, action: Object.keys(set).length ? "update" : "unchanged", id: String(row.id), title: String(row.judul || title), set, changes, errors: [] };
  });
}

export function planWeeks(raws: unknown[], existing: ExistingWeek[]): WeekItem[] {
  const byWeek = new Map(existing.map((row) => [String(row.week_start).slice(0, 10), row]));
  const seen = new Set<string>();
  return raws.map((raw) => {
    const errors: string[] = [];
    if (!isRecord(raw)) return { week_start: "", action: "invalid", set: {}, changes: [], errors: ["Each week must be an object."] };
    const given = day(raw.week_start);
    if (!given) errors.push("week_start must be a date like 2026-10-19.");
    const weekStart = given ? monday(given) : "";
    if (weekStart && seen.has(weekStart)) errors.push("This week is listed twice in the request.");
    if (weekStart) seen.add(weekStart);
    const values: Record<string, number> = {};
    for (const field of WEEK_METRICS) { const value = number(raw[field], field, errors); if (value !== undefined) values[field] = Math.round(value); }
    if (!errors.length && !Object.keys(values).length) errors.push("Give at least one number for the week.");
    if (errors.length) return { week_start: weekStart, action: "invalid", set: {}, changes: [], errors };
    const row = byWeek.get(weekStart);
    if (!row) return { week_start: weekStart, action: "add", set: values, changes: [], errors: [] };
    const set: Record<string, number> = {};
    const changes: Change[] = [];
    for (const [field, value] of Object.entries(values)) { if (Number(row[field] ?? 0) === value) continue; set[field] = value; changes.push({ field, from: row[field] ?? null, to: value }); }
    return { week_start: weekStart, action: Object.keys(set).length ? "update" : "unchanged", id: String(row.id), set, changes, errors: [] };
  });
}

export function summarise(posts: PostItem[], weeks: WeekItem[]) {
  const count = (items: Array<{ action: string }>, action: string) => items.filter((item) => item.action === action).length;
  return {
    postsAdded: count(posts, "add"), postsUpdated: count(posts, "update"), postsUnchanged: count(posts, "unchanged"), postsInvalid: count(posts, "invalid"),
    weeksAdded: count(weeks, "add"), weeksUpdated: count(weeks, "update"), weeksUnchanged: count(weeks, "unchanged"), weeksInvalid: count(weeks, "invalid"),
  };
}
