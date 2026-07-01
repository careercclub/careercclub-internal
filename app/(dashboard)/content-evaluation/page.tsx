import { ContentEvaluationTools } from "@/app/_components/content-evaluation-tools";
import { listContentEvaluations } from "@/lib/api/content-evaluation";
import { listBuyers } from "@/lib/api/crm";

export default async function ContentEvaluationPage() {
  const [evaluations, buyers] = await Promise.all([listContentEvaluations(), listBuyers()]);
  return <ContentEvaluationTools evaluations={evaluations} buyers={buyers} />;
}
