import { auth } from "@/auth";
import { importContentEvaluations, type ContentEvaluationImportRow } from "@/lib/api/content-evaluation";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";

export const runtime = "nodejs";

function text(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value) return String(value.text || "");
    if ("result" in value) return String(value.result || "");
    if ("richText" in value) return value.richText.map((item) => item.text).join("");
  }
  return String(value).trim();
}

function number(value: string) { if (!value) return null; const parsed = Number(value.replaceAll(",", "")); return Number.isFinite(parsed) ? parsed : null; }
function format(value: string) { const lower = value.toLowerCase(); if (lower.includes("reel") || lower.includes("video")) return "Reel"; if (lower.includes("story")) return "Story"; if (lower.includes("photo") || lower.includes("image")) return "Feed Photo"; return "Carousel"; }
function date(value: string) { const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`; const meta = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (meta) return `${meta[3]}-${meta[1].padStart(2, "0")}-${meta[2].padStart(2, "0")}`; const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null; }

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData(); const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) return Response.json({ error: "A CSV or XLSX file up to 10 MB is required." }, { status: 400 });
  try {
    const workbook = new ExcelJS.Workbook(); const buffer = Buffer.from(await file.arrayBuffer());
    if (/\.csv$/i.test(file.name)) await workbook.csv.read(Readable.from(buffer.toString("utf8"))); else await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.worksheets[0]; if (!sheet) return Response.json({ error: "Workbook is empty." }, { status: 400 });
    const headers = new Map<number, string>(); sheet.getRow(1).eachCell((cell, column) => headers.set(column, text(cell.value).toLowerCase()));
    const rows: ContentEvaluationImportRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = new Map<string, string>(); headers.forEach((header, column) => values.set(header, text(row.getCell(column).value)));
      const get = (name: string) => values.get(name) || ""; const postId = get("post id"); if (!postId) return;
      const description = get("description");
      rows.push({ postId, accountId: get("account id"), accountUsername: get("account username"), description, title: description.replace(/\s+/g, " ").slice(0, 80) || `Post ${postId}`, url: get("permalink"), format: format(get("post type")), date: date(get("publish time") || get("date")), views: number(get("views")), reach: number(get("reach")), likes: number(get("likes")), comments: number(get("comments")), saves: number(get("saves")), shares: number(get("shares")), follows: number(get("follows")), duration: number(get("duration (sec)") || get("duration")) });
    });
    if (!rows.length) return Response.json({ error: "No Meta Business Suite rows with Post ID were found." }, { status: 400 });
    return Response.json(await importContentEvaluations(rows));
  } catch (error) { console.error("Content evaluation import failed", error); return Response.json({ error: "The workbook could not be imported." }, { status: 500 }); }
}
