import "server-only";
import type ExcelJS from "exceljs";
import { googleSheetXlsxUrl } from "@/lib/imports/free-class";
import { SheetProblem } from "@/lib/imports/talent-pool-sheet";
import { cellText, readWorkbook } from "@/lib/imports/workbook";
import { parseProspectWorkbook, type SheetRows } from "@/lib/mt-prospects/parse";

// Reading the "CCC List MT" workbook, shared by Import Excel (upload) and the hourly Google Sheet
// sync, so a file and the Google Sheet with the same tabs give the same companies.

/** A hyperlinked cell showing "Profile" keeps its link, not its label. */
function cellValue(value: ExcelJS.CellValue) {
  const text = cellText(value);
  if (value && typeof value === "object" && "hyperlink" in value && value.hyperlink && !/^(https?:\/\/|[^\s@]+@)/i.test(text)) return String(value.hyperlink).replace(/^mailto:/i, "").trim();
  return text;
}

const SHEET_LABEL: Record<string, string> = { aktif: "Aktif (MT 2026)", "pernah buka": "Pernah Buka (2025)", lama: "Lama (2024 saja)" };

/** Workbook → companies, HR contacts and research. Throws SheetProblem when it is not the MT list. */
export function parseMtWorkbook(workbook: ExcelJS.Workbook) {
  const sheets: Record<string, SheetRows> = {};
  workbook.eachSheet((sheet) => {
    const rows: SheetRows = [];
    for (let number = 1; number <= sheet.rowCount; number += 1) {
      const row = sheet.getRow(number);
      const cells: string[] = [];
      for (let column = 1; column <= sheet.columnCount; column += 1) cells.push(cellValue(row.getCell(column).value));
      rows.push(cells);
    }
    sheets[sheet.name] = rows;
  });
  const parsed = parseProspectWorkbook(sheets);
  if (parsed.missingSheets.length) throw new SheetProblem(`This does not look like the MT list: sheet ${parsed.missingSheets.map((name) => `"${SHEET_LABEL[name] || name}"`).join(", ")} was not found.`);
  if (!parsed.prospects.length) throw new SheetProblem("No companies were found. Check that row 1 of each sheet holds the column names.");
  return parsed;
}

/** Downloads the whole Google Sheet (every tab) as .xlsx. */
export async function fetchMtGoogleSheet(sheetUrl: string) {
  let xlsxUrl: string;
  try { xlsxUrl = googleSheetXlsxUrl(sheetUrl); } catch (error) { throw new SheetProblem(error instanceof Error ? error.message : "The Google Sheets URL is invalid."); }
  const response = await fetch(xlsxUrl, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new SheetProblem(`Google Sheets returned HTTP ${response.status}. Check that the sheet is still published.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 15 * 1024 * 1024) throw new SheetProblem("The Google Sheet is larger than 15 MB.");
  // An .xlsx is a zip ("PK"); anything else is Google's sign-in or error page.
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new SheetProblem("Google returned a web page instead of the sheet. Publish the whole sheet first: File → Share → Publish to web → Entire document → Microsoft Excel (.xlsx), then paste that link. Or set the sheet to “Anyone with the link can view”.");
  return readWorkbook(bytes, "google-sheet.xlsx");
}
