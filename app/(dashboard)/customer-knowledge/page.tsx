import { CustomerKnowledgeWorkspace } from "@/app/_components/customer-knowledge-workspace";
import { getSheetSync } from "@/lib/api/sheet-sync";
import { listFreeClassEvaluations, listPainPointCategories, listPainPointPlatforms, listPainPoints } from "@/lib/api/customer-knowledge";

export const metadata = { title: "Customer Knowledge" };

export default async function CustomerKnowledgePage() {
  const [rows, platforms, categories, freeClassRows, sheetSync] = await Promise.all([
    listPainPoints(), listPainPointPlatforms(), listPainPointCategories(), listFreeClassEvaluations(), getSheetSync("customer-knowledge").catch(() => null),
  ]);

  return <CustomerKnowledgeWorkspace categories={categories} freeClassRows={freeClassRows} platforms={platforms} rows={rows} sheetSync={sheetSync} />;
}
