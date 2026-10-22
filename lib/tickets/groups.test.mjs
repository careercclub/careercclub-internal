// Tickets list groups: same "late" rule as the Dashboard, every ticket in exactly one group.
import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDashboard } from "../dashboard/summary.ts";
import { dueChip, groupTickets, ticketGroupOf } from "./groups.ts";

const today = "2026-10-22"; // Thursday; week = Mon 19 – Sun 25 Oct
const rows = [
  { id: "a", status: "Todo", due_date: "2026-10-20" },
  { id: "b", status: "Todo", due_date: "2026-10-22" },
  { id: "c", status: "In Progress", due_date: "2026-10-25" },
  { id: "d", status: "Todo", due_date: "2026-10-30" },
  { id: "e", status: "Todo" },
  { id: "f", status: "Done", due_date: "2026-10-01" },
  { id: "g", status: "Done", due_date: "2026-10-21" },
  { id: "h", status: "Todo", due_date: "2026-10-19" },
];

test("each ticket lands in exactly one group, in a fixed order", () => {
  const groups = groupTickets(rows, today);
  assert.deepEqual(groups.map((g) => g.id), ["late", "week", "later", "nodate", "done"]);
  assert.equal(groups.flatMap((g) => g.rows).length, rows.length);
  assert.deepEqual(groups[0].rows.map((r) => r.id), ["h", "a"], "late: oldest first");
  assert.deepEqual(groups[1].rows.map((r) => r.id), ["b", "c"], "due today counts as this week, not late");
  assert.deepEqual(groups[4].rows.map((r) => r.id), ["g", "f"], "done: most recent first");
});

test("the Late group matches the Dashboard's late-ticket number", () => {
  const late = groupTickets(rows, today).find((g) => g.id === "late").rows.length;
  const s = summarizeDashboard({ tickets: rows, tasks: [], events: [], people: [] }, today);
  assert.equal(late, s.lateTickets);
});

test("one due chip per ticket; red only when late", () => {
  assert.deepEqual(dueChip(rows[0], today), { label: "2d late", tone: "late" });
  assert.deepEqual(dueChip(rows[1], today), { label: "Today", tone: "soon" });
  assert.deepEqual(dueChip({ status: "Todo", due_date: "2026-10-23" }, today), { label: "Tomorrow", tone: "soon" });
  assert.equal(dueChip(rows[3], today).tone, "plain");
  assert.equal(dueChip({ status: "Todo", due_date: "2026-11-01" }, "2026-10-31").label, "Tomorrow", "across a month end");
  assert.equal(dueChip(rows[4], today), null);
  assert.equal(dueChip(rows[5], today).tone, "plain", "a done ticket is never shown as late");
  assert.equal(ticketGroupOf({ status: "Cancelled", due_date: "2026-10-01" }, today), "done");
});
