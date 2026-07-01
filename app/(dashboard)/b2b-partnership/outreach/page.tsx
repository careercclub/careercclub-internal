import { RecordManager } from "@/app/_components/record-manager";
import { listPartnerOutreach } from "@/lib/api/b2b-partnership";
import { partnershipLinks } from "@/lib/records/links";

export default async function PartnerOutreachPage() {
  return <RecordManager definitionKey="partner_outreach" links={partnershipLinks} rows={await listPartnerOutreach()} />;
}
