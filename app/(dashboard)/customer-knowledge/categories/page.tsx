import { RecordManager } from "@/app/_components/record-manager";
import { listPainPointCategories } from "@/lib/api/customer-knowledge";
import { customerKnowledgeLinks } from "@/lib/records/links";

export default async function PainPointCategoriesPage() {
  return <RecordManager definitionKey="pain_point_categories" links={customerKnowledgeLinks} rows={await listPainPointCategories()} />;
}
