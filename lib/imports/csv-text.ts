// Text-level helpers shared by every CSV/XLSX import. Pure — no imports — so the unit
// tests load it directly under `node --test`.
//
// Why these exist (found by running the real import routes against Postgres, Oct 2026):
//  * ExcelJS's CSV reader turns digit strings into JS numbers by default. A 17-digit
//    Meta Post ID loses its last digits, so different posts collapse into one and
//    overwrite each other; WhatsApp "0812…" loses its leading 0; voucher "0012" → 12.
//  * Excel set to an Indonesian region saves CSV with ";" — read as one giant column.
//  * Meta Insights exports are UTF-16 with a "sep=," line; Excel CSVs carry a BOM.

/** Bytes → text: UTF-16 (BOM or many NULs) or UTF-8, BOM removed. */
export function decodeText(bytes: Uint8Array) {
  const head = bytes.subarray(0, Math.min(bytes.length, 400));
  let nuls = 0; for (const b of head) if (b === 0) nuls += 1;
  const utf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || nuls > head.length / 4;
  return new TextDecoder(utf16 ? "utf-16le" : "utf-8").decode(bytes).replace(/^﻿/, "");
}

/** Drop Excel's "sep=;" hint line, returning the delimiter it names. */
export function stripSepLine(text: string): { text: string; delimiter: string | null } {
  const match = text.match(/^\s*"?sep=(.)"?\s*\r?\n/i);
  return match ? { text: text.slice(match[0].length), delimiter: match[1] } : { text, delimiter: null };
}

/** The delimiter used by the first lines: ",", ";" or tab — whichever splits them most consistently. */
export function detectDelimiter(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 10);
  let best = ","; let bestScore = -1;
  for (const candidate of [",", ";", "\t"]) {
    const counts = lines.map((line) => splitCsvLine(line, candidate).length);
    if (!counts.length) continue;
    const max = Math.max(...counts);
    if (max < 2) continue;
    const consistent = counts.filter((n) => n === max).length;
    const score = consistent * 1000 + max;
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  return best;
}

/** One CSV line → cells, honouring quotes ("a, b" stays one cell; "" is a quote). */
export function splitCsvLine(line: string, delimiter = ",") {
  const cells: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === "\"" && line[i + 1] === "\"") { cell += "\""; i += 1; }
      else if (ch === "\"") quoted = false;
      else cell += ch;
    } else if (ch === "\"") quoted = true;
    else if (ch === delimiter) { cells.push(cell); cell = ""; }
    else cell += ch;
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

/** "1,234" / "1.234.567" / "12 345" / "Rp 99.000" → number; blank or junk → null. */
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim().replace(/^rp\.?\s*/i, "").replace(/[\s%]/g, "");
  if (!text || text === "-") return null;
  // Indonesian thousands ("1.234.567") vs a decimal point ("3.57"): dots followed by
  // exactly three digits, more than once or with no other separator, are thousands.
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d{1,2}$/.test(text)) text = text.replace(",", ".");
  else text = text.replace(/,/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };
const valid = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null;
};

/**
 * A calendar date as "YYYY-MM-DD", or null. `order` says how to read an ambiguous
 * "03/04/2026": "dmy" (Indonesian sheets, lynk.id) or "mdy" (Meta exports). An
 * unambiguous value (day > 12) is read correctly either way.
 */
export function parseDate(value: unknown, order: "dmy" | "mdy" = "dmy"): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
  const text = String(value ?? "").trim();
  if (!text) return null;
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]); const y = Number(m[3]);
    const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : order === "dmy" ? [a, b] : [b, a];
    return valid(y, mo, d);
  }
  m = text.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})/i);
  if (m && MONTHS[m[2].toLowerCase()]) return valid(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]));
  // Excel serial day number (a date cell exported as a plain number).
  if (/^\d{5}(\.\d+)?$/.test(text)) { const serial = Number(text); if (serial > 20000 && serial < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10); }
  return null;
}
