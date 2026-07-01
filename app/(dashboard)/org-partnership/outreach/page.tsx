import { RecordManager } from "@/app/_components/record-manager";
import { listOrgOutreach } from "@/lib/api/org-partnership";
import { orgPartnershipLinks } from "@/lib/records/links";

export default async function OrgOutreachPage() {
  return <RecordManager definitionKey="org_outreach" links={orgPartnershipLinks} rows={await listOrgOutreach()} />;
}
