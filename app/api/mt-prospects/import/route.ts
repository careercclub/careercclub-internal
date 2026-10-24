import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import { applyProspectImport, previewProspectImport } from "@/lib/api/mt-prospects";
import { cellText, readWorkbook } from "@/lib/imports/workbook";
import { parseProspectWorkbook, type SheetRows } from "@/lib/mt-prospects/parse";
import { revalidatePath } from "next/cache";
import type ExcelJS from "exceljs";

export const runtime = "nodejs";

/** A hyperlinked cell showing "Profile" keeps its link, not its label. */
function cellValue(value: ExcelJS.CellValue) {
  const text = cellText(value);
  if (value && typeof value === "object" && "hyperlink" in value && value.hyperlink && !/^(https?:\/\/|[^\s@]+@)/i.test(text)) return String(value.hyperlink).replace(/^mailto:/i, "").trim();
  return text;
}

const SHEET_LABEL: Record<string, string> = { aktif: "Aktif (MT 2026)", "pernah buka": "Pernah Buka (2025)", lama: "Lama (2024 saja)" };

// Upload of the "CCC List MT" workbook. mode=preview reports what would change;
// mode=apply makes the change in one transaction (lib/api/mt-prospects.ts).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const mode = formData?.get("mode") === "apply" ? "apply" : "preview";
  if (!(file instanceof File) || file.size === 0 || file.size > 15 * 1024 * 1024 || !/\.xlsx$/i.test(file.name)) {
    return Response.json({ error: "Choose the MT list as an .xlsx file (up to 15 MB)." }, { status: 400 });
  }
  try {
    const workbook = await readWorkbook(new Uint8Array(await file.arrayBuffer()), file.name);
    const sheets: Record<string, SheetRows> = {};
    workbook.eachSheet((sheet) => {
      const rows: SheetRows = [];
      for (let number = 1; number <= sheet.rowCount; number += 1) {
        const row = sheet.getRow(number);
        const cells: string[] = [];
        for (let column = 1; column <= sheet.columnCount; column += 1) cells.push(cellValue(row.getCell(column).value));
        rows.push(cells);
      }
      sheets[sheet.name] = rows;
    });
    const parsed = parseProspectWorkbook(sheets);
    if (parsed.missingSheets.length) {
      return Response.json({ error: `This does not look like the MT list: sheet ${parsed.missingSheets.map((name) => `"${SHEET_LABEL[name] || name}"`).join(", ")} was not found.` }, { status: 400 });
    }
    if (!parsed.prospects.length) return Response.json({ error: "No companies were found in the file. Check that row 1 of each sheet holds the column names." }, { status: 400 });
    if (mode === "preview") return Response.json({ summary: await previewProspectImport(parsed) });
    const userName = session.user.name || session.user.email || "CCC User";
    const summary = await applyProspectImport(parsed, { fileName: file.name, importedBy: userName });
    await logActivity({ userName, module: "Job Vacancy MT", action: "Import", detail: `${file.name} · ${parsed.prospects.length} companies`, table: "mt_prospects" });
    revalidatePath("/job-vacancy-mt");
    return Response.json({ summary });
  } catch (error) {
    console.error("MT list import failed", error);
    return Response.json({ error: "The file could not be read. Nothing was changed." }, { status: 500 });
  }
}
