import { CrmTools } from "@/app/_components/crm-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listBuyersWithTalentMatches } from "@/lib/api/crm";
import { crmLinks } from "@/lib/records/links";

export default async function CrmPage() {
  const rows = await listBuyersWithTalentMatches();
  return <RecordManager definitionKey="buyers" links={crmLinks} rows={rows} tools={<CrmTools rows={rows} />} />;
}
