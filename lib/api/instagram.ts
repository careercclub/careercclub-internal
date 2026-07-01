import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type InstagramSnapshotRecord = ApiRecord;
export type InstagramTargetRecord = ApiRecord;
export type InstagramBaselineRecord = ApiRecord;

const snapshots = createTableApi<InstagramSnapshotRecord>("ig_snapshots", {
  orderBy: "week_start",
  ascending: true,
});

const targets = createTableApi<InstagramTargetRecord>("ig_targets", {
  orderBy: "year",
  ascending: true,
});

const baselines = createTableApi<InstagramBaselineRecord>("ig_baselines", {
  orderBy: "updated_at",
  ascending: false,
});

export const listInstagramSnapshots = snapshots.list;
export const countInstagramSnapshots = snapshots.count;
export const getInstagramSnapshot = snapshots.get;
export const createInstagramSnapshot = snapshots.create;
export const updateInstagramSnapshot = snapshots.update;
export const deleteInstagramSnapshot = snapshots.remove;

export const listInstagramTargets = targets.list;
export const countInstagramTargets = targets.count;
export const getInstagramTarget = targets.get;
export const createInstagramTarget = targets.create;
export const updateInstagramTarget = targets.update;
export const deleteInstagramTarget = targets.remove;

export async function getInstagramBaseline() {
  const rows = await baselines.list();
  return rows[0] || null;
}

export function saveInstagramBaseline(followersTotal: number, baselineDate: string) {
  return withPostgres(async (sql) => {
    const [existing] = await sql<{ id: string }[]>`select id from ig_baselines order by updated_at desc nulls last limit 1`;
    if (existing) {
      const [row] = await sql<InstagramBaselineRecord[]>`update ig_baselines set followers_total = ${followersTotal}, baseline_date = ${baselineDate}, updated_at = now() where id = ${existing.id} returning *`;
      return row;
    }
    const [row] = await sql<InstagramBaselineRecord[]>`insert into ig_baselines (followers_total, baseline_date) values (${followersTotal}, ${baselineDate}) returning *`;
    return row;
  });
}

export function importInstagramSnapshots(rows: Array<Record<string, string | number | null>>) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    let imported = 0;
    for (const row of rows) {
      const weekStart = String(row.week_start || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) continue;
      const [existing] = await tx<{ id: string }[]>`select id from ig_snapshots where week_start = ${weekStart} limit 1`;
      const values = ["followers_total", "follows_gained", "reach", "views", "interactions", "link_clicks", "profile_visits"] as const;
      const metrics = Object.fromEntries(values.map((field) => [field, Number(row[field] || 0)]));
      if (existing) await tx`update ig_snapshots set ${tx(metrics)}, notes = ${String(row.notes || "")} where id = ${existing.id}`;
      else await tx`insert into ig_snapshots ${tx({ week_start: weekStart, ...metrics, notes: String(row.notes || "") })}`;
      imported += 1;
    }
    return { imported };
  }));
}
