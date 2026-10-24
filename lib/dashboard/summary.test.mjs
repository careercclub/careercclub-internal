// Dashboard numbers: one rule for "late", same counts as the lists they summarise.
import assert from "node:assert/strict";
import test from "node:test";
import { isOverdue, summarizeDashboard, weekKeys } from "./summary.ts";

const people = [{ id: "p1", nama: "Ani Rahma" }, { id: "p2", nama: "Rizki" }];
const events = [
  { id: "e1", nama: "Webinar MT", tanggal: "2026-10-23", waktu: "19:00:00", status: "Planning", jenis_program: "Webinar", platform: "Zoom" },
  { id: "e2", nama: "CCA Batch 2", tanggal: "2026-11-03", status: "On Progress" },
  { id: "e3", nama: "Old class", tanggal: "2026-10-01", status: "Done" },
  { id: "e4", nama: "Cancelled class", tanggal: "2026-10-24", status: "Cancelled" },
];
const tasks = [
  { id: "t1", project_id: "e1", title: "Design flyer", status: "Todo", due_date: "2026-10-20", assignee_ids: ["p1"] },
  { id: "t2", project_id: "e1", title: "Book speaker", status: "Done", due_date: "2026-10-21", assignee_ids: ["p2"] },
  { id: "t3", project_id: "e1", title: "Rundown", status: "On Progress", due_date: "2026-10-22", assignee_id: "p2" },
  { id: "t4", project_id: "e2", title: "Venue", status: "Todo", due_date: "2026-11-30" },
];
const tickets = [
  { id: "k1", title: "Fix banner", status: "Todo", due_date: "2026-10-19", assigned_to_ids: ["p2"], ticket_no: "T-1" },
  { id: "k2", title: "Email blast", status: "In Progress", due_date: "2026-10-22" },
  { id: "k3", title: "Done one", status: "Done", due_date: "2026-10-01" },
  { id: "k4", title: "From task", status: "Todo", due_date: "2026-10-18", related_task_id: "t1" },
];
const s = summarizeDashboard({ tickets, tasks, events, people }, "2026-10-22");

test("late = not done and date before today, the same rule everywhere", () => {
  assert.equal(isOverdue({ status: "Todo", due_date: "2026-10-21" }, "2026-10-22"), true);
  assert.equal(isOverdue({ status: "Done", due_date: "2026-10-21" }, "2026-10-22"), false);
  assert.equal(isOverdue({ status: "Todo", due_date: "2026-10-22" }, "2026-10-22"), false, "due today is not late");
  assert.equal(isOverdue({ status: "Todo" }, "2026-10-22"), false, "no date is never late");
  assert.equal(s.lateTickets, 2, "k1 and k4 are late (k3 is done)");
  assert.equal(s.lateTasks, 1);
});

test("stat cards count the same rows the lists show", () => {
  assert.equal(s.openTickets, 3);
  assert.deepEqual([s.weekTasksDone, s.weekTasksTotal], [1, 3], "Mon 19 – Sun 25 Oct: t1, t2, t3");
  assert.equal(s.programsThisMonth, 2, "October programs, cancelled one excluded");
});

test("program cards: upcoming, not done/cancelled, progress from their tasks, people from assignees", () => {
  assert.deepEqual(s.programs.map((p) => p.id), ["e1", "e2"]);
  const p = s.programs[0];
  assert.deepEqual([p.done, p.total, p.pct], [1, 3, 33]);
  assert.deepEqual(p.people.map((x) => x.initials), ["AR", "RI"]);
  assert.equal(p.date, "Fri, 23 Oct"); assert.equal(p.time, "19:00");
});

test("up next: late first, tickets made for a task appear once (as the task), links open the record", () => {
  assert.deepEqual(s.upNext.map((i) => i.id), ["k1", "t1", "k2", "t3"]);
  assert.equal(s.upNext[0].due, "3d late"); assert.equal(s.upNext[0].state, "late");
  assert.equal(s.upNext[2].due, "Today");
  assert.equal(s.upNext[0].href, "/tickets?focus=k1"); assert.equal(s.upNext[1].href, "/program?focus=e1");
  assert.ok(!s.upNext.some((i) => i.id === "k4" || i.id === "t4"), "task tickets and far-off tasks are left out");
});

test("week strip Monday–Sunday with today marked and a count per day", () => {
  assert.deepEqual(weekKeys("2026-10-22"), ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
  assert.deepEqual(s.week.map((d) => d.count), [1, 1, 0, 2, 1, 0, 0]);
  assert.equal(s.week.find((d) => d.isToday).day, 22);
  assert.deepEqual(s.weekEvents.map((e) => e.when), ["Fri, 23 Oct · 19:00"]);
});

test("late label is short and capped", async () => {
  const { lateLabel } = await import("./summary.ts");
  assert.equal(lateLabel(1), "1d late");
  assert.equal(lateLabel(59), "59d late");
  assert.equal(lateLabel(125), "4mo late");
  assert.equal(lateLabel(9186), "1y+ late");
});
