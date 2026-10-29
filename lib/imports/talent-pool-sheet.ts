import "server-only";
import type ExcelJS from "exceljs";
import { googleSheetCsvUrl } from "@/lib/imports/free-class";
import { detectHeaderRow, isOrderExport, mapTalentPoolRow, normalizeHeaderKey } from "@/lib/imports/talent-pool-layout";
import { readCsvText } from "@/lib/imports/workbook";

// Reading the Talent Pool sheet, shared by Import file / Import sheet and the hourly Google Sheet
// sync, so every path turns the same sheet into the same rows.

export class SheetProblem extends Error {}

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

/** Downloads a published (or "anyone with the link") Google Sheet tab as a workbook. */
export async function fetchGoogleSheet(sheetUrl: string) {
  let csvUrl: string;
  try { csvUrl = googleSheetCsvUrl(sheetUrl); } catch (error) { throw new SheetProblem(error instanceof Error ? error.message : "The Google Sheets URL is invalid."); }
  const response = await fetch(csvUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new SheetProblem(`Google Sheets returned HTTP ${response.status}. Check that the tab is still published.`);
  const csv = await response.text();
  if (Buffer.byteLength(csv) > 10 * 1024 * 1024) throw new SheetProblem("Google Sheet export is larger than 10 MB.");
  if (/^\s*<(!doctype|html)/i.test(csv)) throw new SheetProblem("Google returned a web page instead of the sheet data. Publish the tab first: File → Share → Publish to web → choose the tab → Comma-separated values, then paste that link. Or set the sheet to “Anyone with the link can view”.");
  return readCsvText(csv);
}

/** Workbook → Talent Pool rows. Throws SheetProblem with a plain reason when it is the wrong sheet. */
export function talentPoolRows(workbook: ExcelJS.Workbook) {
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new SheetProblem("Workbook is empty.");
  // Exports carry banner rows (a record count, a title) above the real header, so scan
  // the first 20 rows for it instead of assuming row 1.
  const keysAt = (rowNumber: number) => {
    const row = sheet.getRow(rowNumber);
    const keys: string[] = [];
    for (let column = 1; column <= sheet.columnCount; column += 1) keys[column - 1] = normalizeHeaderKey(text(row.getCell(column).value));
    return keys;
  };
  const scanned = Array.from({ length: Math.min(20, sheet.rowCount) }, (_, index) => keysAt(index + 1));
  const detected = detectHeaderRow(scanned);
  const headerRowNumber = detected >= 0 ? detected + 1 : 1;
  const headerKeys = scanned[headerRowNumber - 1] ?? [];

  const rows: Array<Record<string, string>> = [];
  sheet.eachRow((row, number) => {
    if (number <= headerRowNumber) return;
    const target = mapTalentPoolRow(headerKeys, (index) => text(row.getCell(index + 1).value), row.cellCount);
    if (target.email || target.nama) rows.push(target);
  });

  // Every Talent Pool row is keyed on a valid email. If not one row has one, the file
  // is almost certainly the wrong export — a lynk.id order sheet gets this far because
  // "Buyer Name" loosely matches `nama`, then every row is dropped for a missing email.
  const hasUsableEmail = rows.some((row) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email || "").trim().toLowerCase()));
  if (!hasUsableEmail) {
    const preview = scanned.slice(0, 3).map((keys, index) => `row ${index + 1}: ${keys.filter(Boolean).slice(0, 4).join(", ") || "(empty)"}`).join("; ");
    const detectedColumns = headerKeys.filter(Boolean).slice(0, 6).join(", ") || "none";
    throw new SheetProblem(scanned.some(isOrderExport)
      ? "This is a lynk.id order export (Judul Barang, Buyer Email, …). It belongs in CRM → Import, not Talent Pool."
      : detected < 0
        ? `No header row with an email column and a name or WhatsApp column was found in the first 20 rows, so nothing was imported. What the sheet starts with: ${preview}. Check that the published tab is the Talent Pool database and that its header row has "Email" and "Nama" or "WhatsApp".`
        : `The header row (row ${headerRowNumber}) was recognised, but no row under it has a valid email address, so there is nothing to import. Columns: ${detectedColumns}.`);
  }
  return rows;
}
