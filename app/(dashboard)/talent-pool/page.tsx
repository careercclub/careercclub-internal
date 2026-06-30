import { RecordManager } from "@/app/_components/record-manager";
import { listTalentPoolWithBuyerMatches } from "@/lib/api/talent-pool";

export const metadata = { title: "Talent Pool" };

export default async function TalentPoolPage() {
  return <RecordManager definitionKey="talent_pool" rows={await listTalentPoolWithBuyerMatches()} />;
}
