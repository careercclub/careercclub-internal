import assert from "node:assert/strict";
import test from "node:test";
import { crmAliases, mapCrmRow, normalizeCrmDate, normalizeWa, parseBuyerNotes, parsePrice } from "./crm-rows.ts";

// Verbatim header row of the lynk.id order export ("myorder.xlsx").
const HEADERS = [
  "Judul Barang", "Varian", "Harga", "qty", "sub total", "Voucher", "shipping fee",
  "Total Addon", "Notif fee", "Affiliate fee", "Affiliator email", "Public Affiliate fee",
  "Convenience Fee", "Total", "Tanggal", "Status", "Buyer Email", "Buyer Name (opsional)",
  "Buyer Phone (Opsional)", "Notes (Opsional)", "Addon Detail", "Voucher Code",
  "Shipping Address", "Shipping Method", "Appointment info", "Ref", "PayPal Ref",
];

// A real SUCCESS row from that export.
const ORDER_ROW = [
  "Career Chaser's Academy | PREMIUM", "", "650000", "1", "650000", "0", "0",
  "0", "0", "0", "", "0",
  "0", "650000", "01-07-2026 10:24", "SUCCESS", "zahrahmahfuzah22@gmail.com", "Zahrah  Mahfuzah",
  "08119303153", '{"Kamu tau kita dari mana?": "Instagram Post", "Kamu sedang berada di tahap mana saat ini?": "Baru lulus / fresh graduate", "Kamu tertarik di bidang industri apa aja? (FMCG, Finance, Mining, dll)": "FMCG, Finance"}', "", "",
  "", "", "", "a4ad88e6ddaff520e60f5c319233c0", "",
];

const rowMap = (values) => new Map(HEADERS.map((header, index) => [header.toLowerCase(), values[index] ?? ""]));

test("maps a lynk.id order row onto CRM buyer fields", () => {
  assert.deepEqual(mapCrmRow(rowMap(ORDER_ROW)), {
    status: "SUCCESS",
    name: "Zahrah  Mahfuzah",
    wa: "628119303153",
    email: "zahrahmahfuzah22@gmail.com",
    product: "Career Chaser's Academy | PREMIUM",
    price: 650000,
    notes: ORDER_ROW[19],
    date: "2026-07-01",
  });
});

// The whole reason this file exists. lynk.id writes day-first; reading it
// month-first silently moves a July order to January and nothing errors.
test("parses lynk.id dates as day-first, not month-first", () => {
  assert.equal(normalizeCrmDate("01-07-2026 10:24"), "2026-07-01");
  assert.equal(normalizeCrmDate("31-07-2026 23:59"), "2026-07-31");
  assert.equal(normalizeCrmDate("05/03/2026"), "2026-03-05");
});

test("passes ISO dates through unchanged", () => {
  assert.equal(normalizeCrmDate("2026-07-01T10:24:00.000Z"), "2026-07-01");
});

test("returns null for an unparseable or empty date", () => {
  assert.equal(normalizeCrmDate(""), null);
  assert.equal(normalizeCrmDate("   "), null);
  assert.equal(normalizeCrmDate("not a date"), null);
});

test("normalizes Indonesian phone numbers to 62 form", () => {
  assert.equal(normalizeWa("08119303153"), "628119303153");
  assert.equal(normalizeWa("+62 811-9303-153"), "628119303153");
  assert.equal(normalizeWa("8119303153"), "628119303153");
  assert.equal(normalizeWa(""), "");
});

// These three keys are the exact question text lynk.id stores; a wording change on
// the checkout form silently empties the columns rather than failing.
test("extracts sumber, tahap and industri from the Notes JSON", () => {
  assert.deepEqual(parseBuyerNotes(ORDER_ROW[19]), {
    sumber: "Instagram Post",
    tahap: "Baru lulus / fresh graduate",
    industri: "FMCG, Finance",
  });
});

test("survives Notes that are empty, blank-quoted or not JSON", () => {
  const empty = { sumber: "", tahap: "", industri: "" };
  assert.deepEqual(parseBuyerNotes(""), empty);
  assert.deepEqual(parseBuyerNotes('""'), empty);
  assert.deepEqual(parseBuyerNotes("just a note"), empty);
  assert.deepEqual(parseBuyerNotes("{broken json"), empty);
});

test("skips a row with no product, email or phone", () => {
  assert.equal(mapCrmRow(rowMap(Array(HEADERS.length).fill(""))), null);
});

test("reads price as a number even with currency formatting", () => {
  const row = [...ORDER_ROW];
  row[2] = "Rp 1.250.000";
  row[13] = "";
  row[4] = "";
  assert.equal(mapCrmRow(rowMap(row)).price, 1250000);
});

// Recent lynk.id exports zero out "Harga" and carry the amount in Total. Reading
// Harga there books every sale at 0, which then mislabels repeat buyers as downsells.
test("prefers Total over a zeroed Harga column", () => {
  const row = [...ORDER_ROW];
  row[2] = "0";        // Harga
  row[4] = "257500";   // sub total
  row[13] = "256900";  // Total
  assert.equal(mapCrmRow(rowMap(row)).price, 256900);
});

test("falls back to sub total, then Harga, when Total is absent", () => {
  const noTotal = [...ORDER_ROW];
  noTotal[13] = "";
  noTotal[4] = "257500";
  assert.equal(mapCrmRow(rowMap(noTotal)).price, 257500);

  const onlyHarga = [...ORDER_ROW];
  onlyHarga[13] = "";
  onlyHarga[4] = "";
  onlyHarga[2] = "650000";
  assert.equal(mapCrmRow(rowMap(onlyHarga)).price, 650000);
});

// A zero here is not cosmetic: importCrmTransactions compares price against the
// previous one to label a repeat purchase Upsell / Downsell / Cross sell.
test("parses both thousand-separator conventions without zeroing", () => {
  assert.equal(parsePrice("650000"), 650000);
  assert.equal(parsePrice("Rp 1.250.000"), 1250000);
  assert.equal(parsePrice("1,250,000"), 1250000);
  assert.equal(parsePrice("10.50"), 10.5);
  assert.equal(parsePrice("10,50"), 10.5);
  assert.equal(parsePrice("1.234,56"), 1234.56);
  assert.equal(parsePrice("1,234.56"), 1234.56);
  assert.equal(parsePrice(""), 0);
  assert.equal(parsePrice("gratis"), 0);
});

test("every alias is lowercase so header lookup matches", () => {
  for (const [field, names] of Object.entries(crmAliases)) {
    for (const name of names) assert.equal(name, name.toLowerCase(), `${field} alias "${name}" is not lowercase`);
  }
});
