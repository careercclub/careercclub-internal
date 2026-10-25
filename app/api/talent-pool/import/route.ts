import { auth } from "@/auth";
import { importTalentPoolRows } from "@/lib/api/talent-pool";
import { fetchGoogleSheet, SheetProblem, talentPoolRows } from "@/lib/imports/talent-pool-sheet";
import { readWorkbook } from "@/lib/imports/workbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file"); const sheetUrl = String(formData.get("url") || "").trim();
  try {
    let workbook;
    if (sheetUrl) workbook = await fetchGoogleSheet(sheetUrl);
    else {
      if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) return Response.json({ error: "A Google Sheets URL or CSV/XLSX file up to 10 MB is required." }, { status: 400 });
      workbook = await readWorkbook(new Uint8Array(await file.arrayBuffer()), file.name);
    }
    return Response.json(await importTalentPoolRows(talentPoolRows(workbook)));
  } catch (error) {
    if (error instanceof SheetProblem) return Response.json({ error: error.message }, { status: 400 });
    console.error("Talent Pool import failed", error);
    return Response.json({ error: "The workbook could not be imported." }, { status: 500 });
  }
}
