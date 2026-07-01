import { CrmWorkspace } from "@/app/_components/crm-workspace";
import { listBuyersWithTalentMatches } from "@/lib/api/crm";

export default async function CrmPage() {
  return <CrmWorkspace rows={await listBuyersWithTalentMatches()} />;
}
