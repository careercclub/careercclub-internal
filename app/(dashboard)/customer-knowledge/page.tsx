import { CustomerKnowledgeWorkspace } from "@/app/_components/customer-knowledge-workspace";
import { listFreeClassEvaluations, listPainPointCategories, listPainPointPlatforms, listPainPoints } from "@/lib/api/customer-knowledge";

export const metadata = { title: "Customer Knowledge" };

export default async function CustomerKnowledgePage() {
  const [rows, platforms, categories, freeClassRows] = await Promise.all([
    listPainPoints(), listPainPointPlatforms(), listPainPointCategories(), listFreeClassEvaluations(),
  ]);

  return <CustomerKnowledgeWorkspace categories={categories} freeClassRows={freeClassRows} platforms={platforms} rows={rows} />;
}
