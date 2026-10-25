import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import { applyProspectImport, previewProspectImport } from "@/lib/api/mt-prospects";
import { parseMtWorkbook } from "@/lib/imports/mt-prospects-sheet";
import { SheetProblem } from "@/lib/imports/talent-pool-sheet";
import { readWorkbook } from "@/lib/imports/workbook";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

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
    const parsed = parseMtWorkbook(workbook);
    if (mode === "preview") return Response.json({ summary: await previewProspectImport(parsed) });
    const userName = session.user.name || session.user.email || "CCC User";
    const summary = await applyProspectImport(parsed, { fileName: file.name, importedBy: userName });
    await logActivity({ userName, module: "Job Vacancy MT", action: "Import", detail: `${file.name} · ${parsed.prospects.length} companies`, table: "mt_prospects" });
    revalidatePath("/job-vacancy-mt");
    return Response.json({ summary });
  } catch (error) {
    if (error instanceof SheetProblem) return Response.json({ error: error.message }, { status: 400 });
    console.error("MT list import failed", error);
    return Response.json({ error: "The file could not be read. Nothing was changed." }, { status: 500 });
  }
}
