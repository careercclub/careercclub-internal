// Which tickets and tasks the operational calendar (Dashboard, Program → Calendar) shows.
// One rule for both the server (it sends only these) and the calendar itself.
// Pure: no runtime imports, tested under `node --test`.

import { leanRows } from "../records/lean.ts";

type Row = Record<string, unknown>;
const SKIP = ["created_at", "updated_at"] as const;

/** Open tickets with a deadline that are not mirrored by a Program task (the task shows instead). */
export function isCalendarTicket(row: Row) {
  // Done and Cancelled are closed, as in every other count (lib/dashboard/summary.ts isDone).
  return !["Done", "Cancelled"].includes(String(row.status ?? "")) && !row.related_task_id && Boolean(row.due_date);
}

/** What the server sends to the calendar: only rows it can show, without empty fields or timestamps. */
export function calendarTickets<T extends Row>(rows: readonly T[]): T[] {
  return leanRows(rows.filter(isCalendarTicket), SKIP);
}

export function calendarTasks<T extends Row>(rows: readonly T[]): T[] {
  return leanRows(rows.filter((row) => Boolean(row.due_date)), SKIP);
}
