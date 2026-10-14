import assert from "node:assert/strict";
import test from "node:test";
import { RECENT_LIMIT, addRecent, parseRecent } from "./recent.ts";

const item = (n) => ({ href: `/resources?focus=${n}`, path: "/resources", title: `Data ${n}`, detail: "", detailLabel: "", module: "Resources" });

test("terakhir dibuka: terbaru di atas, tanpa duplikat, maksimal 5", () => {
  let list = [];
  for (const n of [1, 2, 3]) list = addRecent(list, item(n));
  list = addRecent(list, item(1));
  assert.deepEqual(list.map((entry) => entry.title), ["Data 1", "Data 3", "Data 2"]);
  for (const n of [4, 5, 6, 7]) list = addRecent(list, item(n));
  assert.equal(list.length, RECENT_LIMIT);
  assert.equal(list[0].title, "Data 7");
});

test("isi penyimpanan rusak atau aneh diabaikan, tidak membuat search error", () => {
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent("bukan json"), []);
  assert.deepEqual(parseRecent('{"a":1}'), []);
  assert.deepEqual(parseRecent(JSON.stringify([item(1), { href: "https://jahat.example", path: "/x", title: "x", module: "x" }, { href: "//jahat.example", path: "/x", title: "y", module: "x" }, null, 5])).map((entry) => entry.title), ["Data 1"]);
});
