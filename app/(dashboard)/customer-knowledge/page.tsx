import { PainPointAiParser } from "@/app/_components/pain-point-ai-parser";
import { RecordManager } from "@/app/_components/record-manager";
import { listPainPointCategories, listPainPoints } from "@/lib/api/customer-knowledge";
import { customerKnowledgeLinks } from "@/lib/records/links";

export const metadata = { title: "Customer Knowledge" };

export default async function CustomerKnowledgePage() {
  const [rows, categoryRows] = await Promise.all([listPainPoints(), listPainPointCategories()]);
  const categories = categoryRows
    .map((row) => String(row.nama || "").trim())
    .filter(Boolean);

  return (
    <RecordManager
      definitionKey="pain_points"
      links={customerKnowledgeLinks}
      rows={rows}
      tools={<PainPointAiParser categories={categories} />}
    />
  );
}
