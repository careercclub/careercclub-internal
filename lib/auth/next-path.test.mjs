import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "./next-path.ts";

test("after sign-in only paths on this app are followed", () => {
  assert.equal(safeNextPath("/oauth/authorize?client_id=a&state=b"), "/oauth/authorize?client_id=a&state=b");
  assert.equal(safeNextPath("https://internal.ccclub.id/oauth/authorize?x=1"), "/oauth/authorize?x=1");
  assert.equal(safeNextPath("https://evil.example/steal"), "/steal");
  assert.equal(safeNextPath("//evil.example/x"), "/x");
  assert.equal(safeNextPath("/sign-in"), "");
  assert.equal(safeNextPath(""), "");
  assert.equal(safeNextPath(undefined), "");
});
