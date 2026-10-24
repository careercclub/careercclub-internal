// Job Vacancy MT: workbook parsing (months, matching) and the numbers each tab shows.
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeName, parseMonths, parseProspectWorkbook } from "./parse.ts";
import { activeYearsLabel, calendarMonth, displayName, expectedIn, industryCounts, isMissing, isPerson, latestOpening, linkHref, matchesQuery, monthCounts, prospectSearchText, sortByName, splitSteps, yearsOf } from "./view.ts";

test("bulan: rentang, daftar, lintas tahun, dan teks tanpa bulan", () => {
  assert.deepEqual(parseMonths("Agustus–November"), [8, 9, 10, 11]);
  assert.deepEqual(parseMonths("Januari, Februari, Oktober"), [1, 2, 10]);
  assert.deepEqual(parseMonths("Mei - Juni"), [5, 6]);
  assert.deepEqual(parseMonths("Desember–Februari"), [1, 2, 12]);
  assert.deepEqual(parseMonths("April (data tim)"), [4]);
  assert.deepEqual(parseMonths("Jul-Okt 2025"), [7, 8, 9, 10]);
  assert.deepEqual(parseMonths("Belum jelas"), []);
  assert.deepEqual(parseMonths(""), []);
});

test("nama: PT/Tbk/aksen diabaikan saat dicocokkan", () => {
  assert.equal(normalizeName("PT Bank Syariah Indonesia Tbk"), "bank syariah indonesia");
  assert.equal(normalizeName("L'Oréal"), "l oreal");
});

const HEAD = ["Nama PT (legal)", "Brand", "Tahun Aktif", "Total Pembukaan", "Bulan Langganan", "Nama MT / Program", "2025\nBulan Buka", "2025\nTanggal Buka", "2026\nBulan Buka", "2026\nTanggal Buka", "Catatan", "Industry"];
const book = (extra = {}) => ({
  "Aktif (MT 2026)": [HEAD, ["PT Satu Tbk", "Satu (S1 Group)", "2 dari 2", "4", "Mei", "MT", "Mei", "3 Mei", "Mei–Juni", "8 Mei", "", "FMCG"], ["", "", "", "", "", "", "", "", "", "", "", ""]],
  "Pernah Buka (2025)": [HEAD.slice(0, 8).concat(["Catatan", "Industry"]), ["PT Dua", "Dua", "1 dari 2", "1", "", "GDP", "November", "21 November", "", "Banking"]],
  "Lama (2024 saja)": [["Nama PT (legal)", "Brand", "Nama MT / Program", "2024\nBulan Buka", "Industry"], ["PT Satu Tbk", "Satu (S1 Group)", "Old MT", "Maret", "FMCG"]],
  "Kontak HR": [["Nama PT (legal)", "Brand", "Status MT", "Nama", "Jabatan", "LinkedIn"], ["PT Satu Tbk", "Satu (S1 Group)", "Lama (2024 saja)", "Ani", "HR", "https://id.linkedin.com/in/ani"], ["", "S1 Group", "Aktif", "Bayu", "TA", ""]],
  "Syarat Gabungan": [["Asal Data", "ID", "Brand", "Program"], ["Poster IG", "", "satu", "MT"], ["Poster IG", "", "Tidak Ada", "MT"]],
  ...extra,
});

test("workbook: perusahaan per sheet, kunci unik, kolom dicari dari nama", () => {
  const result = parseProspectWorkbook(book());
  assert.deepEqual(result.missingSheets, []);
  assert.equal(result.prospects.length, 3);
  const [one, two, old] = result.prospects;
  assert.equal(one.status, "active"); assert.equal(two.status, "predicted"); assert.equal(old.status, "older");
  assert.notEqual(one.importKey, old.importKey);
  assert.deepEqual(one.openings["2026"], { months: [5, 6], label: "Mei–Juni", dates: "8 Mei" });
  assert.deepEqual(old.openings["2024"].months, [3]);
  assert.equal(one.totalOpenings, 4);
  assert.deepEqual(one.usualMonths, [5]);
});

test("workbook: kontak ikut Status MT, baris riset dicocokkan lewat isi kurung / nama longgar", () => {
  const result = parseProspectWorkbook(book());
  const [one, , old] = result.prospects;
  assert.equal(result.contacts.find((c) => c.name === "Ani").importKey, old.importKey);
  assert.equal(result.contacts.find((c) => c.name === "Bayu").importKey, one.importKey);
  assert.equal(result.research.length, 1);
  assert.equal(result.research[0].importKey, one.importKey);
  assert.deepEqual(result.unmatched.map((u) => u.label), ["Tidak Ada · MT"]);
});

test("workbook: sheet perusahaan hilang dilaporkan", () => {
  const sheets = book(); delete sheets["Pernah Buka (2025)"];
  assert.deepEqual(parseProspectWorkbook(sheets).missingSheets, ["pernah buka"]);
});

const row = (id, brand, status, openings, industry = "FMCG") => ({ id, brand, legal_name: `PT ${brand}`, status, industry, program: "MT", active_years: "", total_openings: null, usual_months: [], openings, prediction: null, notes: "", exclusion_reason: "", source: "import" });
const m = (...months) => ({ months, label: months.join(","), dates: "" });
const rows = [
  row("a", "alpha", "active", { 2026: m(10), 2025: m(11) }),
  row("b", "Bravo", "active", { 2026: m(11), 2024: m(12) }, "Banking"),
  row("c", "Charlie", "predicted", { 2025: m(11, 12) }, "Banking"),
  row("d", "Delta", "older", { 2024: m(11) }),
  row("e", "Echo", "excluded", { 2026: m(11) }),
];

test("urutan nama tidak peduli huruf besar/kecil", () => {
  assert.deepEqual(sortByName([row("1", "ASTRO", "active", {}), row("2", "Adidas", "active", {}), row("3", "aia", "active", {})]).map(displayName), ["Adidas", "aia", "ASTRO"]);
});

test("grafik per bulan dan per industri", () => {
  assert.equal(monthCounts(rows, 2026)[10], 2); // Nov 2026: Bravo + Echo
  assert.deepEqual(industryCounts(rows, 2026, 2026), [["Banking", 1], ["FMCG", 1]]); // active this year count; excluded left out; ties A–Z
  assert.deepEqual(yearsOf(rows, 2026), [2026, 2025, 2024]);
});

test("perkiraan 2 bulan: terjadwal dulu, lalu pola tahun lalu; yang sedang buka / lama / dikeluarkan tidak ikut", () => {
  const nov = expectedIn(rows, new Date(2026, 9, 24), 1);
  assert.equal(nov.month, 11); assert.equal(nov.year, 2026);
  assert.deepEqual(nov.items.map((item) => [item.row.id, item.scheduled]), [["b", true], ["c", false]]);
  const jan = expectedIn(rows, new Date(2026, 10, 24), 2);
  assert.equal(jan.month, 1); assert.equal(jan.year, 2027);
});

test("kalender: terjadwal tahun ini vs biasanya buka", () => {
  const nov = calendarMonth(rows, 2026, 11);
  assert.deepEqual(nov.scheduled.map((r) => r.id), ["b"]);
  assert.deepEqual(nov.usual.map((r) => r.id), ["a", "c"]);
});

test("label dan teks kecil", () => {
  assert.equal(latestOpening(rows[0]), "10 2026");
  assert.equal(activeYearsLabel("3 dari 3"), "3 of 3 years");
  assert.ok(matchesQuery(prospectSearchText(rows[1]), "bravo bank"));
  assert.equal(isPerson({ name: "(Email rekrutmen umum)" }), false);
  assert.equal(linkHref("hrd@contoh.test"), "mailto:hrd@contoh.test");
  assert.equal(linkHref("id.linkedin.com/in/x"), "https://id.linkedin.com/in/x");
  assert.ok(isMissing("TIDAK KETEMU")); assert.ok(isMissing("Belum disebut di poster")); assert.ok(!isMissing("Min 3.00"));
  assert.deepEqual(splitSteps("CV > Psikotes > Interview"), ["CV", "Psikotes", "Interview"]);
});
