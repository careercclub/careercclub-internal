import assert from "node:assert/strict";
import test from "node:test";
import { formatRupiah, formatRupiahShort } from "./money.ts";
import { formatDay } from "./date.ts";

test("one rupiah format: full on rows, short only for headlines", () => {
  assert.equal(formatRupiah(2500000), "Rp 2.500.000");
  assert.equal(formatRupiah("25000000"), "Rp 25.000.000");
  assert.equal(formatRupiah(""), "");
  assert.equal(formatRupiahShort(4_700_000), "Rp 4.7M");
  assert.equal(formatRupiahShort(25_000_000), "Rp 25M");
  assert.equal(formatRupiahShort(750_000), "Rp 750K");
  assert.equal(formatRupiahShort(950), "Rp 950");
});

test("one date format in text: 22 Mar 2026", () => {
  assert.equal(formatDay("2026-03-22"), "22 Mar 2026");
  assert.equal(formatDay("2026-09-01T10:00:00Z"), "1 Sep 2026");
  assert.equal(formatDay("2026-09-01", { year: false }), "1 Sep");
  assert.equal(formatDay("soon"), "");
});
