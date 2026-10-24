import assert from "node:assert/strict";
import test from "node:test";
import { compareText } from "./sort.ts";

test("urutan A–Z tidak peduli huruf besar/kecil dan aksen; angka dibaca angka", () => {
  assert.deepEqual(["ASTRO", "Adidas", "AIA", "ARISTA", "ASIATOP", "aqua"].sort(compareText), ["Adidas", "AIA", "aqua", "ARISTA", "ASIATOP", "ASTRO"]);
  assert.deepEqual(["Batch 10", "Batch 2", "Élan", "Elan B"].sort(compareText), ["Batch 2", "Batch 10", "Élan", "Elan B"]);
  assert.equal(compareText(null, ""), 0);
});
