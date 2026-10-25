import "server-only";
import type postgres from "postgres";
import { withPostgres } from "@/lib/db/postgres";
import { POST_METRICS, WEEK_METRICS, planPosts, planWeeks, summarise, type ExistingPost, type ExistingWeek } from "@/lib/instagram/agent";

// Instagram & Content Evaluation through the Claude access API (rules in lib/instagram/agent.ts).

type Sql = postgres.Sql | postgres.TransactionSql;
const POST_COLUMNS = ["post_id", "judul", "url", "format", "description", "account_id", "account_username", "followers", ...Object.values(POST_METRICS)];

async function existingPosts(sql: Sql, postIds: string[], lock: boolean): Promise<ExistingPost[]> {
  if (!postIds.length) return [];
  // Dates as text so the rules compare 2026-10-20 with 2026-10-20, whatever the server time zone.
  const rows = lock
    ? await sql<ExistingPost[]>`select id, ${sql(POST_COLUMNS)}, to_char(tanggal, 'YYYY-MM-DD') as tanggal from content_evaluations where post_id in ${sql(postIds)} for update`
    : await sql<ExistingPost[]>`select id, ${sql(POST_COLUMNS)}, to_char(tanggal, 'YYYY-MM-DD') as tanggal from content_evaluations where post_id in ${sql(postIds)}`;
  return rows.map((row) => ({ ...row, id: String(row.id) }));
}

async function existingWeeks(sql: Sql, lock: boolean): Promise<ExistingWeek[]> {
  const rows = lock
    ? await sql<ExistingWeek[]>`select id, to_char(week_start, 'YYYY-MM-DD') as week_start, ${sql([...WEEK_METRICS])} from ig_snapshots for update`
    : await sql<ExistingWeek[]>`select id, to_char(week_start, 'YYYY-MM-DD') as week_start, ${sql([...WEEK_METRICS])} from ig_snapshots`;
  return rows.map((row) => ({ ...row, id: String(row.id) }));
}

const idsOf = (posts: unknown[]) => [...new Set(posts.map((raw) => (raw && typeof raw === "object" ? String((raw as { post_id?: unknown }).post_id ?? "").trim().replace(/^'/, "") : "")).filter(Boolean))];

async function plan(sql: Sql, posts: unknown[], weeks: unknown[], lock: boolean) {
  const postItems = planPosts(posts, await existingPosts(sql, idsOf(posts), lock));
  const weekItems = weeks.length ? planWeeks(weeks, await existingWeeks(sql, lock)) : [];
  return { posts: postItems, weeks: weekItems, summary: summarise(postItems, weekItems) };
}

export function previewInstagramSync(posts: unknown[], weeks: unknown[]) {
  return withPostgres((sql) => plan(sql, posts, weeks, false));
}

/** Plans again inside one transaction (rows locked) and writes it. Invalid items are skipped. */
export function applyInstagramSync(posts: unknown[], weeks: unknown[], actor: string) {
  return withPostgres((sql) => sql.begin(async (tx) => {
    const result = await plan(tx, posts, weeks, true);
    const stamp = { synced_by: actor, synced_at: new Date() };
    for (const item of result.posts) {
      if (item.action === "add") {
        const [row] = await tx<Array<{ id: string }>>`insert into content_evaluations ${tx({ ...item.set, ...stamp })} returning id`;
        item.id = String(row.id);
      } else if (item.action === "update") {
        await tx`update content_evaluations set ${tx({ ...item.set, ...stamp })} where id = ${item.id!}`;
      } else if (item.action === "unchanged") {
        await tx`update content_evaluations set ${tx(stamp)} where id = ${item.id!}`;
      }
    }
    for (const item of result.weeks) {
      if (item.action === "add") {
        const zeros = Object.fromEntries(WEEK_METRICS.map((field) => [field, 0]));
        const [row] = await tx<Array<{ id: string }>>`insert into ig_snapshots ${tx({ week_start: item.week_start, ...zeros, ...item.set, notes: "", ...stamp })} returning id`;
        item.id = String(row.id);
      } else if (item.action === "update") {
        await tx`update ig_snapshots set ${tx({ ...item.set, ...stamp })} where id = ${item.id!}`;
      } else if (item.action === "unchanged") {
        await tx`update ig_snapshots set ${tx(stamp)} where id = ${item.id!}`;
      }
    }
    return result;
  }));
}
