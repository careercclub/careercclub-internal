import assert from "node:assert/strict";
import test from "node:test";
import { senderAddress } from "./sender.ts";

test("emails are sent only from the configured domain", () => {
  assert.equal(senderAddress("hello@ccclub.id", "noreply@ccclub.id"), "hello@ccclub.id");
  assert.equal(senderAddress("ceo@bank.co.id", "noreply@ccclub.id"), "noreply@ccclub.id");
  assert.equal(senderAddress("x@ccclub.id.evil.com", "noreply@ccclub.id"), "noreply@ccclub.id");
  assert.equal(senderAddress(undefined, "noreply@ccclub.id"), "noreply@ccclub.id");
});
