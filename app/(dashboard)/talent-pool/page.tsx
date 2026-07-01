import { RecordManager } from "@/app/_components/record-manager";
import { TalentPoolSheetsImport } from "@/app/_components/talent-pool-sheets-import";
import { TalentPoolWorkspace } from "@/app/_components/talent-pool-workspace";
import { listTalentPoolWithBuyerMatches } from "@/lib/api/talent-pool";

export const metadata = { title: "Talent Pool" };

export default async function TalentPoolPage() {
  const rows = await listTalentPoolWithBuyerMatches();
  return <TalentPoolWorkspace rows={rows} sheetsImport={<TalentPoolSheetsImport />} management={<RecordManager definitionKey="talent_pool" rows={rows} />} />;
}
