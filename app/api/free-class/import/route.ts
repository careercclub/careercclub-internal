import { auth } from "@/auth";
import { importFreeClassEvaluations } from "@/lib/api/customer-knowledge";
import { googleSheetCsvUrl, parseFreeClassWorksheet } from "@/lib/imports/free-class";
import { readCsvText, readWorkbook } from "@/lib/imports/workbook";
import type ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file");
  const sheetUrl = String(formData.get("url") || "").trim();

  try {
    let workbook: ExcelJS.Workbook;
    if (sheetUrl) {
      const response = await fetch(googleSheetCsvUrl(sheetUrl), {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}.`);
      const length = Number(response.headers.get("content-length") || 0);
      if (length > 10 * 1024 * 1024) throw new Error("The Google Sheet export is larger than 10 MB.");
      const csv = await response.text();
      if (Buffer.byteLength(csv) > 10 * 1024 * 1024) throw new Error("The Google Sheet export is larger than 10 MB.");
      if (/^\s*<(!doctype|html)/i.test(csv)) throw new Error("Google returned a web page instead of the sheet data. Publish the tab to the web as CSV (File → Share → Publish to web) and paste that link.");
      workbook = await readCsvText(csv);
    } else {
      if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) {
        return Response.json({ error: "A Google Sheets URL or CSV/XLSX file up to 10 MB is required." }, { status: 400 });
      }
      workbook = await readWorkbook(new Uint8Array(await file.arrayBuffer()), file.name);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) return Response.json({ error: "Workbook is empty." }, { status: 400 });
    return Response.json(await importFreeClassEvaluations(parseFreeClassWorksheet(sheet)));
  } catch (error) {
    console.error("Free class import failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "The workbook could not be imported." }, { status: 400 });
  }
}
