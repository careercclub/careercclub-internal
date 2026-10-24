import assert from "node:assert/strict";
import test from "node:test";
import { accessFrom, createAccessCheck } from "./access.ts";

test("blocked or removed accounts lose access; role comes from the database", () => {
  assert.equal(accessFrom(null), null);
  assert.equal(accessFrom({ role: "member", is_active: false }), null);
  assert.deepEqual(accessFrom({ role: "Admin", is_active: true }), { role: "admin" });
  assert.deepEqual(accessFrom({ role: null, is_active: null }), { role: "member" });
});

test("access is re-read after the cache window, and at once after forget()", async () => {
  let clock = 0; let row = { role: "member", is_active: true }; let reads = 0;
  const access = createAccessCheck(async () => { reads += 1; return row; }, 60_000, () => clock);
  assert.deepEqual(await access.check("u1"), { role: "member" });
  row = { role: "member", is_active: false };
  clock = 30_000;
  assert.deepEqual(await access.check("u1"), { role: "member" }, "within a minute the cached answer is used");
  clock = 61_000;
  assert.equal(await access.check("u1"), null, "after a minute a blocked user is signed out");
  row = { role: "admin", is_active: true }; access.forget("u1");
  assert.deepEqual(await access.check("u1"), { role: "admin" }, "forget() applies a change immediately");
  assert.equal(reads, 3);
});
