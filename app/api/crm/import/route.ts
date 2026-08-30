import { auth } from "@/auth";
import { importCrmTransactions } from "@/lib/api/crm";
import { mapCrmRow, type CrmImportRow } from "@/lib/imports/crm-rows";
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
    const row = mapCrmRow(values);
    if (row) rows.push(row);
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
