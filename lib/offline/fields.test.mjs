import assert from "node:assert/strict";
import test from "node:test";
import { fieldValue, mergeOfflineChanges, offlineDiff, planReplay } from "./fields.ts";

test("one way to read a field", () => {
  assert.equal(fieldValue("due_date", new Date("2026-10-05T00:00:00Z")), "2026-10-05");
  assert.equal(fieldValue("due_date", "2026-10-05T00:00:00.000Z"), "2026-10-05");
  assert.equal(fieldValue("due_date", null), "");
  assert.equal(fieldValue("assignee_ids", ["b", "a"]), "a,b");
  assert.equal(fieldValue("assignee_ids", "{b,a}"), "a,b");
  assert.equal(fieldValue("title", "  Hi "), "Hi");
});

test("only what the person changed is kept", () => {
  const diff = offlineDiff("ticket", { title: "A", status: "Todo", due_date: new Date("2026-10-05T00:00:00Z"), assigned_to_ids: ["x"] }, { title: "A", status: "Done", due_date: "2026-10-05", assigned_to_ids: ["x"], cc: "ignored" });
  assert.deepEqual(diff, { before: { status: "Todo" }, after: { status: "Done" } });
});

test("two offline changes to one item: first before, last after; back to the start = nothing", () => {
  assert.deepEqual(mergeOfflineChanges({ before: { status: "Todo" }, after: { status: "Done" } }, { before: { status: "Done", title: "A" }, after: { status: "In Progress", title: "B" } }), { before: { status: "Todo", title: "A" }, after: { status: "In Progress", title: "B" } });
  assert.deepEqual(mergeOfflineChanges({ before: { status: "Todo" }, after: { status: "Done" } }, { before: { status: "Done" }, after: { status: "Todo" } }), { before: {}, after: {} });
});

test("replay: nobody touched it → apply, keeping other people's edits", () => {
  const plan = planReplay("ticket", { title: "A", status: "Todo", priority: "High" }, { status: "Todo" }, { status: "Done" });
  assert.equal(plan.state, "apply");
  assert.deepEqual(plan.changed, ["status"]);
  assert.equal(plan.merged.priority, "High");
  assert.equal(plan.merged.status, "Done");
});

test("replay: already the same (sent twice) → nothing to do", () => {
  assert.deepEqual(planReplay("task", { status: "Done" }, { status: "Todo" }, { status: "Done" }), { state: "already" });
});

test("replay: someone changed the same field → conflict; other fields still merge", () => {
  const plan = planReplay("task", { status: "On Progress", title: "Old" }, { status: "Todo", title: "Old" }, { status: "Done", title: "New" });
  assert.equal(plan.state, "conflict");
  assert.deepEqual(plan.conflicts, [{ field: "status", before: "Todo", mine: "Done", now: "On Progress" }]);
  assert.equal(plan.merged.title, "New");
});
