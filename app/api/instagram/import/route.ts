import { auth } from "@/auth";
import { importInstagramSnapshots } from "@/lib/api/instagram";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";

export const runtime = "nodejs";

function text(value: ExcelJS.CellValue) { if (value === null || value === undefined) return ""; if (value instanceof Date) return value.toISOString().slice(0, 10); if (typeof value === "object") { if ("text" in value) return String(value.text || ""); if ("result" in value) return String(value.result || ""); if ("richText" in value) return value.richText.map((item) => item.text).join(""); } return String(value).trim(); }
function key(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function date(value: string) { const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ""; }
const aliases: Record<string, string[]> = { week_start: ["week_start", "week", "date", "tanggal"], followers_total: ["followers_total", "followers"], follows_gained: ["follows_gained", "new_followers", "follows"], reach: ["reach", "accounts_reached"], views: ["views"], interactions: ["interactions", "content_interactions"], link_clicks: ["link_clicks", "link_taps"], profile_visits: ["profile_visits"], notes: ["notes", "catatan"] };

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData(); const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) return Response.json({ error: "A CSV or XLSX file up to 10 MB is required." }, { status: 400 });
  try {
    const workbook = new ExcelJS.Workbook(); const buffer = Buffer.from(await file.arrayBuffer()); if (/\.csv$/i.test(file.name)) await workbook.csv.read(Readable.from(buffer.toString("utf8"))); else await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.worksheets[0]; if (!sheet) return Response.json({ error: "Workbook is empty." }, { status: 400 });
    const headers = new Map<number, string>(); sheet.getRow(1).eachCell((cell, column) => headers.set(column, key(text(cell.value)))); const rows: Array<Record<string, string | number>> = [];
    sheet.eachRow((row, number) => { if (number === 1) return; const source = new Map<string, string>(); headers.forEach((header, column) => source.set(header, text(row.getCell(column).value))); const target: Record<string, string | number> = {}; Object.entries(aliases).forEach(([field, names]) => { const value = names.map((name) => source.get(name)).find((item) => item !== undefined) || ""; target[field] = field === "week_start" ? date(value) : field === "notes" ? value : Number(value.replaceAll(",", "")) || 0; }); if (target.week_start) rows.push(target); });
    return Response.json(await importInstagramSnapshots(rows));
  } catch (error) { console.error("Instagram import failed", error); return Response.json({ error: "The workbook could not be imported." }, { status: 500 }); }
}
