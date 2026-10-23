// Functional import tests: real route handlers (auth stubbed) → real Postgres.
// Usage: IMPORT_TEST_DATABASE_URL=postgres://…/ccc_import_test npm run test:imports
// The database is TRUNCATED: the script refuses any database whose name lacks "test".
import { createRequire } from "node:module";
const require = createRequire(new URL("../../package.json", import.meta.url));
const ExcelJS = require("exceljs");
const postgres = require("postgres");
const OUT = new URL("./out/", import.meta.url).pathname;
const url = process.env.IMPORT_TEST_DATABASE_URL || "";
if (!/test/i.test(new URL(url || "postgres://x/none").pathname)) { console.error("Set IMPORT_TEST_DATABASE_URL to a throwaway database whose name contains \"test\" — its tables are truncated."); process.exit(2); }
process.env.DATABASE_URL = url; // the bundled routes connect through lib/db/postgres
const sql = postgres(url, { max: 2, onnotice: () => {} });
const fresh = process.argv.includes("--fresh");
if (fresh) await sql.unsafe((await import("node:fs")).readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
const filter = process.argv.slice(2).find((arg) => !arg.startsWith("--")) || "";
let pass = 0, fail = 0; const results = [];
const ok = (c, m, extra = "") => { results.push(`${c ? "PASS" : "FAIL"} ${m}${!c && extra ? `  → ${extra}` : ""}`); c ? pass++ : fail++; };

// ---------- helpers ----------
const routes = {};
async function route(name) { routes[name] ||= await import(`${OUT}${name}.mjs`); return routes[name]; }
let sheetResponse = null; const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://docs.google.com/")) { globalThis.__lastSheetUrl = String(url); return sheetResponse ? new Response(sheetResponse.body, { status: sheetResponse.status || 200 }) : new Response("not found", { status: 404 }); }
  return realFetch(url, init);
};
async function post(name, fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const item of [].concat(v)) fd.append(k, item.buffer ? new File([item.buffer], item.name) : item);
  }
  const { POST } = await route(name);
  const res = await POST(new Request("http://app.test/api/x", { method: "POST", body: fd }));
  let json = null; try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}
const csv = (rows, { sep = ",", bom = false, eol = "\r\n" } = {}) => {
  const q = (v) => { const s = String(v ?? ""); return new RegExp(`[${sep}"\\n\\r]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return Buffer.from((bom ? "﻿" : "") + rows.map((r) => r.map(q).join(sep)).join(eol) + eol, "utf8");
};
async function xlsx(rows, { dates = [] } = {}) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Sheet1");
  rows.forEach((r) => ws.addRow(r.map((v) => v)));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const file = (name, buffer) => ({ name, buffer });
const reset = (...tables) => sql.unsafe(`truncate ${tables.join(", ")} restart identity cascade`);
async function test(name, fn) {
  if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;
  try { await fn(); } catch (error) { ok(false, `${name}: threw`, String(error?.message || error).slice(0, 220)); }
}

// ---------- fixtures ----------
const TP_HEADERS = ["Timestamp", "Nomor Whatsapp Aktif", "Email Address", "Nama Lengkap", "Status kamu apa nih sekarang?", "Remarks", "Kamu tau CCC darimana?", "Topik apa yang paling ingin kamu dapatkan dari CCC?", "By checking this box, I agree that the information I provide will be securely stored by Career Chaser's Club as part of its Talent Network Community.", "Domisili kamu saat ini", "Willing to relocate all around Indonesia?", "Pendidikan terakhir kamu/saat ini!", "Asal Universitas", "Campus Tier", "IPK terakhir kamu", "Fakultas", "Angkatan", "Tahun lulus/perkiraan kamu lulus", "Punya pengalaman organisasi/kepanitiaan?", "Punya pengalaman exchange/study abroad?", "MT di perusahaan apa nih yang paling kamu minati?", "Posisi Management Trainee (MT) yang kamu inginkan?", "Drop LinkedIn kamu disini", "Apakah kamu sudah pernah membeli produk CCC?", "Produk CCC mana nih yang pernah kamu beli?", "Seberapa puas kamu dengan produk/layanan yang diberikan CCC?", "Apakah produk/layanan yang diberikan CCC ngebantu kamu untuk proses seleksi MT?", "Seberapa besar kemungkinan kamu merekomendasikan CCC ke teman atau rekan kamu?", "Feedback untuk layanan/produk CCC", "Kode voucher khusus untuk kamu!", "Email Aktif"];
const tpRow = (i) => [`5/${10 + (i % 18)}/2026 1:28:09`, `0812000${String(1000 + i)}`, `peserta${i}@example.com`, `Peserta ${i}`, "Aktif berkuliah", "", "Instagram", "Life as MT, Finance", "Yes", "Bandung", "Yes, absolutely!", "S1", "Universitas Contoh", "X/Non Priority", "3.5", "FEB", "2023", "2027", "Yes", "No", "FMCG, Finance", "MT Finance", `https://linkedin.com/in/peserta-${i}`, "Yes", i % 3 ? "" : "CCA Batch 2", "5", "Sangat membantu", "9", "Mantap", "CCC10", `aktif${i}@example.com`];
const banner = (n) => ["", "", "", String(n), ...Array(TP_HEADERS.length - 4).fill("")];
const tpRows = (n) => Array.from({ length: n }, (_, i) => tpRow(i));

const LYNK_HEADERS = ["Judul Barang", "Varian", "Harga", "qty", "sub total", "Voucher", "shipping fee", "Total Addon", "Notif fee", "Affiliate fee", "Affiliator email", "Public Affiliate fee", "Convenience Fee", "Total", "Tanggal", "Status", "Buyer Email", "Buyer Name (opsional)", "Buyer Phone (Opsional)", "Notes (Opsional)", "Addon Detail", "Voucher Code", "Shipping Address", "Shipping Method", "Appointment info", "Ref", "PayPal Ref"];
const lynk = (product, total, date, status, email, name, phone, notes = "") => [product, "", "0", "1", String(total), "0", "0", "0", "0", "0", "", "0", "0", String(total), date, status, email, name, phone, notes, "", "", "", "", "", "ref", ""];
const NOTES = JSON.stringify({ "Kamu tau kita dari mana?": "Instagram Post", "Kamu sedang berada di tahap mana saat ini?": "Baru lulus / fresh graduate", "Kamu tertarik di bidang industri apa aja? (FMCG, Finance, Mining, dll)": "FMCG" });

const META_HEADERS = ["Post ID", "Account ID", "Account username", "Account name", "Description", "Duration (sec)", "Publish time", "Permalink", "Post type", "Data comment", "Date", "Views", "Reach", "Likes", "Shares", "Follows", "Comments", "Saves"];
const metaRow = (i, extra = {}) => [String(18034567890123400n + BigInt(i)), "1784", "careercclub", "Career Chaser's Club", `Konten ke-${i} tentang MT, interview, CV`, i % 2 ? "32" : "0", `06/${String(10 + i).padStart(2, "0")}/2026 19:00`, `https://www.instagram.com/p/POST${i}/`, i % 2 ? "IG reel" : "IG carousel", "", "Lifetime", extra.views ?? String(1000 * (i + 1)), String(800 * (i + 1)), "50", "5", "3", "4", "12"];

// ---------- Talent Pool ----------
await test("talent: xlsx intake export with banner row", async () => {
  await reset("talent_pool");
  const r = await post("talent-pool", { file: file("talent.xlsx", await xlsx([banner(5), TP_HEADERS, ...tpRows(5)])) });
  const rows = await sql`select * from talent_pool order by email`;
  ok(r.status === 200 && r.json?.imported === 5 && rows.length === 5, "talent xlsx: 5 imported", JSON.stringify(r));
  const p = rows.find((x) => x.email === "peserta0@example.com");
  ok(p && p.nama === "Peserta 0" && p.sumber === "Instagram" && p.nps === "9" && p.produk_dibeli === "CCA Batch 2" && p.universitas === "Universitas Contoh", "talent xlsx: fields land in the right columns", JSON.stringify(p && { nama: p.nama, sumber: p.sumber, nps: p.nps, produk: p.produk_dibeli, univ: p.universitas }));
  ok(p && p.wa === "08120001000", "talent xlsx: WhatsApp kept as text (leading 0 intact)", p?.wa);
});
await test("talent: re-import updates, no duplicates; email case-insensitive", async () => {
  const rows = tpRows(5); rows[0][2] = "PESERTA0@Example.com"; rows[0][3] = "Peserta Nol";
  const r = await post("talent-pool", { file: file("talent.xlsx", await xlsx([banner(5), TP_HEADERS, ...rows])) });
  const n = (await sql`select count(*)::int c from talent_pool`)[0].c;
  const p = (await sql`select nama from talent_pool where email = 'peserta0@example.com'`)[0];
  ok(r.status === 200 && n === 5 && p?.nama === "Peserta Nol", "talent re-import: 5 rows, name updated", `${n} rows, ${p?.nama}`);
});
await test("talent: CSV exported from Google Sheets (UTF-8, banner)", async () => {
  await reset("talent_pool");
  const r = await post("talent-pool", { file: file("talent.csv", csv([banner(4), TP_HEADERS, ...tpRows(4)])) });
  ok(r.status === 200 && r.json?.imported === 4, "talent csv: 4 imported", JSON.stringify(r));
  const p = (await sql`select wa, ipk, kode_voucher, angkatan from talent_pool where email = 'peserta1@example.com'`)[0];
  ok(p && p.wa === "08120001001" && p.ipk === "3.5" && p.angkatan === "2023", "talent csv: WhatsApp keeps its leading 0, numbers stay as typed", JSON.stringify(p));
});
await test("talent: CSV with BOM (saved from Excel as CSV UTF-8)", async () => {
  await reset("talent_pool");
  const r = await post("talent-pool", { file: file("talent.csv", csv([TP_HEADERS, ...tpRows(3)], { bom: true })) });
  ok(r.status === 200 && r.json?.imported === 3, "talent csv+BOM: 3 imported", JSON.stringify(r));
});
await test("talent: CSV with semicolons (Excel, Indonesian region)", async () => {
  await reset("talent_pool");
  const r = await post("talent-pool", { file: file("talent.csv", csv([TP_HEADERS, ...tpRows(3)], { sep: ";" })) });
  ok(r.status === 200 && r.json?.imported === 3, "talent csv ';': 3 imported", JSON.stringify(r));
});
await test("talent: published Google Sheet link, header below banner + blank rows", async () => {
  await reset("talent_pool");
  const blank = Array(TP_HEADERS.length).fill("");
  sheetResponse = { body: csv([banner(6), blank, blank, blank, blank, blank, TP_HEADERS, ...tpRows(6)]).toString("utf8") };
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?gid=156606020&single=true&output=csv";
  const r = await post("talent-pool", { url });
  ok(r.status === 200 && r.json?.imported === 6, "talent sheet link: 6 imported", JSON.stringify(r));
  ok(globalThis.__lastSheetUrl?.includes("output=csv") && globalThis.__lastSheetUrl.includes("gid=156606020"), "talent sheet link: fetched the published CSV of that tab", globalThis.__lastSheetUrl);
});
await test("talent: normal sheet edit link (not published)", async () => {
  await reset("talent_pool");
  sheetResponse = { body: csv([TP_HEADERS, ...tpRows(2)]).toString("utf8") };
  const r = await post("talent-pool", { url: "https://docs.google.com/spreadsheets/d/1AbCdEfGh/edit#gid=42" });
  ok(r.status === 200 && r.json?.imported === 2 && /\/export\?format=csv&gid=42/.test(globalThis.__lastSheetUrl), "talent edit link: converted to export URL", `${globalThis.__lastSheetUrl} ${JSON.stringify(r)}`);
});
await test("talent: sheet not published / private (Google returns an HTML login page)", async () => {
  sheetResponse = { body: "<!DOCTYPE html><html><head><title>Google Sheets - Sign in</title></head><body>Sign in</body></html>" };
  const r = await post("talent-pool", { url: "https://docs.google.com/spreadsheets/d/1AbCdEfGh/edit#gid=0" });
  ok(r.status === 400 && /publish|public|sign in|access/i.test(r.json?.error || ""), "talent private sheet: says it needs publishing/access", JSON.stringify(r).slice(0, 300));
});
await test("talent: lynk.id order file uploaded by mistake", async () => {
  const r = await post("talent-pool", { file: file("myorder.xlsx", await xlsx([LYNK_HEADERS, lynk("CCA", 650000, "01-07-2026 10:24", "SUCCESS", "a@example.com", "A", "0812")])) });
  ok(r.status === 400 && /CRM/.test(r.json?.error || ""), "talent wrong file: points to CRM import", JSON.stringify(r).slice(0, 200));
});

// ---------- CRM (lynk.id) ----------
const orders = [
  lynk("Career Chaser's Academy | PREMIUM", 650000, "01-07-2026 10:24", "SUCCESS", "dewi@example.com", "Dewi", "081200000001", NOTES),
  lynk("CV Review Express", 99000, "15-07-2026 08:00", "SUCCESS", "budi@example.com", "Budi", "+62 812-0000-0002"),
  lynk("Interview Bootcamp", 250000, "31-07-2026 21:15", "SUCCESS", "sari@example.com", "Sari", "6281200000003"),
  lynk("Interview Bootcamp", 250000, "31-07-2026 21:20", "PENDING", "tono@example.com", "Tono", "081200000004"),
];
await test("crm: myorder.xlsx, new buyers", async () => {
  await reset("buyers", "master_produk");
  const r = await post("crm", { file: file("myorder.xlsx", await xlsx([LYNK_HEADERS, ...orders])), mode: "new" });
  const rows = await sql`select * from buyers order by name`;
  ok(r.status === 200 && r.json?.added === 3 && r.json?.skipped === 1 && rows.length === 3, "crm new: 3 added, PENDING skipped", JSON.stringify(r));
  const d = rows.find((x) => x.name === "Dewi");
  ok(d && Number(d.harga) === 650000 && String(d.tanggal?.toISOString?.() || d.tanggal).startsWith("2026-07-01") && d.status === "Belum diblast" && d.payment_status === "SUCCESS", "crm new: price, date (day-first), status", JSON.stringify(d && { harga: d.harga, tanggal: d.tanggal, status: d.status }));
  ok(d && d.sumber === "Instagram Post" && d.tahap && d.industri === "FMCG", "crm new: checkout notes parsed (source, stage, industry)", JSON.stringify(d && { sumber: d.sumber, tahap: d.tahap, industri: d.industri }));
  const ds = rows.map((x) => String(x.tanggal?.toISOString?.() || x.tanggal).slice(0, 10)).sort();
  ok(ds.join(",") === "2026-07-01,2026-07-15,2026-07-31", "crm new: every date day-first (31-07 accepted)", ds.join(","));
});
await test("crm: same file again in 'new' mode → nothing duplicated", async () => {
  const r = await post("crm", { file: file("myorder.xlsx", await xlsx([LYNK_HEADERS, ...orders])), mode: "new" });
  const n = (await sql`select count(*)::int c from buyers`)[0].c;
  ok(r.status === 200 && r.json?.added === 0 && n === 3, "crm re-import: 0 added, still 3", JSON.stringify(r));
});
await test("crm: results mode (repeat purchase) → upsell recorded", async () => {
  const r = await post("crm", { file: file("myorder.xlsx", await xlsx([LYNK_HEADERS, lynk("Career Chaser's Academy | PREMIUM", 650000, "05-08-2026 09:00", "SUCCESS", "budi@example.com", "Budi", "0812-0000-0002")])), mode: "results" });
  const b = (await sql`select * from buyers where name = 'Budi'`)[0];
  ok(r.status === 200 && r.json?.updated === 1 && /Upsell/.test(b?.status || "") && Array.isArray(b?.riwayat) && b.riwayat.length === 2, "crm results: matched by WA in another format, Upsell, history appended", JSON.stringify({ r: r.json, status: b?.status, hist: b?.riwayat?.length }));
});
await test("crm: lynk CSV export with BOM", async () => {
  await reset("buyers", "master_produk");
  const r = await post("crm", { file: file("myorder.csv", csv([LYNK_HEADERS, ...orders], { bom: true })), mode: "new" });
  ok(r.status === 200 && r.json?.added === 3, "crm csv+BOM: 3 added", JSON.stringify(r));
});
await test("crm: xlsx where Tanggal is a real Excel date cell", async () => {
  await reset("buyers", "master_produk");
  const rows = orders.slice(0, 1).map((r) => { const c = [...r]; c[14] = new Date(Date.UTC(2026, 6, 31, 3, 24)); c[18] = 6281200000001; c[13] = 650000; return c; });
  const r = await post("crm", { file: file("myorder.xlsx", await xlsx([LYNK_HEADERS, ...rows])), mode: "new" });
  const d = (await sql`select tanggal, wa, harga from buyers`)[0];
  ok(r.status === 200 && r.json?.added === 1 && String(d?.tanggal?.toISOString?.() || d?.tanggal).startsWith("2026-07-31") && Number(d?.harga) === 650000, "crm date cell: date and numeric price/phone read", JSON.stringify({ r: r.json, d }));
});

// ---------- Content Evaluation (Meta Business Suite) ----------
await test("content eval: Meta CSV (with BOM, as Meta exports it)", async () => {
  await reset("content_evaluations");
  const r = await post("content-evaluation", { file: file("meta.csv", csv([META_HEADERS, ...Array.from({ length: 4 }, (_, i) => metaRow(i))], { bom: true })) });
  ok(r.status === 200 && r.json?.inserted === 4, "content eval csv+BOM: 4 inserted", JSON.stringify(r));
});
await test("content eval: Meta CSV without BOM, dates and formats", async () => {
  await reset("content_evaluations");
  const r = await post("content-evaluation", { file: file("meta.csv", csv([META_HEADERS, ...Array.from({ length: 4 }, (_, i) => metaRow(i, i === 3 ? { views: "12,345" } : {}))])) });
  const rows = await sql`select post_id, format, tanggal, views, judul, duration from content_evaluations order by post_id`;
  ok(r.status === 200 && r.json?.inserted === 4, "content eval csv: 4 inserted", JSON.stringify(r));
  ok(rows[0] && String(rows[0].tanggal?.toISOString?.() || rows[0].tanggal).startsWith("2026-06-10") && rows[1]?.format === "Reel" && rows[0]?.format === "Carousel", "content eval csv: publish date (month first) and Reel/Carousel", JSON.stringify(rows.slice(0, 2)));
  ok(Number(rows[3]?.views) === 12345, "content eval csv: '12,345' read as 12345", rows[3]?.views);
  ok(rows[0]?.post_id === "18034567890123400", "content eval csv: long Post ID kept exactly", rows[0]?.post_id);
});
await test("content eval: re-import updates, manual metrics kept", async () => {
  await sql`update content_evaluations set wtr = 42, action = 'Boost ke Meta Ads' where post_id = '18034567890123401'`;
  const r = await post("content-evaluation", { file: file("meta.csv", csv([META_HEADERS, ...Array.from({ length: 4 }, (_, i) => metaRow(i))])) });
  const row = (await sql`select wtr, action from content_evaluations where post_id = '18034567890123401'`)[0];
  const n = (await sql`select count(*)::int c from content_evaluations`)[0].c;
  ok(r.status === 200 && r.json?.updated === 4 && n === 4 && Number(row?.wtr) === 42 && row?.action === "Boost ke Meta Ads", "content eval re-import: 4 updated, WTR/action kept", JSON.stringify({ r: r.json, n, row }));
});
await test("content eval: Meta xlsx with Post ID as a number cell", async () => {
  await reset("content_evaluations");
  const rows = Array.from({ length: 2 }, (_, i) => { const r = metaRow(i); r[0] = 18123456789012345 + i; return r; });
  const r = await post("content-evaluation", { file: file("meta.xlsx", await xlsx([META_HEADERS, ...rows])) });
  const ids = (await sql`select post_id from content_evaluations order by post_id`).map((x) => x.post_id);
  ok(r.status === 400 && /lost digits/.test(r.json?.error || "") && ids.length === 0, "content eval xlsx: Post IDs rounded by Excel → refused with a reason, nothing merged", JSON.stringify({ r: r.json, ids }));
  const rows2 = Array.from({ length: 2 }, (_, i) => metaRow(i));
  const r2 = await post("content-evaluation", { file: file("meta.xlsx", await xlsx([META_HEADERS, ...rows2])) });
  ok(r2.status === 200 && r2.json?.inserted === 2, "content eval xlsx: Post IDs as text → imported", JSON.stringify(r2));
});

// ---------- Instagram (Meta Insights daily CSVs) ----------
const insights = (metric, days, { utf16 = true, quoted = false } = {}) => {
  const lines = ["sep=,", `"${metric}"`, '"Date","Primary"', ...days.map(([d, v]) => `"${d}T00:00:00","${quoted ? Number(v).toLocaleString("en-US") : v}"`)];
  const text = lines.join("\r\n") + "\r\n";
  return utf16 ? Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]) : Buffer.from(text, "utf8");
};
const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.UTC(2026, 8, 7 + i)); return d.toISOString().slice(0, 10); }); // Mon 7 Sep → Sun 20 Sep
await test("instagram: Meta Insights daily CSVs (UTF-16) → weekly snapshots", async () => {
  await reset("ig_snapshots");
  const r = await post("instagram", { files: [file("Views.csv", insights("Views", days.map((d) => [d, 1000]))), file("Reach.csv", insights("Reach", days.map((d) => [d, 500]))), file("Follows.csv", insights("Instagram follows", days.map((d) => [d, 3])))] });
  const rows = await sql`select week_start, views, reach, follows_gained from ig_snapshots order by week_start`;
  ok(r.status === 200 && rows.length === 2, "instagram: 14 days → 2 Monday weeks", JSON.stringify({ r: r.json, rows }));
  ok(rows[0] && String(rows[0].week_start.toISOString?.() || rows[0].week_start).startsWith("2026-09-07") && rows[0].views === 7000 && rows[0].reach === 3500 && rows[0].follows_gained === 21, "instagram: weekly sums (views 7000, reach 3500, follows 21)", JSON.stringify(rows[0]));
});
await test("instagram: daily CSV with thousands separators (\"1,234\")", async () => {
  await reset("ig_snapshots");
  const r = await post("instagram", { files: [file("Views.csv", insights("Views", days.slice(0, 7).map((d) => [d, 1234]), { quoted: true }))] });
  const row = (await sql`select views from ig_snapshots`)[0];
  ok(r.status === 200 && row?.views === 8638, "instagram: '1,234' summed as 1234×7 = 8638", JSON.stringify({ r: r.json, row }));
});
await test("instagram: re-import same week replaces, not duplicates", async () => {
  await reset("ig_snapshots");
  await post("instagram", { files: [file("Views.csv", insights("Views", days.slice(0, 7).map((d) => [d, 100]), { utf16: false }))] });
  const r = await post("instagram", { files: [file("Views.csv", insights("Views", days.slice(0, 7).map((d) => [d, 200]), { utf16: false }))] });
  const rows = await sql`select views from ig_snapshots`;
  ok(r.status === 200 && rows.length === 1 && rows[0].views === 1400, "instagram re-import: one row, latest value", JSON.stringify(rows));
});
await test("instagram: re-importing only Views keeps the week's Reach", async () => {
  await reset("ig_snapshots");
  await post("instagram", { files: [file("Views.csv", insights("Views", days.slice(0, 7).map((d) => [d, 100]))), file("Reach.csv", insights("Reach", days.slice(0, 7).map((d) => [d, 50])))] });
  await post("instagram", { files: [file("Views.csv", insights("Views", days.slice(0, 7).map((d) => [d, 110])))] });
  const row = (await sql`select views, reach from ig_snapshots`)[0];
  ok(row?.views === 770 && row?.reach === 350, "instagram partial re-import: Reach not wiped", JSON.stringify(row));
});
await test("instagram: normalized weekly CSV", async () => {
  await reset("ig_snapshots");
  const r = await post("instagram", { files: [file("weekly.csv", csv([["week_start", "followers_total", "follows_gained", "reach", "views", "interactions"], ["2026-09-07", "14800", "21", "3500", "7000", "420"], ["2026-09-14", "14821", "25", "3600", "7200", "450"]]))] });
  const rows = await sql`select week_start, followers_total, interactions from ig_snapshots order by week_start`;
  ok(r.status === 200 && rows.length === 2 && rows[1].followers_total === 14821 && rows[0].interactions === 420, "instagram weekly csv: 2 weeks", JSON.stringify({ r: r.json, rows }));
});

// ---------- MT vacancies ----------
const MT_HEADERS = ["Company", "Program", "Industry", "Roles", "Selection", "Career links", "Deadline", "Status", "GPA", "Education", "Majors", "Placement", "Duration", "Months", "Year", "Open date", "Notes"];
await test("mt vacancies: CSV import into the live schema (jsonb lists)", async () => {
  await reset("mt_vacancies");
  const r = await post("mt-vacancies", { file: file("mt.csv", csv([MT_HEADERS, ["Unilever", "UFLP", "FMCG", "MT Marketing; MT Supply Chain", "Online test; Interview", "https://careers.unilever.com", "2026-11-30", "Active", "3.0", "S1", "All majors", "Jakarta; Surabaya", "24 months", "3,9", "2026", "2026-09-01", ""], ["Bank Mandiri", "ODP", "Banking", "ODP", "Test", "", "", "Active", "3.0", "S1", "", "", "", "", "", "", ""]])) });
  const rows = await sql`select company, roles, months, selection, deadline, year from mt_vacancies order by company`;
  ok(r.status === 200 && r.json?.inserted === 2 && rows.length === 2, "mt csv: 2 inserted", JSON.stringify(r).slice(0, 300));
  const u = rows.find((x) => x.company === "Unilever");
  ok(u && JSON.stringify(u.roles) === '["MT Marketing","MT Supply Chain"]' && JSON.stringify(u.months) === '["3","9"]', "mt csv: lists stored as JSON arrays", JSON.stringify(u));
  ok(u && (u.selection === '["Online test","Interview"]' || JSON.stringify(u.selection) === '["Online test","Interview"]'), "mt csv: selection stored the way the app reads it", JSON.stringify(u?.selection));
  ok(String(u?.deadline?.toISOString?.() || u?.deadline).startsWith("2026-11-30") && u?.year === "2026", "mt csv: deadline and year", JSON.stringify({ d: u?.deadline, y: u?.year }));
});
await test("mt vacancies: deadline written 30/11/2026", async () => {
  await reset("mt_vacancies");
  const r = await post("mt-vacancies", { file: file("mt.csv", csv([MT_HEADERS, ["Astra", "AMDP", "Automotive", "MT", "", "", "30/11/2026", "Active", "", "", "", "", "", "", "2026", "", ""]])) });
  const row = (await sql`select deadline from mt_vacancies`)[0];
  ok(r.status === 200 && row && String(row.deadline?.toISOString?.() || row.deadline).startsWith("2026-11-30"), "mt csv: dd/mm/yyyy deadline understood", JSON.stringify({ r: r.json, row }));
});
await test("mt vacancies: re-import updates (same company+program+year)", async () => {
  await reset("mt_vacancies");
  const rows = [MT_HEADERS, ["Unilever", "UFLP", "FMCG", "MT Marketing", "", "", "", "Active", "", "", "", "", "", "", "2026", "", ""]];
  await post("mt-vacancies", { file: file("mt.csv", csv(rows)) });
  rows[1][7] = "Closed";
  const r = await post("mt-vacancies", { file: file("mt.csv", csv(rows)) });
  const all = await sql`select status from mt_vacancies`;
  ok(r.status === 200 && r.json?.updated === 1 && all.length === 1 && all[0].status === "Closed", "mt re-import: 1 updated", JSON.stringify({ r: r.json, all }));
});

await test("mt vacancies: Google Sheet path (server action) with dd/mm dates", async () => {
  await reset("mt_vacancies");
  const { importMtVacancies } = await import(`${OUT}mt-lib.mjs`);
  const r = await importMtVacancies([{ company: "Astra", program: "AMDP", industry: "Automotive", roles: ["MT"], months: [3], year: "2026", deadline: "30/11/2026", open_date: "01/09/2026" }, { company: "BCA", program: "PPA", industry: "Banking", roles: ["PPA"], months: [2], year: "2026", deadline: "soon", open_date: null }]);
  const rows = await sql`select company, deadline, open_date from mt_vacancies order by company`;
  ok(r.inserted === 2 && String(rows[0].deadline?.toISOString?.()).startsWith("2026-11-30") && String(rows[0].open_date?.toISOString?.()).startsWith("2026-09-01") && rows[1].deadline === null, "mt sheet path: dd/mm dates read, unreadable date left empty", JSON.stringify({ r, rows }));
});

// ---------- Free Class evaluation (Google Form) ----------
const FC_HEADERS = ["Timestamp", "Email Address", "Nama Lengkap", "Asal Universitas", "Angkatan", "Free Class yang kamu ikuti", "Materi yang disampaikan sesuai dengan judul", "Materi sesuai dengan kebutuhan saya", "Materi mudah untuk saya pahami", "Materi menjawab pertanyaan saya", "Narasumber menguasai materi", "Narasumber menyampaikan materi dengan jelas", "Kualitas teknis (audio/video) baik", "Waktu pelaksanaan sesuai", "Moderator membawakan acara dengan baik", "Informasi webinar jelas", "Saya puas dengan pelaksanaan webinar", "Saya berminat untuk mengikuti kelas berbayar", "Saya akan merekomendasikan", "Hal apa yang sudah baik?", "Apa yang bisa ditingkatkan?", "Topik apa yang ingin kamu pelajari?"];
const fcRow = (i, seri = "Free Class #12") => ["10/1/2026 20:00:00", `fc${i}@example.com`, `Peserta FC ${i}`, "UI", "2023", seri, "5", "4", "5", "4", "5", "5", "4", "5", "5", "4", "5", "3", "4", "Materinya jelas", "Durasi", "Case interview"];
await test("free class: Google Form CSV", async () => {
  await reset("free_class_eval");
  const r = await post("free-class", { file: file("fc.csv", csv([FC_HEADERS, fcRow(1), fcRow(2), fcRow(2), fcRow(3, "Free Class #13")])) });
  const rows = await sql`select email, seri, kepuasan, minat, topik_keinginan, hal_baik, ditingkatkan from free_class_eval order by email, seri`;
  ok(r.status === 200 && r.json?.imported === 3 && rows.length === 3, "free class csv: duplicates collapsed, 3 rows", JSON.stringify(r));
  const a = rows[0];
  ok(a && Number(a.kepuasan) === 5 && Number(a.minat) === 3 && a.topik_keinginan === "Case interview" && a.hal_baik === "Materinya jelas" && a.ditingkatkan === "Durasi", "free class csv: ratings and open answers in the right fields", JSON.stringify(a));
});
await test("free class: CSV with BOM", async () => {
  await reset("free_class_eval");
  const r = await post("free-class", { file: file("fc.csv", csv([FC_HEADERS, fcRow(1)], { bom: true })) });
  ok(r.status === 200 && r.json?.imported === 1, "free class csv+BOM: 1 imported", JSON.stringify(r));
});

console.log(results.join("\n"));
console.log(`\nfunctional imports: ${pass} pass, ${fail} fail`);
await sql.end();
process.exit(fail ? 1 : 0);
