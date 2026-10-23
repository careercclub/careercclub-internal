import { ContentEvaluationTools } from "@/app/_components/content-evaluation-tools";
import { listContentEvaluations } from "@/lib/api/content-evaluation";
import { getStoryBuyerSummary } from "@/lib/api/crm";

export default async function ContentEvaluationPage() {
  const [evaluations, buyers] = await Promise.all([listContentEvaluations(), getStoryBuyerSummary()]);
  return <ContentEvaluationTools buyerTotal={buyers.total} buyers={buyers.storyBuyers} evaluations={evaluations} />;
}
