// Content Planning: Monday weeks, English labels, calendar grid and grouping.
import assert from "node:assert/strict";
import test from "node:test";
import { byDay, groupByWeek, monthCells, shortDay, weekLabel, weekRange, weekStart, weekdayDay } from "./view.ts";

test("weeks start on Monday and are labelled in English", () => {
  assert.equal(weekStart("2026-10-22"), "2026-10-19");
  assert.equal(weekStart("2026-10-25"), "2026-10-19", "Sunday belongs to the week before");
  assert.equal(weekLabel("2026-10-19"), "Week 4 · October");
  assert.equal(weekLabel("2026-09-28"), "Week 5 · September", "a week is named after the month it starts in");
  assert.equal(weekRange("2026-10-26"), "26 Oct – 1 Nov");
  assert.equal(shortDay("2026-10-05"), "5 Oct 2026");
  assert.equal(weekdayDay("2026-10-22"), "Thu, 22 Oct");
});

test("month grid: Monday-first blanks, every day once", () => {
  const cells = monthCells(2026, 9); // October 2026 starts on a Thursday
  assert.equal(cells.slice(0, 3).every((c) => c === null), true);
  assert.equal(cells[3], "2026-10-01");
  assert.equal(cells.filter(Boolean).length, 31);
});

test("agenda groups by week, sorted, with done counts; undated go to this week", () => {
  const rows = [{ id: 1, d: "2026-10-27", status: "Draft" }, { id: 2, d: "2026-10-21", status: "Done" }, { id: 3, d: "2026-10-20", status: "Draft" }, { id: 4, d: null, status: "Draft" }];
  const g = groupByWeek(rows, "d", "2026-10-22");
  assert.deepEqual(g.map((w) => w.start), ["2026-10-19", "2026-10-26"]);
  assert.deepEqual(g[0].items.map((r) => r.id), [4, 3, 2]);
  assert.equal(g[0].done, 1);
  assert.deepEqual(Object.keys(byDay(rows, "d")).sort(), ["2026-10-20", "2026-10-21", "2026-10-27"]);
});
