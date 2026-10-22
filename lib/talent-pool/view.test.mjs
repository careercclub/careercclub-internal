// Talent Pool: one buyer rule; header numbers, filters and blast segments agree.
import assert from "node:assert/strict";
import test from "node:test";
import { filterCandidates, isBuyer, poolSummary, splitList } from "./view.ts";

const rows = [
  { id: 1, nama: "Ani Putri", email: "ani@x.id", universitas: "UI", campus_tier: "Tier 1", status: "Fresh Graduate", sumber: "Webinar", target_mt: "FMCG, Banking", produk_dibeli: "Bootcamp" },
  { id: 2, nama: "Budi", email: "budi@x.id", universitas: "UI", campus_tier: "Tier 1", status: "Student", sumber: "Form", target_mt: "FMCG", buyer_match: { id: "b1" } },
  { id: 3, nama: "Cici", email: "", universitas: "ITB", campus_tier: "Tier 1", status: "Student", sumber: "Webinar", target_mt: "Banking, FMCG" },
  { id: 4, nama: "Dodi", wa: "0812", universitas: "UGM", status: "Student", sumber: "Webinar" },
];

test("buyer = matched to a CRM buyer or has a product bought", () => {
  assert.deepEqual(rows.map(isBuyer), [true, true, false, false]);
});

test("header numbers match the Buyers / Prospects filters", () => {
  const s = poolSummary(rows);
  assert.equal(s.total, 4);
  assert.equal(s.buyers, filterCandidates(rows, { pipeline: "buyers" }).length);
  assert.equal(s.prospects, filterCandidates(rows, { pipeline: "prospects" }).length);
  assert.equal(s.buyers + s.prospects, s.total);
  assert.equal(s.withEmail, 2);
  assert.deepEqual(s.topUniversity, ["UI", 2]);
  assert.deepEqual(s.topTarget, ["FMCG", 3], "multi-value targets are counted per item");
});

test("filters combine; search covers name, email, WA and university", () => {
  assert.deepEqual(filterCandidates(rows, { query: "itb" }).map((r) => r.id), [3]);
  assert.deepEqual(filterCandidates(rows, { query: "0812" }).map((r) => r.id), [4]);
  assert.deepEqual(filterCandidates(rows, { status: "Student", source: "Webinar" }).map((r) => r.id), [3, 4]);
  assert.deepEqual(filterCandidates(rows, { pipeline: "prospects", tier: "Tier 1" }).map((r) => r.id), [3]);
  assert.deepEqual(splitList(" FMCG ,, Banking "), ["FMCG", "Banking"]);
});
