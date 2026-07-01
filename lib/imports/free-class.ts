import "server-only";
import type ExcelJS from "exceljs";

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value) return String(value.text || "").trim();
    if ("result" in value) return String(value.result || "").trim();
    if ("richText" in value) return value.richText.map((item) => item.text).join("").trim();
  }
  return String(value).trim();
}

const ratings: Array<[string, string[]]> = [
  ["materi_judul", ["sesuai dengan judul", "sesuai dengan tema"]],
  ["materi_kebutuhan", ["sesuai dengan kebutuhan"]],
  ["materi_mudah", ["mudah untuk saya pahami", "mudah dipahami"]],
  ["materi_jawab", ["menjawab pertanyaan"]],
  ["nara_kuasai", ["menguasai materi"]],
  ["nara_jelas", ["menyampaikan materi"]],
  ["kualitas_teknis", ["kualitas teknis", "audio"]],
  ["waktu", ["waktu pelaksanaan"]],
  ["moderator", ["moderator"]],
  ["info_webinar", ["informasi webinar"]],
  ["kepuasan", ["puas dengan pelaksanaan"]],
  ["minat", ["berminat untuk mengikuti", "berminat mengikuti"]],
  ["rekomendasi", ["merekomendasikan"]],
];

export function parseFreeClassWorksheet(sheet: ExcelJS.Worksheet) {
  const headers = new Map<number, string>();
  sheet.getRow(1).eachCell((cell, column) => headers.set(column, cellText(cell.value).toLowerCase()));
  const rows: Array<Record<string, string | number | null>> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (words: string[]) => {
      for (const [column, header] of headers) {
        if (words.some((word) => header.includes(word))) return cellText(row.getCell(column).value);
      }
      return "";
    };
    const email = get(["email"]).toLowerCase();
    const seri = get(["free class", "seri yang", "seri "]);
    if (!email || !seri) return;

    const target: Record<string, string | number | null> = {
      email,
      seri,
      nama: get(["nama"]),
      universitas: get(["universitas", "university"]),
      angkatan: get(["angkatan"]),
      timestamp: get(["timestamp"]),
      hal_baik: get(["sudah baik", "hal apa yang sudah", "baik dari"]),
      ditingkatkan: get(["ditingkatkan", "bisa ditingkatkan"]),
      topik_keinginan: get(["topik", "pelajari", "ingin"]),
    };
    ratings.forEach(([field, words]) => {
      const value = Number(get(words));
      target[field] = value >= 1 && value <= 5 ? value : null;
    });
    rows.push(target);
  });

  return rows;
}

export function googleSheetCsvUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw new Error("Only HTTPS Google Sheets URLs are supported.");
  }
  if (/^\/spreadsheets\/d\/e\/[a-zA-Z0-9-_]+\/pub/.test(url.pathname)) {
    url.searchParams.set("output", "csv");
    return url.toString();
  }
  const match = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("The Google Sheets URL is invalid.");
  const hashGid = new URLSearchParams(url.hash.replace(/^#/, "")).get("gid");
  const gid = url.searchParams.get("gid") || hashGid || "0";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}
