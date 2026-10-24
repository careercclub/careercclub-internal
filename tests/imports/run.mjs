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

// ---------- Job Vacancy MT: the "CCC List MT" workbook ----------
const MT_MIGRATION = (await import("node:fs")).readFileSync(new URL("../../database/migrations/025_mt_prospects.sql", import.meta.url), "utf8").replace(/^\s*(begin|commit);\s*$/gm, ""); // the deploy runs it through psql; here it runs as one statement batch
const CO_HEADERS = ["Nama PT (legal)", "Brand", "Tahun Aktif", "Total Pembukaan", "Bulan Langganan", "Nama MT / Program", "2024\nBulan Buka", "2024\nTanggal Buka", "2025\nBulan Buka", "2025\nTanggal Buka", "2026\nBulan Buka", "2026\nTanggal Buka", "Catatan", "Industry"];
function mtWorkbook({ active = [], before = [], older = [], contacts = [], requirements = [], updates = [], steps = [], predictions = [], skip = [] } = {}) {
  const sheets = {
    "Ringkasan Industri": [["Industry", "Active 2026"], ["FMCG", { formula: "COUNTIF('Aktif (MT 2026)'!N:N,A2)" }]],
    "Aktif (MT 2026)": [CO_HEADERS, ...active],
    "Pernah Buka (2025)": [CO_HEADERS.filter((h) => !h.startsWith("2026")), ...before],
    "Lama (2024 saja)": [CO_HEADERS.filter((h) => !/^202[56]/.test(h)), ...older],
    "Kontak HR": [["Nama PT (legal)", "Brand", "Status MT", "Nama", "Jabatan", "LinkedIn", "Industry"], ...contacts],
    "Syarat Gabungan": [["Asal Data", "ID", "Brand", "Program", "Reference Year", "Bulan Buka (asumsi)", "Roles", "Education", "GPA", "Majors", "Placement", "Requirements", "Selection Steps", "Duration", "Source Type", "Source Links", "Confidence", "Notes"], ...requirements],
    "Update Tgl & Status": [["Sumber", "ID", "Brand", "Program", "Tgl Buka", "Tgl Tutup", "Status / Periode (per 9 Okt 2026)", "Sumber verifikasi", "Confidence", "Syarat inti", "Catatan"], ...updates],
    "Tahapan Tambahan": [["Sumber", "ID", "Brand", "Program", "Tahapan seleksi", "Sumber / Status verifikasi", "Confidence / Catatan"], ...steps],
    "Prediksi 2026": [["Prioritas", "Nama PT (legal)", "Brand", "Program", "Pola buka", "Estimasi buka 2026 (dari pola)", "Dasar (tanggal tahun lalu)", "Jumlah kontak HR", "Saran approach", "Confidence", "Catatan", "Industry"], ...predictions],
  };
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) { if (skip.includes(name)) continue; const ws = wb.addWorksheet(name); rows.forEach((row) => ws.addRow(row)); }
  return wb.xlsx.writeBuffer().then((buffer) => Buffer.from(buffer));
}
const ACTIVE = [
  ["PT Contoh Pangan Tbk", "Contoh Food", "3 dari 3", "5", "Agustus", "Management Trainee\nRole/varian: Sales; Supply Chain", "Agustus–November", "23 Agustus", "Juli–Agustus", "14 Juli", "Mei, Juni", "8 Mei\n27 Juni", "Catatan contoh", "FMCG"],
  ["PT Bank Contoh Tbk", "Bank Contoh (BCO)", "2 dari 3", "3", "", "Officer Development Program", "", "tutup 15 Januari", "Maret–November", "3 Maret", "Oktober", "6 Oktober", "", "Banking"],
  ["Belum terkonfirmasi", "Grup Kopi", "1 dari 3", "1", "", "MT Store", "", "", "", "", "Desember–Februari", "", "", "Retail & E-commerce"],
];
const BEFORE = [["PT Logistik Contoh", "Kirim Cepat", "2 dari 2", "2", "", "Graduate Program", "Desember", "2 Desember", "November", "21 November", "", "Logistics, Transport & Aviation"]];
const OLDER = [["PT Bank Contoh Tbk", "Bank Contoh (BCO)", "1 dari 1", "1", "", "Next Generation Talent", "Maret", "25 Maret", "", "Banking"]];
const CONTACTS = [
  ["PT Contoh Pangan Tbk", "Contoh Food", "Aktif", "Rina Contoh", "Talent Acquisition", "https://id.linkedin.com/in/rina-contoh", "FMCG"],
  ["PT Contoh Pangan Tbk", "Contoh Food", "Aktif", "(Email rekrutmen umum)", "Email rekrutmen", "rekrut@contoh.test", "FMCG"],
  ["PT Bank Contoh Tbk", "Bank Contoh (BCO)", "Aktif", "Agus Contoh", "HR Manager", "https://id.linkedin.com/in/agus", "Banking"],
  ["PT Bank Contoh Tbk", "Bank Contoh (BCO)", "Lama (2024 saja)", "Dewi Contoh", "Recruiter", "https://id.linkedin.com/in/dewi", "Banking"],
  ["PT Logistik Contoh", "Kirim Cepat", "Pernah Buka", "Budi Contoh", "HRBP", "https://id.linkedin.com/in/budi", "Logistics"],
];
const REQS = [
  ["Riset S-series", "S001", "Contoh Food", "MT Sales", "2026", "Jul 2026 [K]", "Sales", "S1", "Min 3.00", "Semua jurusan", "Seluruh Indonesia", "Fresh graduate", "CV > Psikotes > Interview", "12 bulan", "Official", "https://karir.contoh.test", "High", ""],
  ["Poster IG", "", "BCO", "ODP", "2026", "", "Banking", "S1", "TIDAK KETEMU", "", "", "", "", "", "Poster", "", "Medium", ""],
  ["Poster IG", "", "Perusahaan Hilang", "MT", "2026", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];
const UPDATES = [["Lampiran C", "S001", "Contoh Food", "MT Sales", "8 Mei 2026", "30 Juni 2026", "Sudah tutup", "Poster", "Medium", "IPK 3.0", ""], ["Catatan: tidak ada data baru", "", "", "", "", "", "", "", "", "", ""]];
const STEPS = [["Lampiran H3", "S001", "PT Contoh Pangan Tbk", "MT Sales", "Online Application > Test > Interview", "Official", "High"]];
const PREDICTIONS = [["A. Approach sekarang", "PT Logistik Contoh", "Kirim Cepat", "Graduate Program", "Rutin", "November", "2025: 21 November", "1", "Kirim penawaran Oktober", "Sedang", "", "Logistics, Transport & Aviation"]];
const fullBook = () => mtWorkbook({ active: ACTIVE, before: BEFORE, older: OLDER, contacts: CONTACTS, requirements: REQS, updates: UPDATES, steps: STEPS, predictions: PREDICTIONS });
const mtReset = async () => { await sql.unsafe(MT_MIGRATION); await reset("mt_prospects", "mt_prospect_imports"); };

await test("mt list: preview reports what would change and writes nothing", async () => {
  await mtReset();
  const r = await post("mt-prospects", { file: file("CCC_List_MT.xlsx", await fullBook()), mode: "preview" });
  const [{ count }] = await sql`select count(*)::int from mt_prospects`;
  const s = r.json?.summary;
  ok(r.status === 200 && s?.companies?.added === 5 && s.companies.updated === 0 && s.contacts === 5 && count === 0, "mt preview: 5 companies to add, 5 contacts, nothing written", JSON.stringify(r).slice(0, 400));
  ok(s?.research?.requirement === 2 && s.research.update === 1 && s.research.steps === 1 && s.skippedNotes === 1 && s.unmatched.length === 1 && /Perusahaan Hilang/.test(s.unmatched[0].label), "mt preview: research matched by brand / bracket / legal name; note row skipped; stray row reported", JSON.stringify(s));
});
await test("mt list: apply stores companies, openings, contacts, research, prediction", async () => {
  await mtReset();
  const r = await post("mt-prospects", { file: file("CCC_List_MT.xlsx", await fullBook()), mode: "apply" });
  const rows = await sql`select id, brand, status, industry, total_openings, usual_months, openings, prediction, source, import_key from mt_prospects order by brand, status`;
  ok(r.status === 200 && rows.length === 5 && rows.every((row) => row.source === "import" && row.import_key), "mt apply: 5 companies from the workbook", JSON.stringify(r.json).slice(0, 300));
  const food = rows.find((row) => row.brand === "Contoh Food");
  ok(food && JSON.stringify(food.openings["2024"].months) === "[8,9,10,11]" && JSON.stringify(food.openings["2026"].months) === "[5,6]" && food.openings["2026"].dates === "8 Mei\n27 Juni" && JSON.stringify(food.usual_months) === "[8]" && food.total_openings === 5, "mt apply: month ranges, lists, dates and usual months", JSON.stringify(food));
  const kopi = rows.find((row) => row.brand === "Grup Kopi");
  ok(kopi && JSON.stringify(kopi.openings["2026"].months) === "[1,2,12]", "mt apply: a range over the new year (Desember–Februari)", JSON.stringify(kopi?.openings));
  const banks = rows.filter((row) => row.brand === "Bank Contoh (BCO)");
  ok(banks.length === 2 && banks.map((row) => row.status).sort().join() === "active,older" && new Set(banks.map((row) => row.import_key)).size === 2, "mt apply: same company in two sheets stays two rows", JSON.stringify(banks.map((row) => [row.status, row.import_key])));
  const contacts = await sql`select c.name, p.brand, p.status from mt_prospect_contacts c join mt_prospects p on p.id = c.prospect_id order by c.name`;
  ok(contacts.length === 5 && contacts.find((c) => c.name === "Dewi Contoh")?.status === "older" && contacts.find((c) => c.name === "Agus Contoh")?.status === "active", "mt apply: contacts follow their Status MT to the right row", JSON.stringify(contacts));
  const research = await sql`select r.kind, p.brand, r.details from mt_prospect_research r join mt_prospects p on p.id = r.prospect_id order by r.kind, p.brand`;
  ok(research.length === 4 && research.filter((x) => x.brand === "Contoh Food").length === 3 && research.find((x) => x.brand === "Bank Contoh (BCO)")?.details.gpa === "TIDAK KETEMU", "mt apply: requirements, update and steps on the right companies", JSON.stringify(research.map((x) => [x.kind, x.brand])));
  const logistics = rows.find((row) => row.brand === "Kirim Cepat");
  ok(logistics?.status === "predicted" && logistics.prediction?.priority === "A. Approach sekarang" && logistics.prediction?.estimate === "November", "mt apply: prediction attached to the predicted company", JSON.stringify(logistics?.prediction));
  const [log] = await sql`select file_name, imported_by, summary from mt_prospect_imports`;
  ok(log?.file_name === "CCC_List_MT.xlsx" && log.summary.companies.added === 5, "mt apply: upload recorded", JSON.stringify(log));
});
await test("mt list: re-upload updates in place, keeps app edits' rows, removes dropped companies", async () => {
  await mtReset();
  await post("mt-prospects", { file: file("v1.xlsx", await fullBook()), mode: "apply" });
  const [food] = await sql`select id from mt_prospects where brand = 'Contoh Food'`;
  const [manual] = await sql`insert into mt_prospects (legal_name, brand, status, industry, program, source) values ('PT Manual', 'Manual Co', 'active', 'FMCG', 'MT', 'manual') returning id`;
  await sql`insert into mt_prospect_contacts (prospect_id, name, title, link, source) values (${food.id}, 'Kontak Manual', 'HR', 'https://linkedin.com/in/manual', 'manual'), (${manual.id}, 'Orang Manual', 'HR', 'x@y.test', 'manual')`;
  await sql`update mt_prospects set industry = 'Edited in app' where id = ${food.id}`;
  const v2 = ACTIVE.map((row) => [...row]); v2[0][10] = "September"; // Contoh Food now opens in September
  const r = await post("mt-prospects", { file: file("v2.xlsx", await mtWorkbook({ active: v2, older: OLDER, contacts: CONTACTS, requirements: REQS, updates: UPDATES, steps: STEPS })), mode: "apply" });
  const rows = await sql`select id, brand, industry, openings, source from mt_prospects order by brand`;
  const food2 = rows.find((row) => row.brand === "Contoh Food");
  ok(r.status === 200 && r.json?.summary?.companies?.updated === 4 && r.json.summary.companies.removed === 1 && r.json.summary.companies.keptFromApp === 1, "mt re-upload: 4 updated, 1 removed, 1 app company kept", JSON.stringify(r.json?.summary?.companies));
  ok(food2?.id === food.id && JSON.stringify(food2.openings["2026"].months) === "[9]" && food2.industry === "FMCG", "mt re-upload: same row id, new months, file wins over the app edit", JSON.stringify(food2));
  ok(!rows.some((row) => row.brand === "Kirim Cepat") && rows.some((row) => row.brand === "Manual Co" && row.source === "manual"), "mt re-upload: company no longer in the file removed; app-added company kept", JSON.stringify(rows.map((row) => row.brand)));
  const contacts = await sql`select name, source from mt_prospect_contacts order by name`;
  ok(contacts.length === 6 && contacts.filter((c) => c.name === "Rina Contoh").length === 1 && contacts.some((c) => c.name === "Kontak Manual") && contacts.some((c) => c.name === "Orang Manual"), "mt re-upload: workbook contacts replaced (no duplicates), app-added contacts kept", JSON.stringify(contacts));
  const [{ research }] = await sql`select count(*)::int as research from mt_prospect_research`;
  ok(research === 4, "mt re-upload: research replaced, not doubled", String(research));
});
await test("mt list: a company dropped from the file keeps the contacts added in the app", async () => {
  await mtReset();
  await post("mt-prospects", { file: file("v1.xlsx", await fullBook()), mode: "apply" });
  const [kirim] = await sql`select id from mt_prospects where brand = 'Kirim Cepat'`;
  await sql`insert into mt_prospect_contacts (prospect_id, name, title, link, source) values (${kirim.id}, 'Kontak App', 'HR', 'a@b.test', 'manual')`;
  const v2 = () => mtWorkbook({ active: ACTIVE, older: OLDER, contacts: CONTACTS, requirements: REQS, updates: UPDATES, steps: STEPS });
  const preview = await post("mt-prospects", { file: file("v2.xlsx", await v2()), mode: "preview" });
  ok(preview.json?.summary?.companies?.removed === 0 && preview.json.summary.companies.keptForAppContacts === 1, "mt dropped+app contact: preview says kept, not removed", JSON.stringify(preview.json?.summary?.companies));
  await post("mt-prospects", { file: file("v2.xlsx", await v2()), mode: "apply" });
  const [row] = await sql`select id, source, import_key from mt_prospects where brand = 'Kirim Cepat'`;
  const contacts = await sql`select name from mt_prospect_contacts where prospect_id = ${kirim.id}`;
  ok(row?.id === kirim.id && row.source === "manual" && row.import_key === null && contacts.map((c) => c.name).join() === "Kontak App", "mt dropped+app contact: company kept as an app company with the app contact (imported contact gone)", JSON.stringify({ row, contacts }));
});
await test("mt list: a hyperlinked cell keeps its link, not its label", async () => {
  await mtReset();
  const contacts = [["PT Contoh Pangan Tbk", "Contoh Food", "Aktif", "Sari Link", "HR", { text: "Profile", hyperlink: "https://id.linkedin.com/in/sari-link" }, "FMCG"]];
  await post("mt-prospects", { file: file("v1.xlsx", await mtWorkbook({ active: ACTIVE, before: BEFORE, older: OLDER, contacts })), mode: "apply" });
  const [c] = await sql`select link from mt_prospect_contacts where name = 'Sari Link'`;
  ok(c?.link === "https://id.linkedin.com/in/sari-link", "mt hyperlink: URL stored", JSON.stringify(c));
});
await test("mt list: a different workbook is refused and nothing changes", async () => {
  await mtReset();
  await post("mt-prospects", { file: file("v1.xlsx", await fullBook()), mode: "apply" });
  const r = await post("mt-prospects", { file: file("other.xlsx", await mtWorkbook({ active: ACTIVE, skip: ["Pernah Buka (2025)"] })), mode: "apply" });
  const [{ count }] = await sql`select count(*)::int from mt_prospects`;
  ok(r.status === 400 && /Pernah Buka/.test(r.json?.error || "") && count === 5, "mt wrong file: refused with the missing sheet named, data untouched", JSON.stringify({ r, count }));
  const csvTry = await post("mt-prospects", { file: file("list.csv", Buffer.from("a,b\n1,2")), mode: "preview" });
  ok(csvTry.status === 400 && /xlsx/.test(csvTry.json?.error || ""), "mt wrong type: CSV refused", JSON.stringify(csvTry));
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
