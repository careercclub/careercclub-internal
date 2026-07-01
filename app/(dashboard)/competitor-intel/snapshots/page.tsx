import { RecordManager } from "@/app/_components/record-manager";
import { listCompetitorSnapshots } from "@/lib/api/competitor-intel";
import { competitorLinks } from "@/lib/records/links";

export default async function CompetitorSnapshotsPage() {
  return <RecordManager definitionKey="competitor_snapshots" links={competitorLinks} rows={await listCompetitorSnapshots()} />;
}
