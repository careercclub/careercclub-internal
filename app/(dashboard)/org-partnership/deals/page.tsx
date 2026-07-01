import { RecordManager } from "@/app/_components/record-manager";
import { listOrgDeals } from "@/lib/api/org-partnership";
import { orgPartnershipLinks } from "@/lib/records/links";

export default async function OrgDealsPage() {
  return <RecordManager definitionKey="org_deals" links={orgPartnershipLinks} rows={await listOrgDeals()} />;
}
