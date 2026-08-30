import { CrmWorkspace } from "@/app/_components/crm-workspace";
import { listBuyersWithTalentMatches } from "@/lib/api/crm";
import { dailyBlastCounts, listEmailBlasts } from "@/lib/api/email-blast";

export default async function CrmPage() {
  const [rows, blastHistory, blastDaily] = await Promise.all([
    listBuyersWithTalentMatches(),
    listEmailBlasts(),
    dailyBlastCounts(),
  ]);
  return <CrmWorkspace rows={rows} blastHistory={blastHistory} blastDaily={blastDaily} />;
}
