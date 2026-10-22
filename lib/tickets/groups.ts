// Tickets list grouped by when they are due (IJIS layout, Oct 2026).
// Uses the one "late" rule from the dashboard summary so both pages always agree.
// Pure: tested under `node --test`.

import { dateKey, isDone, isOverdue, localIso, shortDate, weekKeys } from "../dashboard/summary.ts";

type Row = Record<string, unknown>;

export type TicketGroupId = "late" | "week" | "later" | "nodate" | "done";
export type TicketGroup<T> = { id: TicketGroupId; title: string; rows: T[] };

const TITLES: Record<TicketGroupId, string> = { late: "Late", week: "This week", later: "Later", nodate: "No due date", done: "Done" };
const ORDER: TicketGroupId[] = ["late", "week", "later", "nodate", "done"];

export function ticketGroupOf(row: Row, today: string): TicketGroupId {
  if (isDone(row)) return "done";
  const due = dateKey(row.due_date);
  if (!due) return "nodate";
  if (isOverdue(row, today)) return "late";
  return due <= weekKeys(today)[6] ? "week" : "later";
}

/** Groups in a fixed order; inside a group the nearest date comes first (done: most recent first). */
export function groupTickets<T extends Row>(rows: T[], today: string): TicketGroup<T>[] {
  const buckets = new Map<TicketGroupId, T[]>(ORDER.map((id) => [id, []]));
  for (const row of rows) buckets.get(ticketGroupOf(row, today))!.push(row);
  const byDue = (a: T, b: T) => dateKey(a.due_date).localeCompare(dateKey(b.due_date));
  return ORDER.map((id) => {
    const list = buckets.get(id)!;
    list.sort(id === "done" ? (a, b) => -byDue(a, b) : id === "nodate" ? () => 0 : byDue);
    return { id, title: TITLES[id], rows: list };
  }).filter((group) => group.rows.length);
}

/** One chip per ticket: when it is due, relative to today. */
export function dueChip(row: Row, today: string): { label: string; tone: "late" | "soon" | "plain" } | null {
  const due = dateKey(row.due_date);
  if (!due) return null;
  if (isDone(row)) return { label: shortDate(due, false), tone: "plain" };
  if (isOverdue(row, today)) {
    const [y1, m1, d1] = due.split("-").map(Number); const [y2, m2, d2] = today.split("-").map(Number);
    const days = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000);
    return { label: `${days}d late`, tone: "late" };
  }
  if (due === today) return { label: "Today", tone: "soon" };
  const [y, m, d] = today.split("-").map(Number);
  if (due === localIso(new Date(y, m - 1, d + 1))) return { label: "Tomorrow", tone: "soon" };
  return { label: shortDate(due), tone: "plain" };
}
