import "server-only";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { decodeText, detectDelimiter, stripSepLine } from "./csv-text";

/**
 * Every import reads files through here so CSV and XLSX behave the same:
 *  - CSV cells stay text (ExcelJS would otherwise turn "18034567890123401" into a float
 *    and "0812…" into 812…); each route parses numbers/dates itself.
 *  - The delimiter is detected (",", ";" from Excel in Indonesian, tab).
 *  - UTF-16 / BOM / "sep=" lines are handled.
 */
export async function readWorkbook(bytes: Uint8Array, fileName: string) {
  const workbook = new ExcelJS.Workbook();
  if (/\.csv$/i.test(fileName) || /\.txt$/i.test(fileName)) await readCsvInto(workbook, decodeText(bytes));
  else await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

export async function readCsvText(text: string) {
  const workbook = new ExcelJS.Workbook();
  await readCsvInto(workbook, text.replace(/^﻿/, ""));
  return workbook;
}

async function readCsvInto(workbook: ExcelJS.Workbook, raw: string) {
  const { text, delimiter } = stripSepLine(raw);
  await workbook.csv.read(Readable.from([text]), {
    // Keep every cell as the exact text in the file.
    map: (value: unknown) => value,
    parserOptions: { delimiter: delimiter || detectDelimiter(text), quote: "\"", ignoreEmpty: false, relaxColumnCount: true },
  } as unknown as Parameters<typeof workbook.csv.read>[1]);
}

/** A cell as text: rich text, hyperlinks, formulas and dates included. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((item) => item.text).join("").trim();
    if ("text" in value) return String((value as { text: unknown }).text ?? "").trim();
    if ("result" in value) { const result = (value as { result: unknown }).result; return result instanceof Date ? result.toISOString() : String(result ?? "").trim(); }
    if ("hyperlink" in value) return String((value as { hyperlink: unknown }).hyperlink ?? "").trim();
  }
  // Large whole numbers (IDs, phone numbers typed into Excel) without exponent notation.
  if (typeof value === "number" && Number.isInteger(value) && Math.abs(value) >= 1e15) return BigInt(value).toString();
  return String(value).trim();
}
