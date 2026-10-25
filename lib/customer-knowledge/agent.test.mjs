import assert from "node:assert/strict";
import test from "node:test";
import { commentKey, monthValue, planPainPoints, summarisePainPoints } from "./agent.ts";

const PLATFORMS = ["Instagram", "TikTok", "X"];
const CATEGORIES = ["Karier", "Psikotes"];
const EXISTING = [{ id: "pp1", komentar: "Susah cari loker!!", platform: "Instagram", kategori: "Karier", username: "", bulan: "Okt", source_url: "", notes: "Ditulis tim", labels: ["Fresh grad"] }];

test("months in any common form", () => {
  assert.deepEqual([monthValue(10), monthValue("Okt"), monthValue("oct"), monthValue("October"), monthValue("2026-08-12"), monthValue("Agustus"), monthValue("Mei"), monthValue("may"), monthValue("13"), monthValue("x")], ["Okt", "Okt", "Okt", "Okt", "Agu", "Agu", "Mei", "Mei", "", ""]);
});

test("same comment ignoring case, spaces and punctuation", () => {
  assert.equal(commentKey("Susah  cari LOKER!!"), commentKey("susah cari loker"));
});

test("a new pain point; platform and category take the module's spelling", () => {
  const [item] = planPainPoints([{ comment: "Psikotes BUMN bikin stres", platform: "tiktok", category: "psikotes", month: "2026-10-03", username: "@budi", labels: ["BUMN", "BUMN", ""] }], EXISTING, PLATFORMS, CATEGORIES);
  assert.equal(item.action, "add");
  assert.deepEqual(item.set, { komentar: "Psikotes BUMN bikin stres", platform: "TikTok", kategori: "Psikotes", bulan: "Okt", username: "@budi" });
  assert.deepEqual(item.labels, ["BUMN"]);
});

test("the same comment again: only empty fields and new labels, the team's notes stay", () => {
  const [item] = planPainPoints([{ comment: "susah cari loker", platform: "Instagram", category: "Psikotes", month: 3, username: "rina", notes: "Dari Claude", source_url: "https://instagram.com/p/x", labels: ["fresh grad", "Loker"] }], EXISTING, PLATFORMS, CATEGORIES);
  assert.equal(item.action, "update");
  assert.deepEqual(item.set, { username: "rina", source_url: "https://instagram.com/p/x" });
  assert.deepEqual(item.addLabels, ["Loker"]);
  assert.deepEqual(item.labels, ["Fresh grad", "Loker"]);
});

test("same words on another platform is another pain point", () => {
  const [item] = planPainPoints([{ comment: "Susah cari loker", platform: "X", category: "Karier", month: "Okt" }], EXISTING, PLATFORMS, CATEGORIES);
  assert.equal(item.action, "add");
});

test("invalid items say why", () => {
  const items = planPainPoints([{ platform: "Instagram", category: "Karier", month: 1 }, { comment: "a", platform: "Facebook", category: "Karier", month: 1 }, { comment: "b", platform: "X", category: "Gaji", month: 1 }, { comment: "c", platform: "X", category: "Karier" }, { comment: "d", platform: "X", category: "Karier", month: 1, source_url: "x.com/1" }, { comment: "e", platform: "X", category: "Karier", month: 1 }, { comment: "E!", platform: "x", category: "Karier", month: 1 }], EXISTING, PLATFORMS, CATEGORIES);
  assert.deepEqual(items.map((i) => i.action), ["invalid", "invalid", "invalid", "invalid", "invalid", "add", "invalid"]);
  assert.match(items[1].errors[0], /Use one of: Instagram, TikTok, X/);
  assert.match(items[6].errors[0], /listed twice/);
  assert.deepEqual(summarisePainPoints(items), { added: 1, updated: 0, unchanged: 0, invalid: 6 });
});
