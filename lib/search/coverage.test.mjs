// Traceability: every searchable table must land on a page that can actually show the
// record, otherwise a search result would open a page and highlight nothing.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { recordDefinitions } from "../records/catalog.ts";
import { extraSearchDefinitions } from "./extra-definitions.ts";
import { buildSearchSpecs } from "./registry.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(root, path), "utf8");

function pageFile(path) {
  return join("app", "(dashboard)", ...path.split("/").filter(Boolean), "page.tsx");
}

/** Components the page imports from app/_components, resolved to files. */
function pageComponents(source) {
  return [...source.matchAll(/from "@\/app\/_components\/([\w-]+)"/g)].map((match) => `app/_components/${match[1]}.tsx`).filter((file) => existsSync(join(root, file)));
}

function canLand(spec) {
  const page = read(pageFile(spec.path));
  // Generic table: RecordManager for this exact table jumps to the row and opens its editor.
  if (page.includes(`definitionKey="${spec.key}"`)) return "RecordManager";
  // Custom module: listens for the focus event or marks its items.
  const custom = pageComponents(page).find((file) => /useRecordFocus|data-record-id/.test(read(file)));
  return custom ? custom.replace("app/_components/", "") : "";
}

const specs = buildSearchSpecs({ ...recordDefinitions, ...extraSearchDefinitions });

test("setiap tabel yang bisa dicari punya halaman tujuan", () => {
  const missing = specs.filter((spec) => !existsSync(join(root, pageFile(spec.path)))).map((spec) => `${spec.key} → ${spec.path}`);
  assert.deepEqual(missing, []);
});

test("setiap halaman tujuan bisa menunjukkan datanya (tanpa celah)", () => {
  const gaps = specs.filter((spec) => !canLand(spec)).map((spec) => `${spec.key} → ${spec.path}`);
  assert.deepEqual(gaps, []);
});

test("RecordManager menandai baris dan editor untuk dibuka dari pencarian", () => {
  const source = read("app/_components/record-manager.tsx");
  assert.match(source, /data-record-id=\{id\}/);
  assert.match(source, /data-record-open/);
  assert.match(source, /useRecordFocus/);
});
