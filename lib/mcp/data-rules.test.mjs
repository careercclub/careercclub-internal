import assert from "node:assert/strict";
import test from "node:test";
import { recordDefinitions } from "../records/catalog.ts";
import { cleanRow, formEntries, isHiddenField, maskAccount, missingRequired, pageOf, refusedFields, rowFilter, rowMatches, writableFields } from "./data-rules.ts";

test("passwords, secrets and account links never leave the server", () => {
  const row = cleanRow("resources", { id: "r1", title: "Canva", password: "hunter2", password_hash: "x", auth_user_id: "u1", url: "https://canva.com" });
  assert.equal(row.password, undefined);
  assert.equal(row.password_hash, undefined);
  assert.equal(row.auth_user_id, undefined);
  assert.equal(row.has_password, true);
  assert.equal(JSON.stringify(row).includes("hunter2"), false);
  assert.equal(isHiddenField("api_key"), true);
  assert.equal(isHiddenField("token_hash"), true);
  assert.equal(isHiddenField("name"), false);
});

test("bank accounts are masked", () => {
  assert.equal(cleanRow("collaborators", { rekening: "BCA 1234567890 a.n. Rina" }).rekening, "•••• 7890");
  assert.equal(maskAccount(""), "");
  assert.equal(maskAccount(null), "");
});

test("every module is writable except secrets, bank accounts and files", () => {
  const resources = writableFields("resources", recordDefinitions.resources.fields).map((f) => f.name);
  assert.equal(resources.includes("password"), false);
  const collab = writableFields("collaborators", recordDefinitions.collaborators.fields).map((f) => f.name);
  assert.equal(collab.includes("rekening"), false);
  assert.equal(collab.includes("foto_url"), false);
  assert.ok(collab.includes("nama"));
  assert.deepEqual(refusedFields("resources", recordDefinitions.resources, { nama: "x", password: "y", made_up: 1 }), ["password", "made_up"]);
});

test("form values keep every type the app form sends", () => {
  const fields = [
    { name: "title", label: "T" }, { name: "done", label: "D", type: "checkbox" }, { name: "off", label: "O", type: "checkbox" },
    { name: "links", label: "L", type: "json" }, { name: "ids", label: "I", type: "uuid-array" }, { name: "roles", label: "R", type: "text-array" },
    { name: "due", label: "Due", type: "date" }, { name: "n", label: "N", type: "number" }, { name: "empty", label: "E" },
  ];
  const entries = formEntries(fields, { title: "Hi", done: true, off: false, links: [{ url: "u" }], ids: ["a", "b"], roles: ["admin", "lead"], due: new Date("2026-10-30T00:00:00Z"), n: 3, empty: null });
  assert.deepEqual(entries, [["title", "Hi"], ["done", "on"], ["links", '[{"url":"u"}]'], ["ids", "a,b"], ["roles", "admin"], ["roles", "lead"], ["due", "2026-10-30"], ["n", "3"]]);
});

test("required fields are checked before saving", () => {
  assert.deepEqual(missingRequired("partners", recordDefinitions.partners, { name: " " }), ["name"]);
  assert.deepEqual(missingRequired("partners", recordDefinitions.partners, { name: "PT A" }), []);
});

test("search, filters and pages", () => {
  const rows = [{ name: "PT Sinar", status: "Approached", ids: ["p1"] }, { name: "Bank Mitra", status: "Closed Deal", ids: [] }];
  assert.equal(rows.filter((r) => rowMatches(r, "sinar approached")).length, 1);
  assert.equal(rows.filter(rowFilter({ status: "closed deal" })).length, 1);
  assert.equal(rows.filter(rowFilter({ ids: "p1" })).length, 1);
  assert.equal(rows.filter(rowFilter({ password: "x" })).length, 2, "a filter on a hidden field is ignored, not used to guess it");
  const page = pageOf(Array.from({ length: 120 }, (_, i) => i), 50, 100);
  assert.deepEqual([page.total, page.rows.length, page.more], [120, 20, false]);
  assert.equal(pageOf([1, 2], 9999).limit, 200);
});
