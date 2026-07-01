import { auth } from "@/auth";
import { importTalentPoolRows } from "@/lib/api/talent-pool";
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
  tahun_lulus: ["tahun_lulus", "graduation_year"], target_mt: ["target_mt"], posisi_mt: ["posisi_mt", "target_role"],
  pipeline: ["pipeline", "stage"], produk_dibeli: ["produk_dibeli", "purchased_product"], feedback: ["feedback", "notes"],
};

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) return Response.json({ error: "A CSV or XLSX file up to 10 MB is required." }, { status: 400 });
  try {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await file.arrayBuffer());
    if (/\.csv$/i.test(file.name)) await workbook.csv.read(Readable.from(buffer.toString("utf8")));
    else await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
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
      if (target.email || target.nama) rows.push(target);
    });
    return Response.json(await importTalentPoolRows(rows));
  } catch (error) {
    console.error("Talent Pool import failed", error);
    return Response.json({ error: "The workbook could not be imported." }, { status: 500 });
  }
}
