import assert from "node:assert/strict";
import test from "node:test";
import { calendarTasks, calendarTickets, isCalendarTicket } from "./calendar.ts";

test("calendar keeps open, dated tickets that have no Program task", () => {
  const rows = [
    { id: "a", status: "Todo", due_date: "2026-10-30", related_task_id: null, created_at: "x", description: null },
    { id: "b", status: "Done", due_date: "2026-10-30" },
    { id: "c", status: "Todo", due_date: null },
    { id: "d", status: "In Progress", due_date: "2026-10-30", related_task_id: "t1" },
  ];
  assert.deepEqual(rows.filter(isCalendarTicket).map((r) => r.id), ["a"]);
  assert.deepEqual(calendarTickets(rows), [{ id: "a", status: "Todo", due_date: "2026-10-30" }]);
  assert.deepEqual(calendarTasks([{ id: "t", due_date: "2026-11-01", updated_at: "x" }, { id: "u", due_date: null }]), [{ id: "t", due_date: "2026-11-01" }]);
});
