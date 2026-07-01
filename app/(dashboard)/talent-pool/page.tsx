import { RecordManager } from "@/app/_components/record-manager";
import { TalentPoolTools } from "@/app/_components/talent-pool-tools";
import { listTalentPoolWithBuyerMatches } from "@/lib/api/talent-pool";

export const metadata = { title: "Talent Pool" };

export default async function TalentPoolPage() {
  const rows = await listTalentPoolWithBuyerMatches();
  return <RecordManager definitionKey="talent_pool" rows={rows} tools={<TalentPoolTools rows={rows} />} />;
}
