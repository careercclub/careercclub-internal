import assert from "node:assert/strict";
import test from "node:test";
import { planCompetitors, summariseCompetitors, existingFlagKey } from "./agent.ts";

const TODAY = "2026-10-25";
const EXISTING = [{
  id: "c1", name: "Kerjaku Academy", category: "direct", primary_url: "", niche: "MT test prep", target_audience: "", threat_level: "medium", notes: "Ditulis tim",
  platforms: ["Instagram"], followers: { Instagram: 50000 }, snapshotDates: ["2026-10-01"], flagKeys: [existingFlagKey("new_campaign", "2026-10-02", "Promo 10.10")],
  products: [{ id: "p1", name: "Bootcamp MT", category: "Kelas", description: "", status: "", price_min: 300000, price_max: 300000, features: ["Psikotes"], links: [], latestPrice: { min: 300000, max: 300000, date: "2026-10-01" } }],
}];

test("a new competitor with followers, a flag and a product", () => {
  const [item] = planCompetitors([{ name: "Lolos MT", category: "Substitute", platforms: ["ig", "tiktok"], followers: { TikTok: "12.000" }, flags: [{ type: "new_product", date: "2026-10-20", description: "Kelas psikotes baru", source_url: "https://x.com/1" }], products: [{ name: "Kelas Psikotes", price: 150000, features: ["Tryout"] }] }], EXISTING, TODAY);
  assert.equal(item.action, "add");
  assert.equal(item.set.category, "substitusi");
  assert.deepEqual(item.platforms, ["Instagram", "TikTok"]);
  assert.deepEqual(item.followers, { TikTok: 12000 });
  assert.equal(item.snapshot.date, TODAY);
  assert.match(item.flags[0].description, /https:\/\/x.com\/1/);
  assert.deepEqual(item.products[0].addPrice, { min: 150000, max: 150000, date: TODAY });
});

test("an existing competitor: empty fields filled, filled ones are conflicts, followers newest wins", () => {
  const [item] = planCompetitors([{ name: "kerjaku academy", primary_url: "https://kerjaku.id", niche: "Career coaching", threat_level: "high", notes: "Dari Claude", followers: { Instagram: 52000, YouTube: 800 } }], EXISTING, TODAY);
  assert.equal(item.action, "update");
  assert.deepEqual(item.set, { primary_url: "https://kerjaku.id" });
  assert.deepEqual(item.conflicts.map((c) => c.field), ["niche", "threat_level", "notes"]);
  assert.deepEqual(item.followers, { Instagram: 52000, YouTube: 800 });
  assert.deepEqual(item.platforms, ["Instagram", "YouTube"]);
  assert.deepEqual(item.followerChanges.map((c) => [c.platform, c.from, c.to]), [["Instagram", 50000, 52000], ["YouTube", null, 800]]);
  assert.equal(item.snapshot.date, TODAY);
});

test("known flag skipped; product price change kept as a dated price; features added", () => {
  const [item] = planCompetitors([{ name: "Kerjaku Academy", flags: [{ type: "new_campaign", date: "2026-10-02", description: "promo 10.10" }, { type: "price_change", date: "2026-10-24", description: "Bootcamp naik" }], products: [{ name: "bootcamp mt", price_min: 350000, features: ["psikotes", "Interview"], price_date: "2026-10-24" }] }], EXISTING, TODAY);
  assert.deepEqual(item.flags.map((f) => f.flag_type), ["price_change"]);
  const [p] = item.products;
  assert.equal(p.action, "update");
  assert.deepEqual(p.addPrice, { min: 350000, max: 350000, date: "2026-10-24" });
  assert.deepEqual(p.features, ["Psikotes", "Interview"]);
  assert.ok(!("price_min" in p.set));
});

test("same day, same numbers → unchanged", () => {
  const existing = [{ ...EXISTING[0], snapshotDates: [TODAY] }];
  const [item] = planCompetitors([{ name: "Kerjaku Academy", followers: { Instagram: 50000 }, products: [{ name: "Bootcamp MT", price_min: 300000 }] }], existing, TODAY);
  assert.equal(item.action, "unchanged");
});

test("possible duplicate, match_id and as_new", () => {
  const items = planCompetitors([{ name: "Kerjaku" }, { name: "Kerjaku", as_new: true }], EXISTING, TODAY);
  assert.equal(items[0].action, "possible_duplicate");
  assert.equal(items[0].candidates[0].id, "c1");
  const [again] = planCompetitors([{ name: "Kerjaku", as_new: true }], EXISTING, TODAY);
  assert.equal(again.action, "add");
  const [matched] = planCompetitors([{ name: "Kerjaku", match_id: "c1", primary_url: "https://kerjaku.id" }], EXISTING, TODAY);
  assert.equal(matched.action, "update");
  assert.equal(matched.id, "c1");
});

test("invalid input says why", () => {
  const items = planCompetitors([{}, { name: "A", category: "rival" }, { name: "B", followers: { Facebook: 3 } }, { name: "C", flags: [{ type: "promo", date: "2026-10-01", description: "x" }] }, { name: "D", products: [{ name: "K", price_min: 5, price_max: 2 }] }, { name: "E", primary_url: "e.com" }], EXISTING, TODAY);
  assert.ok(items.every((i) => i.action === "invalid" && i.errors.length));
  assert.equal(summariseCompetitors(items).invalid, 6);
});
