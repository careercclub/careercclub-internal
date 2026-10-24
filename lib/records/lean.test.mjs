import assert from "node:assert/strict";
import test from "node:test";
import { leanRow, leanRows } from "./lean.ts";

test("lean rows drop nulls and skipped columns, keep zero/false/empty arrays", () => {
  const row = { id: "1", judul: "Post", views: 0, saves: null, posted: false, tags: [], description: "long caption", created_at: "2026-10-01" };
  assert.deepEqual(leanRow(row, ["description", "created_at"]), { id: "1", judul: "Post", views: 0, posted: false, tags: [] });
  assert.equal(leanRows([row, { id: "2", saves: null }]).length, 2);
  assert.deepEqual(leanRows([{ id: "2", saves: null }])[0], { id: "2" });
});
