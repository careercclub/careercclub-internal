// Talent Pool: one buyer rule; header numbers, filters and blast segments agree.
import assert from "node:assert/strict";
import test from "node:test";
import { facetOptions, facetValue, filterCandidates, isBuyer, poolSummary, splitList } from "./view.ts";

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
  assert.deepEqual(filterCandidates(rows, { facets: { status: "Student", source: "Webinar" } }).map((r) => r.id), [3, 4]);
  assert.deepEqual(filterCandidates(rows, { pipeline: "prospects", facets: { tier: "Tier 1" } }).map((r) => r.id), [3]);
  assert.deepEqual(splitList(" FMCG ,, Banking "), ["FMCG", "Banking"]);
});

// The Google Form answers as they really come in (Indonesian, mixed spelling, a broken apostrophe).
const form = [
  { id: "a", status: "Aktif berkuliah", domisili: "jakarta selatan", relocate: "Yes, absolutely!", pendidikan: "S1", campus_tier: "TIER 1", ipk: "3,62", angkatan: "2021", tahun_lulus: "2025", organisasi: "Yes, as a leader/co-leader", exchange: "No, I have not participated in an exchange or study abroad program" },
  { id: "b", status: "Fresh Graduate", domisili: "Jakarta Selatan ", relocate: "No, Iâ€™d prefer not to.", pendidikan: "S2", campus_tier: "X/Non Priority", ipk: "3.9", angkatan: "2019", tahun_lulus: "2023", organisasi: "Yes, as a member", exchange: "Yes, I have participated in an exchange or study abroad program" },
  { id: "c", status: "Sudah bekerja dan ingin career switch", domisili: "Bandung", relocate: "No, I’d prefer not to.", pendidikan: "D3", campus_tier: "TIER 2", ipk: "2.95", angkatan: "2018", tahun_lulus: "2022", organisasi: "No", exchange: "No, I have not participated…" },
  { id: "d", status: "", ipk: "85", angkatan: "", tahun_lulus: "" },
];

test("facets turn form answers into one English option each", () => {
  const v = (key) => form.map((row) => facetValue(row, key));
  assert.deepEqual(v("status"), ["Student", "Fresh graduate", "Working, career switch", ""]);
  assert.deepEqual(v("city"), ["Jakarta Selatan", "Jakarta Selatan", "Bandung", ""]);
  assert.deepEqual(v("relocate"), ["Yes", "No", "No", ""]);
  assert.deepEqual(v("education"), ["Bachelor's (S1)", "Master's (S2)", "Diploma (D3)", ""]);
  assert.deepEqual(v("tier"), ["Tier 1", "Non-priority", "Tier 2", ""]);
  assert.deepEqual(v("grade"), ["3.51–3.75", "3.76–4.00", "Below 3.00", ""], "3,62 with a comma counts; 85 is not a 4-point grade");
  assert.deepEqual(v("org"), ["Leader", "Member", "No", ""]);
  assert.deepEqual(v("abroad"), ["No", "Yes", "No", ""]);
});

test("facet options carry counts in a sensible order; filters combine", () => {
  assert.deepEqual(facetOptions(form, "city"), [["Jakarta Selatan", 2], ["Bandung", 1]]);
  assert.deepEqual(facetOptions(form, "intake").map(([v]) => v), ["2021", "2019", "2018"], "years newest first");
  assert.deepEqual(facetOptions(form, "tier").map(([v]) => v), ["Tier 1", "Tier 2", "Non-priority"]);
  assert.deepEqual(filterCandidates(form, { facets: { relocate: "No", org: "Member" } }).map((r) => r.id), ["b"]);
  assert.deepEqual(filterCandidates(form, { facets: { city: "Jakarta Selatan", grade: "" } }).map((r) => r.id), ["a", "b"], "an empty choice is no filter");
});
