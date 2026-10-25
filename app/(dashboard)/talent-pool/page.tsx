import { RecordManager } from "@/app/_components/record-manager";
import { TalentPoolSheetsImport } from "@/app/_components/talent-pool-sheets-import";
import { TalentPoolWorkspace } from "@/app/_components/talent-pool-workspace";
import { listTalentPoolWithBuyerMatches } from "@/lib/api/talent-pool";
import { getSheetSync } from "@/lib/api/sheet-sync";
import { leanRows } from "@/lib/records/lean";

export const metadata = { title: "Talent Pool" };

export default async function TalentPoolPage() {
  // Empty fields and timestamps are not shown anywhere on the page; leaving them out keeps the page light.
  const [all, sync] = await Promise.all([listTalentPoolWithBuyerMatches(), getSheetSync("talent-pool").catch(() => null)]);
  const rows = leanRows(all, ["created_at", "updated_at"]);
  return <TalentPoolWorkspace rows={rows} sheetsImport={<TalentPoolSheetsImport sync={sync} />} management={<RecordManager embedded definitionKey="talent_pool" rows={rows} />} />;
}
