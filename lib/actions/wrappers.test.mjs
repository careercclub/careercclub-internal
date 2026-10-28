// Server actions return failures as values (production hides thrown messages). These checks keep
// every action and every client import on that path.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { databaseMessage, failureMessage } from "./messages.ts";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("every server action runs through expected() and has a browser wrapper", () => {
  for (const file of readdirSync(new URL("app/actions/", root)).filter((f) => f.endsWith(".ts"))) {
    const source = read(`app/actions/${file}`);
    const names = [...source.matchAll(/export async function (\w+)\s*\(/g)].map((m) => m[1]);
    const wrapped = (source.match(/return expected\(async \(\) => \{/g) || []).length;
    assert.equal(wrapped, names.length, `${file}: every exported action returns expected(…)`);
    const wrapper = read(`app/_actions/${file}`);
    for (const name of names) assert.match(wrapper, new RegExp(`export const ${name} = unwrapAction\\(server\\.${name}\\)`), `${file}: ${name} has a wrapper`);
  }
});

test("client components import actions through app/_actions", () => {
  const walk = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${dir}${e.name}/`) : [`${dir}${e.name}`]);
  const offenders = walk("app/").filter((p) => /\.(ts|tsx)$/.test(p) && !p.startsWith("app/actions/") && !p.startsWith("app/_actions/")).filter((p) => read(p).includes('from "@/app/actions/'));
  assert.deepEqual(offenders, []);
});

test("database errors become sentences", () => {
  assert.equal(databaseMessage({ code: "23502", table_name: "resources", column_name: "tipe" }), "Type is required.");
  assert.match(databaseMessage({ code: "23505", detail: "Key (email)=(a@b.c) already exists." }), /already exists \(email: a@b.c\)/);
  assert.match(databaseMessage({ code: "23514", table_name: "resources", column_name: "tipe", constraint_name: "resources_tipe_check" }), /^Type has a value that is not allowed/);
  assert.equal(databaseMessage(new Error("x")), null);
});

test("our own messages pass; bugs get the generic message", () => {
  assert.equal(failureMessage(new Error("Ticket title is required.")), "Ticket title is required.");
  assert.equal(failureMessage(new TypeError("x is undefined")), null);
});
