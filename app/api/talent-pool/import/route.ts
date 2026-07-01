import { auth } from "@/auth";
import { importTalentPoolRows } from "@/lib/api/talent-pool";
import { googleSheetCsvUrl } from "@/lib/imports/free-class";
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

function key(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const aliases: Record<string, string[]> = {
  nama: ["nama", "name", "full_name"], email: ["email", "email_address"], wa: ["wa", "whatsapp", "phone", "no_wa"],
  status: ["status"], sumber: ["sumber", "source"], domisili: ["domisili", "city", "kota"],
  universitas: ["universitas", "university", "campus"], campus_tier: ["campus_tier", "tier_kampus"], ipk: ["ipk", "gpa"],
  fakultas: ["fakultas", "faculty"], pendidikan: ["pendidikan", "education"], angkatan: ["angkatan", "cohort"],
  tahun_lulus: ["tahun_lulus", "graduation_year"], organisasi: ["organisasi", "organization"], exchange: ["exchange"],
  relocate: ["relocate", "bersedia_relocate"], topik_minat: ["topik_minat", "interest"], target_mt: ["target_mt"],
  posisi_mt: ["posisi_mt", "target_role"], linkedin: ["linkedin"], pipeline: ["pipeline", "stage"],
  produk_dibeli: ["produk_dibeli", "purchased_product"], kepuasan: ["kepuasan"], membantu: ["membantu"],
  nps: ["nps"], feedback: ["feedback", "notes"], kode_voucher: ["kode_voucher", "voucher_code"], timestamp: ["timestamp"],
};

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
    const headers = new Map<number, string>();
    sheet.getRow(1).eachCell((cell, column) => headers.set(column, key(text(cell.value))));
    const rows: Array<Record<string, string>> = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const source = new Map<string, string>();
      headers.forEach((header, column) => source.set(header, text(row.getCell(column).value)));
      const target: Record<string, string> = {};
      Object.entries(aliases).forEach(([field, names]) => { target[field] = names.map((name) => source.get(name)).find((value) => value !== undefined) || ""; });
      if (!target.email && !target.nama && row.cellCount >= 20) {
        const at = (index: number) => text(row.getCell(index + 1).value);
        Object.assign(target, { timestamp: at(0), wa: at(1), email: at(2), nama: at(3), status: at(4), sumber: at(5), topik_minat: at(6), domisili: at(8), relocate: at(9), pendidikan: at(10), universitas: at(11), campus_tier: at(12), ipk: at(13), fakultas: at(14), angkatan: at(15), tahun_lulus: at(16), organisasi: at(17), exchange: at(18), target_mt: at(19), posisi_mt: at(20), linkedin: at(21), produk_dibeli: at(23), kepuasan: at(24), membantu: at(25), nps: at(26), feedback: at(27), kode_voucher: at(28) });
      }
      if (target.email || target.nama) rows.push(target);
    });
    return Response.json(await importTalentPoolRows(rows));
  } catch (error) {
    console.error("Talent Pool import failed", error);
    return Response.json({ error: "The workbook could not be imported." }, { status: 500 });
  }
}
