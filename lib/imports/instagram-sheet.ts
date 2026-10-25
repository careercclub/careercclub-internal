import "server-only";
import type ExcelJS from "exceljs";
import { POST_METRICS, WEEK_METRICS } from "@/lib/instagram/agent";
import { SheetProblem } from "@/lib/imports/talent-pool-sheet";
import { findTab, readTable, sheetDate } from "@/lib/imports/sheet-table";

// The "Instagram insights" Google Sheet (filled by Claude from Composio, or by the team):
//   Posts  — one row per post, numbers updated in place (Content Evaluation)
//   Weekly — one row per week of account numbers (Instagram page), optional
// Turned into the same input as Claude access, so the same rules apply (lib/instagram/agent.ts).

const label = (field: string) => field.replace(/_sec$/, "").replace(/_pct$/, " %").replace(/_/g, " ");
const POST_COLUMNS: Record<string, string[]> = {
  post_id: ["post id", "media id", "id"], url: ["url", "permalink", "link"], posted_at: ["date", "posted at", "publish date", "tanggal"],
  format: ["format", "media type", "type"], caption: ["caption", "description"], title: ["title", "judul"], account_username: ["account", "account username", "username"],
  followers_at_posting: ["followers at posting"],
  ...Object.fromEntries(Object.keys(POST_METRICS).map((field) => [field, [label(field), field, field === "avg_watch_time_sec" ? "average watch time" : field === "non_follower_reach_pct" ? "non follower reach %" : field === "accounts_engaged" ? "engaged" : label(field)]])),
};
const WEEK_COLUMNS: Record<string, string[]> = {
  week_start: ["week start", "week", "date", "tanggal"],
  ...Object.fromEntries(WEEK_METRICS.map((field) => [field, [label(field), field, field === "followers_total" ? "followers" : field === "follows_gained" ? "new followers" : label(field)]])),
};

export function instagramRows(workbook: ExcelJS.Workbook) {
  const postsTab = findTab(workbook, ["posts", "post"]);
  const weeksTab = findTab(workbook, ["weekly", "weeks", "week"]);
  if (!postsTab && !weeksTab) throw new SheetProblem("The sheet needs a “Posts” tab (and optionally “Weekly”).");
  const warnings: string[] = [];
  const posts: Array<Record<string, unknown>> = []; const postRows: number[] = [];
  if (postsTab) for (const row of readTable(postsTab, POST_COLUMNS, ["post_id"])) {
    const raw = row.raw("post_id");
    // Google Sheets keeps 15 digits of a number: a Post ID typed as a number has lost its tail.
    if (typeof raw === "number" && Math.abs(raw) >= 1e15) { warnings.push(`${postsTab.name} row ${row.row}: Post ID was saved as a number and lost digits. Format the column as Plain text and paste the ID again.`); continue; }
    const post: Record<string, unknown> = { post_id: row.get("post_id") };
    for (const field of Object.keys(POST_COLUMNS)) { if (field === "post_id") continue; const v = row.get(field); if (v) post[field] = field === "posted_at" ? sheetDate(v) : v; }
    posts.push(post); postRows.push(row.row);
  }
  const weeks: Array<Record<string, unknown>> = []; const weekRows: number[] = [];
  if (weeksTab) for (const row of readTable(weeksTab, WEEK_COLUMNS, ["week_start"])) {
    const week: Record<string, unknown> = { week_start: sheetDate(row.get("week_start")) };
    for (const field of WEEK_METRICS) { const v = row.get(field); if (v) week[field] = v; }
    weeks.push(week); weekRows.push(row.row);
  }
  return { posts, weeks, postRows, weekRows, postsTab: postsTab?.name || "Posts", weeksTab: weeksTab?.name || "Weekly", warnings };
}
