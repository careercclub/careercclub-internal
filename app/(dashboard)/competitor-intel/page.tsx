import { CompetitorTools } from "@/app/_components/competitor-tools";
import { getCompetitorWorkspace } from "@/lib/api/competitor-intel";

export const metadata = { title: "Competitor Intel" };

export default async function CompetitorIntelPage() {
  const workspace = await getCompetitorWorkspace();
  return <CompetitorTools workspace={workspace} />;
}
