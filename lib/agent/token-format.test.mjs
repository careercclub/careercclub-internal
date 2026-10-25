import assert from "node:assert/strict";
import test from "node:test";
import { hashAgentKey, isAgentModule, keyFromHeader, newAgentKey } from "./token-format.ts";

test("keys are random, stored as a hash, recognised by their prefix", () => {
  const a = newAgentKey(); const b = newAgentKey();
  assert.notEqual(a.key, b.key);
  assert.match(a.key, /^ccc_[A-Za-z0-9_-]{43}$/);
  assert.equal(a.hash, hashAgentKey(a.key));
  assert.equal(a.hash.length, 64);
  assert.ok(!a.hash.includes(a.key.slice(4, 20)), "the hash does not contain the key");
  assert.equal(a.prefix, a.key.slice(0, 10));
});

test("only a well-formed Bearer header yields a key; modules are a fixed list", () => {
  const { key } = newAgentKey();
  assert.equal(keyFromHeader(`Bearer ${key}`), key);
  assert.equal(keyFromHeader(key), null);
  assert.equal(keyFromHeader("Bearer abc"), null);
  assert.equal(keyFromHeader(null), null);
  assert.ok(isAgentModule("job-vacancy-mt"));
  assert.ok(!isAgentModule("users"));
});
