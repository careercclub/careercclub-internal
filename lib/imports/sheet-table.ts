import "server-only";
import type ExcelJS from "exceljs";
import { googleSheetXlsxUrl } from "@/lib/imports/free-class";
import { SheetProblem } from "@/lib/imports/talent-pool-sheet";
import { cellText, readWorkbook } from "@/lib/imports/workbook";

// Reading tabs of a Google Sheet that Claude (or the team) fills: the tab is found by name, the
// columns by their header in row 1 (any order, a few spellings), so a reordered column still works.

export type TableRow = { row: number; get: (field: string) => string; raw: (field: string) => ExcelJS.CellValue };

/** Downloads the whole Google Sheet (every tab) as .xlsx. */
export async function fetchGoogleWorkbook(sheetUrl: string) {
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

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

/** The tab whose name starts with one of `names` (case and spaces ignored), or null. */
export function findTab(workbook: ExcelJS.Workbook, names: string[]) {
  let found: ExcelJS.Worksheet | null = null;
  workbook.eachSheet((sheet) => { if (!found && names.some((name) => norm(sheet.name).startsWith(norm(name)))) found = sheet; });
  return found as ExcelJS.Worksheet | null;
}

/** Rows under the header (row 1). `columns` maps a field to the header spellings it accepts. */
export function readTable(sheet: ExcelJS.Worksheet, columns: Record<string, string[]>, required: string[]): TableRow[] {
  const at = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const name = norm(cellText(cell.value));
    for (const [field, names] of Object.entries(columns)) if (!at.has(field) && names.some((n) => norm(n) === name)) at.set(field, column);
  });
  const missing = required.filter((field) => !at.has(field));
  if (missing.length) throw new SheetProblem(`Tab “${sheet.name}” needs the column${missing.length === 1 ? "" : "s"} ${missing.map((field) => `“${columns[field][0]}”`).join(", ")} in row 1.`);
  const rows: TableRow[] = [];
  for (let number = 2; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const raw = (field: string) => { const column = at.get(field); return column ? row.getCell(column).value : null; };
    const get = (field: string) => cellText(raw(field)).trim();
    if (required.some((field) => get(field))) rows.push({ row: number, get, raw });
  }
  return rows;
}

/** Dates typed in a sheet come in as Date cells, "2026-10-20" or "20/10/2026". */
export function sheetDate(value: string) {
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (iso) return iso[1];
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : value;
}
export const list = (value: string) => value.split(/[,;|\n]/).map((item) => item.trim()).filter(Boolean);
