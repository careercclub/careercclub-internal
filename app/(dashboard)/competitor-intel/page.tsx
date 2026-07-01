import { CompetitorTools } from "@/app/_components/competitor-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { getCompetitorWorkspace } from "@/lib/api/competitor-intel";
import { competitorLinks } from "@/lib/records/links";

export default async function CompetitorIntelPage() {
  const workspace = await getCompetitorWorkspace();
  return <CompetitorTools manage={<RecordManager definitionKey="competitor_profiles" links={competitorLinks} rows={workspace.profiles} />} workspace={workspace} />;
}
