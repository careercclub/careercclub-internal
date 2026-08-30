import assert from "node:assert/strict";
import test from "node:test";
import {
  detectHeaderRow,
  mapTalentPoolRow,
  mapTalentPoolRowByPosition,
  matchesKnownLayout,
  normalizeHeaderKey,
  talentPoolColumns,
} from "./talent-pool-layout.ts";

// Verbatim header row of the August 2026 "Mastersheets Customer Database (CRM) -
// Database Talent Pool" export. Array index = sheet column (0-based).
const SHEET_HEADERS = [
  "Timestamp",
  "Nomor Whatsapp Aktif",
  "Email Address",
  "Nama Lengkap",
  "Status kamu apa nih sekarang?",
  "Remarks",
  "Kamu tau CCC darimana?",
  "Topik apa yang paling ingin kamu dapatkan dari CCC?",
  "By checking this box, I agree that the information I provide will be securely stored by Career Chaser's Club as part of its Talent Network Community.",
  "Domisili kamu saat ini",
  "Willing to relocate all around Indonesia?",
  "Pendidikan terakhir kamu/saat ini!",
  "Asal Universitas",
  "Campus Tier",
  "IPK terakhir kamu",
  "Fakultas",
  "Angkatan",
  "Tahun lulus/perkiraan kamu lulus",
  "Punya pengalaman organisasi/kepanitiaan?",
  "Punya pengalaman exchange/study abroad?",
  "MT di perusahaan apa nih yang paling kamu minati?",
  "Posisi Management Trainee (MT) yang kamu inginkan?",
  "Drop LinkedIn kamu disini",
  "Apakah kamu sudah pernah membeli produk CCC?",
  "Produk CCC mana nih yang pernah kamu beli?",
  "Seberapa puas kamu dengan produk/layanan yang diberikan CCC?",
  "Apakah produk/layanan yang diberikan CCC ngebantu kamu untuk proses seleksi MT?",
  "Seberapa besar kemungkinan kamu merekomendasikan CCC ke teman atau rekan kamu?",
  "Feedback untuk layanan/produk CCC",
  "Kode voucher khusus untuk kamu!",
  "Email Aktif",
];

// The export's real first row: a bare record count sitting above the header.
const BANNER_ROW = ["", "", "", "521", ...Array(27).fill("")];

// A real respondent row. Columns 5, 8 and 23 are the unmapped Remarks / consent /
// "pernah membeli" columns and carry SPACER markers so an off-by-one fails loudly.
const RESPONDENT = [
  "5/14/2026 1:28:09",
  "6283854582966",
  "salmanabdansyakuran@gmail.com",
  "Salman Abdan Syakuran",
  "Aktif berkuliah",
  "SPACER-5",
  "Registrasi Webinar FREE Class Series",
  "Life as MT (Marketing, Finance, Operations, dll.)",
  "SPACER-8",
  "Bandung",
  "Yes, absolutely!",
  "S1",
  "Universitas Pendidikan Indonesia",
  "X/Non Priority",
  "3.57",
  "FPEB",
  "2024",
  "2028",
  "Yes, as a leader/co-leader",
  "Yes, I have participated in an exchange or study abroad program",
  "FMCG, Finance",
  "MT Finance, MT Operations",
  "https://linkedin.com/in/salman",
  "SPACER-23",
  "CCA Batch 2",
  "5",
  "Sangat membantu",
  "9",
  "Materinya aplikatif",
  "CCCAUG26",
  "salman.aktif@gmail.com",
];

const keysOf = (row) => row.map(normalizeHeaderKey);
const at = (row) => (index) => row[index] ?? "";

test("detects the header row below a banner row", () => {
  assert.equal(detectHeaderRow([BANNER_ROW, SHEET_HEADERS, RESPONDENT].map(keysOf)), 1);
});

test("detects the header row when it is row 1", () => {
  assert.equal(detectHeaderRow([SHEET_HEADERS, RESPONDENT].map(keysOf)), 0);
});

test("reports no header row for an unrecognized sheet", () => {
  assert.equal(detectHeaderRow([["a", "b", "c"], ["1", "2", "3"]]), -1);
  assert.equal(matchesKnownLayout(["a", "b", "c"]), false);
});

// The regression this guards: with headers on row 1, "Email Address" alias-matches,
// which used to suppress the positional fallback and silently blank out every field
// whose header is a full survey question (sumber, topik_minat, nps, ...).
test("maps every field whether or not a banner row is present", () => {
  const expected = {
    timestamp: "5/14/2026 1:28:09",
    wa: "6283854582966",
    email: "salmanabdansyakuran@gmail.com",
    nama: "Salman Abdan Syakuran",
    status: "Aktif berkuliah",
    sumber: "Registrasi Webinar FREE Class Series",
    topik_minat: "Life as MT (Marketing, Finance, Operations, dll.)",
    domisili: "Bandung",
    relocate: "Yes, absolutely!",
    pendidikan: "S1",
    universitas: "Universitas Pendidikan Indonesia",
    campus_tier: "X/Non Priority",
    ipk: "3.57",
    fakultas: "FPEB",
    angkatan: "2024",
    tahun_lulus: "2028",
    organisasi: "Yes, as a leader/co-leader",
    exchange: "Yes, I have participated in an exchange or study abroad program",
    target_mt: "FMCG, Finance",
    posisi_mt: "MT Finance, MT Operations",
    linkedin: "https://linkedin.com/in/salman",
    produk_dibeli: "CCA Batch 2",
    kepuasan: "5",
    membantu: "Sangat membantu",
    nps: "9",
    feedback: "Materinya aplikatif",
    kode_voucher: "CCCAUG26",
    pipeline: "",
  };
  assert.deepEqual(mapTalentPoolRow(keysOf(SHEET_HEADERS), at(RESPONDENT), RESPONDENT.length), expected);
});

test("no unmapped spacer column leaks into a mapped field", () => {
  const mapped = mapTalentPoolRow(keysOf(SHEET_HEADERS), at(RESPONDENT), RESPONDENT.length);
  for (const [field, value] of Object.entries(mapped)) {
    assert.ok(!String(value).startsWith("SPACER-"), `${field} read an unmapped spacer column`);
  }
});

// Legacy last resort: an unrecognized wide row still maps positionally.
test("falls back to positional mapping when no header is recognized", () => {
  const mapped = mapTalentPoolRow([], at(RESPONDENT), RESPONDENT.length);
  assert.equal(mapped.nama, "Salman Abdan Syakuran");
  assert.equal(mapped.sumber, "Registrasi Webinar FREE Class Series");
  assert.equal(mapped.kode_voucher, "CCCAUG26");
});

test("a narrow unrecognized row maps nothing rather than guessing", () => {
  const mapped = mapTalentPoolRow([], at(["a@b.com", "x"]), 2);
  assert.equal(mapped.nama, "");
  assert.equal(mapped.sumber, "");
});

// Legacy main maps produk_dibeli and kepuasan from the same column; that bug must
// not get copied over here.
test("no two fields read the same column", () => {
  const indices = Object.values(talentPoolColumns);
  assert.equal(new Set(indices).size, indices.length, "duplicate column index in talentPoolColumns");
});

test("a truncated row yields empty strings, not undefined", () => {
  const mapped = mapTalentPoolRowByPosition(at(RESPONDENT.slice(0, 8)));
  assert.equal(mapped.nama, "Salman Abdan Syakuran");
  assert.equal(mapped.kode_voucher, "");
  assert.ok(Object.values(mapped).every((value) => typeof value === "string"));
});
