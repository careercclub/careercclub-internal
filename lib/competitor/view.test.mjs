// Competitor Intel: threat from the newest snapshot, filters, summary and the price board.
import assert from "node:assert/strict";
import test from "node:test";
import { competitorSummary, filterCompetitors, fmtN, priceBoard, threatOf } from "./view.ts";

const profiles = [
  { id: "a", name: "Alpha", category: "direct", threat_level: "low", followers: '{"Instagram": 120000, "TikTok": 5000}', target_audience: "Fresh grad | Student" },
  { id: "b", name: "Beta", category: "indirect", threat_level: "medium", followers: { Instagram: 900 }, target_audience: ["Jobseeker"] },
  { id: "c", name: "Gamma", category: "direct", threat_level: "" },
];
const snaps = [{ competitor_id: "a", snapshot_date: "2026-09-01", threat_level: "medium" }, { competitor_id: "a", snapshot_date: "2026-10-01", threat_level: "high" }];

test("threat comes from the newest snapshot, else the profile", () => {
  assert.equal(threatOf(profiles[0], snaps), "high");
  assert.equal(threatOf(profiles[1], snaps), "medium");
  assert.equal(threatOf(profiles[2], snaps), "");
});

test("filters, sort and summary agree", () => {
  assert.deepEqual(filterCompetitors(profiles, snaps, { threat: "high" }).map((p) => p.id), ["a"]);
  assert.deepEqual(filterCompetitors(profiles, snaps, { category: "direct", sort: "name" }).map((p) => p.id), ["a", "c"]);
  assert.deepEqual(filterCompetitors(profiles, snaps, { sort: "ig" }).map((p) => p.id), ["a", "b", "c"]);
  assert.deepEqual(filterCompetitors(profiles, snaps, { audience: "Student" }).map((p) => p.id), ["a"]);
  const s = competitorSummary(profiles, snaps, [{}, {}]);
  assert.deepEqual(s.threat, { high: 1, medium: 1, low: 0, none: 1 });
  assert.equal(s.category.direct, 2); assert.equal(s.flags, 2);
  assert.equal(fmtN(120000), "120K");
});

test("price board: latest recorded price wins, cheapest first, range per category", () => {
  const products = [{ id: 1, nama: "Kelas A", kategori: "Kelas", harga: 300000 }, { id: 2, nama: "Kelas B", kategori: "Kelas", harga: 100000 }, { id: 3, nama: "Ebook", harga: 0 }];
  const prices = [{ product_id: 1, price: 250000, recorded_at: "2026-10-01" }, { product_id: 1, price: 400000, recorded_at: "2026-01-01" }];
  const board = priceBoard(products, prices);
  const kelas = board.find((g) => g.category === "Kelas");
  assert.deepEqual(kelas.items.map((i) => [i.product.id, i.price]), [[2, 100000], [1, 250000]]);
  assert.equal(kelas.min, 100000); assert.equal(kelas.max, 250000);
  assert.equal(board.find((g) => g.category === "Lainnya").min, 0);
});
