// Putaran 10 guards: one popup system, buttons that name their object.
// Static scan of the client code, so a regression fails `npm test` before anyone clicks.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOTS = ["app", "components"];
function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}
const sources = ROOTS.flatMap((root) => files(root)).map((path) => ({ path, text: readFileSync(path, "utf8") }));

test("no browser confirm/alert/prompt — use confirmAction / askText / notify from app-dialog", () => {
  const offenders = sources.flatMap(({ path, text }) =>
    text.split("\n").flatMap((line, index) => (/\bwindow\.(confirm|alert|prompt)\s*\(|(^|[^.\w])(alert|prompt)\s*\(/.test(line) && !/function (confirm|alert|prompt)\b/.test(line) && !/^\s*(\/\/|\*)/.test(line) ? [`${path}:${index + 1}`] : [])));
  assert.deepEqual(offenders, []);
});

test("custom modal markup goes through useModal / DialogBehaviour (role=dialog, Esc, focus)", () => {
  const offenders = sources
    .filter(({ path, text }) => !path.endsWith("use-modal.tsx") && /className=\{styles\.(overlay|detailOverlay)\}/.test(text))
    .filter(({ text }) => !/useModal\(|<DialogBehaviour /.test(text))
    .map(({ path }) => path);
  assert.deepEqual(offenders, []);
});

test("button labels name their object (no bare Save / Add / Delete / Simpan / Tambah / Hapus / Terapkan)", () => {
  const bare = /<button\b[^>]*>\s*(?:<i [^>]*\/>\s*)?(Save|Add|Delete|Simpan|Tambah|Hapus|Terapkan|Batal \/ Reset)(?:\s*\([^)]*\))?\s*<\/button>/g;
  const offenders = sources.flatMap(({ path, text }) => [...text.matchAll(bare)].map((match) => `${path}: ${match[1]}`));
  assert.deepEqual(offenders, []);
});

test("confirm dialogs for deletes use a danger style and a specific label", () => {
  const calls = sources.flatMap(({ path, text }) => [...text.matchAll(/confirmAction\(\{([\s\S]*?)\}\)/g)].map((match) => ({ path, body: match[1] })));
  assert.ok(calls.length >= 21, `expected the app's confirms to use confirmAction, found ${calls.length}`);
  for (const { path, body } of calls) {
    const label = body.match(/confirmLabel:\s*(?:"([^"]+)"|[^,]+\?\s*"([^"]+)")/);
    assert.ok(label, `${path}: confirm without confirmLabel`);
    const text = label[1] || label[2];
    assert.ok(text.trim().split(/\s+/).length >= 2, `${path}: confirm label "${text}" should name the object`);
    if (/^Delete\b/.test(text)) assert.match(body, /danger:\s*true/, `${path}: "${text}" must be danger`);
  }
});
