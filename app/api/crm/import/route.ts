import { auth } from "@/auth";
import { importCrmTransactions, type CrmImportRow } from "@/lib/api/crm";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";

export const runtime = "nodejs";

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value) return String(value.text || "");
    if ("result" in value) return String(value.result || "");
    if ("richText" in value) return value.richText.map((item) => item.text).join("");
  }
  return String(value);
}

function normalizedDate(value: string) {
  const text = value.trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

function normalizeWa(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits && !digits.startsWith("62")) digits = `62${digits}`;
  return digits;
}

function find(row: Map<string, string>, names: string[]) {
  for (const name of names) {
    const direct = row.get(name.toLowerCase());
    if (direct !== undefined) return direct;
  }
  return "";
}

async function readRows(file: File): Promise<CrmImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".csv")) {
    await workbook.csv.read(Readable.from(buffer.toString("utf8")));
  } else {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const headers = new Map<number, string>();
  worksheet.getRow(1).eachCell((cell, column) => headers.set(column, cellText(cell.value).trim().toLowerCase()));
  const rows: CrmImportRow[] = [];
  worksheet.eachRow((sheetRow, rowNumber) => {
    if (rowNumber === 1) return;
    const values = new Map<string, string>();
    headers.forEach((header, column) => values.set(header, cellText(sheetRow.getCell(column).value).trim()));
    const product = find(values, ["judul barang", "product", "produk"]);
    const email = find(values, ["buyer email", "email"]);
    const phone = find(values, ["buyer phone (opsional)", "buyer phone", "phone", "wa", "whatsapp"]);
    if (!product && !email && !phone) return;
    rows.push({
      status: find(values, ["status", "payment status"]),
      name: find(values, ["buyer name (opsional)", "buyer name", "name", "nama"]),
      wa: normalizeWa(phone),
      email: email.toLowerCase(),
      product,
      price: Number(find(values, ["harga", "price"]).replace(/[^\d.-]/g, "")) || 0,
      notes: find(values, ["notes (opsional)", "notes"]),
      date: normalizedDate(find(values, ["tanggal", "date", "created at"])),
    });
  });
  return rows;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file");
  const mode = formData.get("mode") === "results" ? "results" : "new";
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "A CSV or XLSX file up to 10 MB is required." }, { status: 400 });
  }
  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    return Response.json({ error: "Only CSV and XLSX files are supported." }, { status: 400 });
  }
  try {
    const rows = await readRows(file);
    if (!rows.length) return Response.json({ error: "No transaction rows were found." }, { status: 400 });
    return Response.json(await importCrmTransactions(rows, mode));
  } catch (error) {
    console.error("CRM import failed", error);
    return Response.json({ error: "The workbook could not be imported." }, { status: 500 });
  }
}
