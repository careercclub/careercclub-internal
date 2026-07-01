import { RecordManager } from "@/app/_components/record-manager";
import { listPartnerDeals } from "@/lib/api/b2b-partnership";
import { partnershipLinks } from "@/lib/records/links";

export default async function PartnerDealsPage() {
  return <RecordManager definitionKey="partner_deals" links={partnershipLinks} rows={await listPartnerDeals()} />;
}
