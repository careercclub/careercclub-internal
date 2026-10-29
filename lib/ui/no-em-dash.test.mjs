// antislop R-02: no em dash in text people read. Comments, stored data values (CRM statuses as
// saved in the database) and parser patterns that must recognise a dash in imported files are exempt.
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const walk = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === "node_modules" ? [] : walk(`${dir}${e.name}/`)) : [`${dir}${e.name}`]);
const EXEMPT = [/Sudah convert —/, /placeholderName/, /s\\\/d\|sd\|sampai/];

test("no em dash in UI text (R-02)", () => {
  const offenders = [];
  for (const path of [...walk("app/"), ...walk("lib/"), ...walk("components/")].filter((p) => /\.(tsx?|mjs)$/.test(p) && !p.includes(".test."))) {
    readFileSync(new URL(path, root), "utf8").split("\n").forEach((line, index) => {
      if (!line.includes("—")) return;
      const code = line.replace(/\{\/\*.*?\*\/\}/g, "").replace(/\/\/.*$/, "").trim();
      if (!code.includes("—") || /^(\*|\/\*)/.test(code) || EXEMPT.some((pattern) => pattern.test(line))) return;
      offenders.push(`${path}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
