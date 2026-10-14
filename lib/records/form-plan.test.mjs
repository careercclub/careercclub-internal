import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { recordDefinitions } from "./catalog.ts";
import { ITEM_NOUN, REFERENCES, addTag, asTagList, displayLabel, fieldKind, isIdLike, optionLabel, planForm, plural } from "./form-plan.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tableNames = new Set([...readFileSync(join(root, "lib/db/tables.ts"), "utf8").matchAll(/^\s+"(\w+)",$/gm)].map((match) => match[1]));

test("tidak ada lagi isian ID/UUID yang harus diketik manual", () => {
  const untyped = [];
  for (const [key, definition] of Object.entries(recordDefinitions)) {
    for (const field of definition.fields) {
      if (isIdLike(field) && fieldKind(key, field) === "plain") untyped.push(`${key}.${field.name}`);
    }
  }
  assert.deepEqual(untyped, [], "tambahkan ke REFERENCES (dropdown nama) atau EXTERNAL_IDS");
});

test("setiap sumber dropdown menunjuk tabel & kolom yang ada", () => {
  for (const [key, source] of Object.entries(REFERENCES)) {
    const [definitionKey, fieldName] = key.split(".");
    assert.ok(recordDefinitions[definitionKey]?.fields.some((field) => field.name === fieldName), `${key} tidak ada di katalog`);
    assert.ok(tableNames.has(source.table), `${key} → tabel ${source.table} tidak terdaftar`);
    assert.ok(source.label.length > 0);
  }
});

test("tidak ada lagi kotak JSON mentah di bagian utama form", () => {
  for (const [key, definition] of Object.entries(recordDefinitions)) {
    const plan = planForm(key, definition.fields);
    for (const field of [...plan.main, ...plan.more]) {
      if (field.type === "json") assert.equal(fieldKind(key, field), "tags", `${key}.${field.name}: JSON di depan hanya boleh sebagai editor daftar`);
    }
  }
});

test("isian wajib selalu di bagian utama; isian sistem tidak pernah wajib", () => {
  for (const [key, definition] of Object.entries(recordDefinitions)) {
    const plan = planForm(key, definition.fields);
    for (const field of definition.fields.filter((item) => item.required && fieldKind(key, item) !== "advanced")) {
      assert.ok(plan.main.includes(field), `${key}.${field.name} wajib tapi tidak di bagian utama`);
    }
    for (const field of plan.system) assert.ok(!field.required, `${key}.${field.name}`);
  }
});

test("form tickets: dari 18 isian, yang tampil di depan hanya yang wajib", () => {
  const plan = planForm("tickets", recordDefinitions.tickets.fields);
  assert.deepEqual(plan.main.map((field) => field.name), ["title", "notification_roles"]);
  assert.deepEqual(plan.system.map((field) => field.name), ["files", "komentar"]);
  assert.ok(plan.more.some((field) => field.name === "assigned_to_ids"));
});

test("form tanpa isian wajib tetap menampilkan 3 isian pertama di depan", () => {
  const plan = planForm("ig_snapshots", recordDefinitions.ig_snapshots.fields);
  assert.equal(plan.main[0].name, "week_start");
  const noRequired = planForm("x", [{ name: "a", label: "A" }, { name: "b", label: "B" }, { name: "c", label: "C" }, { name: "d", label: "D" }]);
  assert.deepEqual(noRequired.main.map((field) => field.name), ["a", "b", "c"]);
  assert.deepEqual(noRequired.more.map((field) => field.name), ["d"]);
});

test("label manusiawi: tanpa ID/UUIDs/JSON", () => {
  assert.equal(displayLabel("Product ID"), "Product");
  assert.equal(displayLabel("Assignee UUIDs"), "Assignees");
  assert.equal(displayLabel("Event links JSON"), "Event links");
  assert.equal(displayLabel("R2 object keys JSON"), "object keys");
  assert.equal(displayLabel("Name"), "Name");
});

test("setiap tabel punya sebutan item untuk tombol (Add …)", () => {
  assert.deepEqual(Object.keys(recordDefinitions).filter((key) => !ITEM_NOUN[key]), []);
  assert.equal(plural("feature"), "features");
  assert.equal(plural("category"), "categories");
  assert.equal(plural("person"), "people");
  assert.equal(plural("feature", 1), "feature");
});

test("editor daftar: hanya untuk daftar teks; selain itu jatuh ke kotak JSON", () => {
  assert.deepEqual(asTagList(["Tips", " Karier "]), ["Tips", "Karier"]);
  assert.deepEqual(asTagList('["a","b"]'), ["a", "b"]);
  assert.deepEqual(asTagList(null), []);
  assert.equal(asTagList([{ url: "x" }]), null);
  assert.equal(asTagList("bukan json"), null);
  assert.deepEqual(addTag(["Tips"], " tips "), ["Tips"]);
  assert.deepEqual(addTag(["Tips"], "Karier"), ["Tips", "Karier"]);
});

test("label pilihan dropdown: tanggal dari timestamp dirapikan", () => {
  assert.equal(optionLabel({ nama: "Webinar MT", tanggal: "2026-10-20T00:00:00.000Z" }, ["nama", "tanggal"]), "Webinar MT · 2026-10-20");
  assert.equal(optionLabel({ ticket_no: null, title: "Desain" }, ["ticket_no", "title"]), "Desain");
  assert.equal(optionLabel({}, ["nama"]), "Untitled");
});
