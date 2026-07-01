import { FreeClassTools } from "@/app/_components/free-class-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listFreeClassEvaluations } from "@/lib/api/customer-knowledge";

export default async function FreeClassEvaluationPage() {
  const rows = await listFreeClassEvaluations();
  return <FreeClassTools rows={rows} management={<RecordManager definitionKey="free_class_eval" rows={rows}/>} />;
}
