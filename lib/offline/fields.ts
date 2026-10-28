// Changes made while offline (Putaran 55): which fields can wait for the connection, how two values
// are compared, and what happens when the change finally reaches the server. Used by the browser
// (to record a change) and by the server (to replay it), so both read a field the same way.
//
// A change stores, per field, the value the person saw (before) and the value they chose (after).
// On replay each field is compared with the database now:
//   now = after            → already there (sent twice, or someone made the same change)
//   now = before           → nobody touched it: apply
//   anything else          → someone changed it meanwhile: the person decides ("needs check")
// Fields the person did not change keep the database value, so another person's edit is never undone.

export type OfflineKind = "ticket" | "task";
export type FieldValues = Record<string, unknown>;
export type Conflict = { field: string; before: string; mine: string; now: string };
export type ReplayPlan =
  | { state: "already" }
  | { state: "apply"; merged: Record<string, string>; changed: string[] }
  | { state: "conflict"; conflicts: Conflict[]; merged: Record<string, string>; changed: string[] };

export const OFFLINE_FIELDS: Record<OfflineKind, readonly string[]> = {
  ticket: ["title", "description", "status", "priority", "due_date", "divisi_id", "assigned_to_ids"],
  task: ["title", "description", "status", "priority", "phase", "due_date", "assignee_ids"],
};

export const FIELD_LABELS: Record<string, string> = {
  title: "Title", description: "Description", status: "Status", priority: "Priority", phase: "Phase",
  due_date: "Deadline", divisi_id: "Division", assigned_to_ids: "Assignee", assignee_ids: "Assignee",
};

const LIST_FIELDS = new Set(["assigned_to_ids", "assignee_ids"]);

/** One way to read a field: dates as YYYY-MM-DD, people as a sorted list, empty as "". */
export function fieldValue(field: string, value: unknown): string {
  if (LIST_FIELDS.has(field)) {
    const items = Array.isArray(value) ? value : typeof value === "string" && value ? value.replace(/^\{|\}$/g, "").split(",") : [];
    return items.map((item) => String(item).trim()).filter(Boolean).sort().join(",");
  }
  if (value === null || value === undefined) return "";
  if (field === "due_date") {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }
  return String(value).trim();
}

/** The fields a person actually changed, with what they saw before. Empty when nothing changed. */
export function offlineDiff(kind: OfflineKind, before: FieldValues, after: FieldValues) {
  const seen: Record<string, string> = {};
  const chosen: Record<string, string> = {};
  for (const field of OFFLINE_FIELDS[kind]) {
    if (!(field in after)) continue;
    const was = fieldValue(field, before[field]);
    const now = fieldValue(field, after[field]);
    if (was !== now) { seen[field] = was; chosen[field] = now; }
  }
  return { before: seen, after: chosen };
}

/** A second change to the same item while still offline: keep the first "before", the last "after". */
export function mergeOfflineChanges(first: { before: Record<string, string>; after: Record<string, string> }, next: { before: Record<string, string>; after: Record<string, string> }) {
  const before = { ...next.before, ...first.before };
  const after = { ...first.after, ...next.after };
  for (const field of Object.keys(after)) if (before[field] === after[field]) { delete before[field]; delete after[field]; }
  return { before, after };
}

export function planReplay(kind: OfflineKind, current: FieldValues, before: Record<string, string>, after: Record<string, string>): ReplayPlan {
  const merged: Record<string, string> = {};
  for (const field of OFFLINE_FIELDS[kind]) merged[field] = fieldValue(field, current[field]);
  const changed: string[] = [];
  const conflicts: Conflict[] = [];
  for (const field of OFFLINE_FIELDS[kind]) {
    if (!(field in after)) continue;
    const mine = fieldValue(field, after[field]);
    const now = merged[field];
    if (now === mine) continue;
    const was = fieldValue(field, before[field]);
    if (now !== was) conflicts.push({ field, before: was, mine, now });
    merged[field] = mine;
    changed.push(field);
  }
  if (!changed.length) return { state: "already" };
  return conflicts.length ? { state: "conflict", conflicts, merged, changed } : { state: "apply", merged, changed };
}
