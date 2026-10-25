import { getSheetSync } from "@/lib/api/sheet-sync";
import { ContentEvaluationTools } from "@/app/_components/content-evaluation-tools";
import { listContentEvaluationsForPage } from "@/lib/api/content-evaluation";
import { getStoryBuyerSummary } from "@/lib/api/crm";

export default async function ContentEvaluationPage() {
  const [evaluations, buyers, sheetSync] = await Promise.all([listContentEvaluationsForPage(), getStoryBuyerSummary(), getSheetSync("instagram").catch(() => null)]);
  return <ContentEvaluationTools buyerTotal={buyers.total} buyers={buyers.storyBuyers} evaluations={evaluations} sheetSync={sheetSync} />;
}
