import { auth } from "@/auth";
import { importInstagramSnapshots } from "@/lib/api/instagram";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";

export const runtime = "nodejs";

type ImportRow = Record<string, string | number | null>;

function text(value: ExcelJS.CellValue) { if (value === null || value === undefined) return ""; if (value instanceof Date) return value.toISOString().slice(0, 10); if (typeof value === "object") { if ("text" in value) return String(value.text || ""); if ("result" in value) return String(value.result || ""); if ("richText" in value) return value.richText.map((item) => item.text).join(""); } return String(value).trim(); }
function key(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function date(value: string) { const match = value.match(/^\d{4}-\d{2}-\d{2}/); if (match) return match[0]; const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : ""; }
function monday(value: string) { const parsed = new Date(`${value}T00:00:00Z`); if (!Number.isFinite(parsed.getTime())) return ""; const weekday = parsed.getUTCDay(); parsed.setUTCDate(parsed.getUTCDate() - (weekday === 0 ? 6 : weekday - 1)); return parsed.toISOString().slice(0, 10); }
function decode(buffer: Buffer) { const utf16 = (buffer[0] === 0xff && buffer[1] === 0xfe) || buffer.subarray(0, Math.min(buffer.length, 200)).filter((value) => value === 0).length > 20; return buffer.toString(utf16 ? "utf16le" : "utf8").replace(/^\uFEFF/, ""); }
function csvCells(line: string) { return line.split(",").map((part) => part.replace(/^"|"$/g, "").trim()); }

const aliases: Record<string, string[]> = { week_start: ["week_start", "week", "date", "tanggal"], followers_total: ["followers_total", "followers"], follows_gained: ["follows_gained", "new_followers", "follows", "instagram_follows"], reach: ["reach", "accounts_reached"], views: ["views"], interactions: ["interactions", "content_interactions"], link_clicks: ["link_clicks", "link_taps", "instagram_link_clicks"], profile_visits: ["profile_visits", "instagram_profile_visits"], notes: ["notes", "catatan"] };
const legacyMetric: Record<string, string> = { "views": "views", "reach": "reach", "content interactions": "interactions", "instagram link clicks": "link_clicks", "instagram profile visits": "profile_visits", "instagram follows": "follows_gained" };

function parseLegacyMeta(buffer: Buffer) {
  const lines = decode(buffer).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && line.toLowerCase() !== "sep=,");
  const metric = legacyMetric[lines[0]?.replace(/^"|"$/g, "").toLowerCase()];
  if (!metric) return null;
  const rows: Array<{ date: string; metric: string; value: number }> = [];
  for (const line of lines.slice(1)) {
    if (line.replace(/^"/, "").toLowerCase().startsWith("date")) continue;
    const cells = csvCells(line); const rowDate = date(cells[0] || ""); const value = Number((cells[1] || "").replaceAll(",", ""));
    if (rowDate && Number.isFinite(value)) rows.push({ date: rowDate, metric, value });
  }
  return rows;
}

async function parseWorkbook(file: File, buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  if (/\.csv$/i.test(file.name)) await workbook.csv.read(Readable.from(decode(buffer)));
  else await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0]; if (!sheet) return [];
  const headers = new Map<number, string>(); sheet.getRow(1).eachCell((cell, column) => headers.set(column, key(text(cell.value))));
  const rows: ImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const source = new Map<string, string>(); headers.forEach((header, column) => source.set(header, text(row.getCell(column).value)));
    const target: ImportRow = {};
    Object.entries(aliases).forEach(([field, names]) => { const value = names.map((name) => source.get(name)).find((item) => item !== undefined) || ""; target[field] = field === "week_start" ? date(value) : field === "notes" ? value : Number(value.replaceAll(",", "")) || 0; });
    if (target.week_start) rows.push(target);
  });
  return rows;
}

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData();
  const files = formData.getAll("files").concat(formData.getAll("file")).filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length || files.some((file) => file.size > 10 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) || files.reduce((sum, file) => sum + file.size, 0) > 30 * 1024 * 1024) return Response.json({ error: "Provide CSV/XLSX files up to 10 MB each and 30 MB total." }, { status: 400 });
  try {
    const normalized: ImportRow[] = [];
    const daily = new Map<string, Record<string, number>>();
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const legacy = /\.csv$/i.test(file.name) ? parseLegacyMeta(buffer) : null;
      if (legacy) {
        legacy.forEach((item) => { const metrics = daily.get(item.date) || {}; metrics[item.metric] = (metrics[item.metric] || 0) + item.value; daily.set(item.date, metrics); });
      } else normalized.push(...await parseWorkbook(file, buffer));
    }
    const weekly = new Map<string, ImportRow>();
    daily.forEach((metrics, rowDate) => { const week = monday(rowDate); if (!week) return; const row = weekly.get(week) || { week_start: week }; Object.entries(metrics).forEach(([metric, value]) => { row[metric] = Number(row[metric] || 0) + value; }); weekly.set(week, row); });
    const rows = normalized.concat([...weekly.values()]);
    if (!rows.length) return Response.json({ error: "No supported Instagram metrics were found." }, { status: 400 });
    return Response.json({ ...await importInstagramSnapshots(rows), files: files.length });
  } catch (error) { console.error("Instagram import failed", error); return Response.json({ error: "The Instagram export could not be imported." }, { status: 500 }); }
}
