import { FreeClassTools } from "@/app/_components/free-class-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listFreeClassEvaluations } from "@/lib/api/customer-knowledge";
import { customerKnowledgeLinks } from "@/lib/records/links";

export default async function FreeClassEvaluationPage() {
  const rows = await listFreeClassEvaluations();
  return <RecordManager definitionKey="free_class_eval" links={customerKnowledgeLinks} rows={rows} tools={<FreeClassTools rows={rows} />} />;
}
