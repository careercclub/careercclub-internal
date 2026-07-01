import { ContentEvaluationTools } from "@/app/_components/content-evaluation-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listContentEvaluations } from "@/lib/api/content-evaluation";
import { listBuyers } from "@/lib/api/crm";

export default async function ContentEvaluationPage() {
  const [evaluations, buyers] = await Promise.all([listContentEvaluations(), listBuyers()]);
  return <RecordManager definitionKey="content_evaluations" rows={evaluations} tools={<ContentEvaluationTools evaluations={evaluations} buyers={buyers} />} />;
}
