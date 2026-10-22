// Job Vacancy MT: opening months, week of month, summary numbers, newsletter and company history.
import assert from "node:assert/strict";
import test from "node:test";
import { companyHistory, filterVacancies, industryRanking, list, monthsOf, newsletterRows, openingsByMonth, vacancySummary, weekOfMonth } from "./view.ts";

const now = new Date(2026, 9, 22); // 22 Oct 2026 → week 4
const rows = [
  { id: 1, company: "Unilever", program: "UFLP", industry: "FMCG", months: [9, 10], year: "2026", created_at: "2026-10-23T03:00:00Z" },
  { id: 2, company: "Unilever", program: "UFLP", industry: "FMCG", months: "[3]", year: "2025", created_at: "2025-03-02" },
  { id: 3, company: "BCA", program: "ODP", industry: "Perbankan & Keuangan", months: "10;11", year: "2026", created_at: "2026-10-05" },
  { id: 4, company: "Astra", program: "AMDP", industry: "", months: ["1"], year: "2026", created_at: "2026-01-10" },
];

test("lists and months parse from arrays, JSON text and separators", () => {
  assert.deepEqual(list("a; b|c"), ["a", "b", "c"]);
  assert.deepEqual(monthsOf(rows[2]), [10, 11]);
  assert.deepEqual(monthsOf({ months: "[13, 2, 2]" }), [2]);
  assert.equal(weekOfMonth(new Date(2026, 9, 8)), 2); assert.equal(weekOfMonth(new Date(2026, 9, 31)), 4);
});

test("summary and month bars agree with the month filter", () => {
  const s = vacancySummary(rows, now);
  assert.equal(s.total, 4); assert.equal(s.openNow, 2); assert.equal(s.companies, 3);
  const bars = openingsByMonth(rows, "2026");
  assert.equal(bars[9], filterVacancies(rows, { month: "10", year: "2026" }).length);
  assert.equal(bars[0], 1);
});

test("industry ranking counts companies; empty industry is 'Lainnya'", () => {
  const r = industryRanking(rows, 10);
  assert.deepEqual(r.map((x) => [x.name, x.companies, x.open]), [["FMCG", 1, 1], ["Lainnya", 1, 0], ["Perbankan & Keuangan", 1, 1]]);
  assert.equal(filterVacancies(rows, { industry: "Lainnya" }).length, 1);
});

test("newsletter picks the week's new openings; company pattern change", () => {
  assert.deepEqual(newsletterRows(rows, 9, 2026, 1, []).map((r) => r.id), [3]);
  assert.deepEqual(newsletterRows(rows, 9, 2026, 1, ["FMCG"]).map((r) => r.id), []);
  const uni = companyHistory(rows).find((c) => c.company === "Unilever");
  assert.equal(uni.programs[0].history.length, 2);
  assert.equal(uni.programs[0].patternChanged, true);
});
