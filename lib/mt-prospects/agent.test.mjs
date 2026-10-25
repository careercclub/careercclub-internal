import assert from "node:assert/strict";
import test from "node:test";
import { planCompanies, readCompany, summarisePlan } from "./agent.ts";

const EXISTING = [
  { id: "p1", brand: "Garudafood", legal_name: "PT Garudafood Putra Putri Jaya Tbk", industry: "FMCG", program: "", status: "active", active_years: "2024, 2025", notes: "", usual_months: [8, 9], openings: { 2025: { months: [8], label: "Agustus", dates: "" } }, contactNames: ["Rina Contoh"], noteTexts: ["Buka batch 2 di Oktober"] },
  { id: "p2", brand: "Bank Mandiri", legal_name: "PT Bank Mandiri (Persero) Tbk", industry: "", program: "ODP", status: "older", active_years: "", notes: "Catatan lama", usual_months: [], openings: {}, contactNames: [], noteTexts: [] },
  { id: "p3", brand: "Astra International", legal_name: "", industry: "", program: "", status: "active", active_years: "", notes: "", usual_months: [], openings: {}, contactNames: [], noteTexts: [] },
  { id: "p4", brand: "Astra Honda Motor", legal_name: "", industry: "", program: "", status: "active", active_years: "", notes: "", usual_months: [], openings: {}, contactNames: [], noteTexts: [] },
];

test("a new company goes in with what was given", () => {
  const [item] = planCompanies([{ brand: "Pyridam Farma", industry: "Pharma", openings: { 2026: { months: "Maret–April" } }, contacts: [{ name: "Budi", title: "HR" }], updates: [{ date: "2026-10-20", text: "Poster MT dibuka", source_url: "https://example.com/post" }] }], EXISTING);
  assert.equal(item.action, "add");
  assert.equal(item.set.status, "active");
  assert.deepEqual(item.addOpenings[2026].months, [3, 4]);
  assert.equal(item.addContacts.length, 1);
  assert.equal(item.addNotes[0].source_url, "https://example.com/post");
});

test("an existing company is only filled where empty; differences are reported, not written", () => {
  const [item] = planCompanies([{ brand: "PT Garudafood Putra Putri Jaya", industry: "Food & Beverage", program: "Garudafood MT", status: "predicted", usual_months: [8, 9], openings: { 2025: { months: [9] }, 2026: { months: [8] } }, contacts: [{ name: "rina contoh" }, { name: "Andi" }], updates: [{ text: "buka batch 2 di oktober" }, { text: "Batch 2026 dibuka Agustus" }] }], EXISTING);
  assert.equal(item.action, "update");
  assert.equal(item.id, "p1");
  assert.deepEqual(item.set, { program: "Garudafood MT" }, "only the empty field is filled");
  assert.deepEqual(item.conflicts.map((c) => c.field).sort(), ["industry", "status"]);
  assert.deepEqual(Object.keys(item.addOpenings), ["2026"], "2025 already there, kept");
  assert.deepEqual(item.addContacts.map((c) => c.name), ["Andi"], "Rina already there");
  assert.deepEqual(item.addNotes.map((n) => n.text), ["Batch 2026 dibuka Agustus"], "the same note is not added twice");
});

test("legal-name variants match; a similar name is a possible duplicate; match_id / as_new decide", () => {
  assert.equal(planCompanies([{ legal_name: "Bank Mandiri" }], EXISTING)[0].id, "p2");
  const dup = planCompanies([{ brand: "Garuda Food" }], EXISTING)[0];
  assert.equal(dup.action, "possible_duplicate");
  assert.deepEqual(dup.candidates.map((c) => c.id), ["p1"]);
  assert.equal(planCompanies([{ brand: "Garuda Food", match_id: "p1", program: "x" }], EXISTING)[0].action, "update");
  assert.equal(planCompanies([{ brand: "Garuda Food", as_new: true }], EXISTING)[0].action, "add");
  assert.equal(planCompanies([{ brand: "Astra" }], EXISTING)[0].action, "possible_duplicate", "two Astra companies → ask which");
  assert.equal(planCompanies([{ brand: "X", match_id: "nope" }], EXISTING)[0].action, "invalid");
});

test("bad input is listed, never guessed; summary counts each kind", () => {
  assert.ok(readCompany({}).errors.includes("brand or legal_name is required"));
  assert.ok(readCompany({ brand: "A", status: "open" }).errors[0].startsWith("status must be"));
  assert.ok(readCompany({ brand: "A", openings: { soon: {} } }).errors[0].includes("not a year"));
  assert.ok(readCompany({ brand: "A", updates: [{ date: "20 Oct", text: "x" }] }).errors[0].includes("YYYY-MM-DD"));
  const summary = summarisePlan(planCompanies([{ brand: "Pyridam Farma" }, { brand: "Bank Mandiri" }, {}, { brand: "Garuda Food" }], EXISTING));
  assert.deepEqual([summary.added, summary.unchanged, summary.invalid, summary.possibleDuplicates], [1, 1, 1, 1]);
});
