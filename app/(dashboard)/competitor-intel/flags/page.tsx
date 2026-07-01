import { RecordManager } from "@/app/_components/record-manager";
import { listCompetitorFlags } from "@/lib/api/competitor-intel";
import { competitorLinks } from "@/lib/records/links";

export default async function CompetitorFlagsPage() {
  return <RecordManager definitionKey="competitor_flags" links={competitorLinks} rows={await listCompetitorFlags()} />;
}
