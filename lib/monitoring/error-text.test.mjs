import assert from "node:assert/strict";
import test from "node:test";
import { actionName, errorFingerprint, maskMessage } from "./error-text.ts";

test("messages are masked before they are stored", () => {
  assert.equal(maskMessage('Key (email)=(Rina.Dewi@gmail.com) already exists.'), "Key (email)=([email]) already exists.");
  assert.equal(maskMessage("phone 081234567890 failed"), "phone [number] failed");
});

test("the same error with other ids or values is one row", () => {
  const a = errorFingerprint("action", "updateTicketDetailsAction", 'invalid input syntax for type uuid: "abc" at 7f1c2d3e-0000-4000-8000-000000000001');
  const b = errorFingerprint("action", "updateTicketDetailsAction", 'invalid input syntax for type uuid: "xyz" at 11111111-2222-4333-8444-555555555555');
  assert.equal(a, b);
  assert.notEqual(a, errorFingerprint("page", "/tickets", "invalid input syntax for type uuid"));
});

test("the action is named from the stack", () => {
  assert.equal(actionName("Error: x\n    at async updateTicketDetailsAction (file.js:1:1)\n    at expected"), "updateTicketDetailsAction");
  assert.equal(actionName(undefined), "server action");
});
