import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type InstagramSnapshotRecord = ApiRecord;
export type InstagramTargetRecord = ApiRecord;

const snapshots = createTableApi<InstagramSnapshotRecord>("ig_snapshots", {
  orderBy: "week_start",
  ascending: true,
});

const targets = createTableApi<InstagramTargetRecord>("ig_targets", {
  orderBy: "year",
  ascending: true,
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
