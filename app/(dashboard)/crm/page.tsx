import { CrmWorkspace } from "@/app/_components/crm-workspace";
import { listBuyersWithTalentMatches } from "@/lib/api/crm";
import { dailyBlastCounts, listEmailBlasts } from "@/lib/api/email-blast";
import { leanRows } from "@/lib/records/lean";

export default async function CrmPage() {
  const [rows, blastHistory, blastDaily] = await Promise.all([
    // created_at stays: it orders a buyer's history when the purchase date is missing.
    listBuyersWithTalentMatches().then((buyers) => leanRows(buyers, ["updated_at"])),
    listEmailBlasts(),
    dailyBlastCounts(),
  ]);
  return <CrmWorkspace rows={rows} blastHistory={blastHistory} blastDaily={blastDaily} />;
}
