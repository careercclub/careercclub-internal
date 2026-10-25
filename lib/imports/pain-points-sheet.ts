import "server-only";
import type ExcelJS from "exceljs";
import { SheetProblem } from "@/lib/imports/talent-pool-sheet";
import { cellText } from "@/lib/imports/workbook";

// The "Customer Knowledge inbox" Google Sheet: one row per comment / DM / reply, filled by Claude
// (Composio) or by the team. Columns are found by name in the first 5 rows, so their order does not matter.

const COLUMNS: Record<string, string[]> = {
  comment: ["comment", "komentar", "message", "pesan", "text", "comment or discussion"],
  platform: ["platform", "source platform"],
  category: ["category", "kategori"],
  month: ["date", "tanggal", "month", "bulan"],
  username: ["username", "user", "akun"],
  source_url: ["source link", "source url", "source", "link", "url"],
  labels: ["labels", "label", "tags"],
  notes: ["notes", "catatan", "note"],
};
const key = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

export type SheetPainPoint = Record<string, unknown> & { row: number };

/** Workbook (first tab) → pain points for the Claude-access rules, with the sheet row number. */
export function painPointRows(workbook: ExcelJS.Workbook): SheetPainPoint[] {
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new SheetProblem("The sheet is empty.");
  let headerRow = 0; let columns = new Map<string, number>();
  for (let number = 1; number <= Math.min(5, sheet.rowCount) && !headerRow; number += 1) {
    const found = new Map<string, number>();
    sheet.getRow(number).eachCell((cell, column) => {
      const name = key(cellText(cell.value));
      for (const [field, aliases] of Object.entries(COLUMNS)) if (!found.has(field) && aliases.includes(name)) found.set(field, column);
    });
    if (found.has("comment") && found.has("platform")) { headerRow = number; columns = found; }
  }
  if (!headerRow) throw new SheetProblem("No header row with “Comment” and “Platform” was found in the first 5 rows. Use the columns Date, Platform, Category, Comment, Username, Source link, Labels, Notes.");
  const rows: SheetPainPoint[] = [];
  for (let number = headerRow + 1; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const get = (field: string) => { const column = columns.get(field); return column ? cellText(row.getCell(column).value).trim() : ""; };
    if (!get("comment")) continue;
    rows.push({
      row: number, comment: get("comment"), platform: get("platform"), category: get("category"), month: get("month"),
      username: get("username"), source_url: get("source_url"), notes: get("notes"),
      labels: get("labels").split(/[,;|#]/).map((label) => label.trim()).filter(Boolean),
    });
  }
  return rows;
}
