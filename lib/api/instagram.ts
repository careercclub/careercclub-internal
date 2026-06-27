import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

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
