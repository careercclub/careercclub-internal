import { auth } from "@/auth";
import { importTalentPoolRows } from "@/lib/api/talent-pool";
import { googleSheetCsvUrl } from "@/lib/imports/free-class";
import { detectHeaderRow, mapTalentPoolRow, normalizeHeaderKey } from "@/lib/imports/talent-pool-layout";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";

export const runtime = "nodejs";

function text(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value) return String(value.text || "");
    if ("result" in value) return String(value.result || "");
    if ("richText" in value) return value.richText.map((item) => item.text).join("");
  }
  return String(value).trim();
}

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file"); const sheetUrl = String(formData.get("url") || "").trim();
  try {
    const workbook = new ExcelJS.Workbook();
    if (sheetUrl) {
      const response = await fetch(googleSheetCsvUrl(sheetUrl), { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}.`);
      const csv = await response.text(); if (Buffer.byteLength(csv) > 10 * 1024 * 1024) throw new Error("Google Sheet export is larger than 10 MB.");
      await workbook.csv.read(Readable.from(csv));
    } else {
      if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) return Response.json({ error: "A Google Sheets URL or CSV/XLSX file up to 10 MB is required." }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      if (/\.csv$/i.test(file.name)) await workbook.csv.read(Readable.from(buffer.toString("utf8")));
      else await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) return Response.json({ error: "Workbook is empty." }, { status: 400 });

    // Exports sometimes carry a banner row above the real header, so scan the first
    // rows for it instead of assuming row 1.
    const keysAt = (rowNumber: number) => {
      const row = sheet.getRow(rowNumber);
      const keys: string[] = [];
      for (let column = 1; column <= sheet.columnCount; column += 1) keys[column - 1] = normalizeHeaderKey(text(row.getCell(column).value));
      return keys;
    };
    const scanned = [1, 2, 3, 4, 5].filter((rowNumber) => rowNumber <= sheet.rowCount).map(keysAt);
    const detected = detectHeaderRow(scanned);
    const headerRowNumber = detected >= 0 ? detected + 1 : 1;
    const headerKeys = scanned[headerRowNumber - 1] ?? [];

    const rows: Array<Record<string, string>> = [];
    sheet.eachRow((row, number) => {
      if (number <= headerRowNumber) return;
      const target = mapTalentPoolRow(headerKeys, (index) => text(row.getCell(index + 1).value), row.cellCount);
      if (target.email || target.nama) rows.push(target);
    });
    return Response.json(await importTalentPoolRows(rows));
  } catch (error) {
    console.error("Talent Pool import failed", error);
    return Response.json({ error: "The workbook could not be imported." }, { status: 500 });
  }
}
