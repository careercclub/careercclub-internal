import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
import { PartnershipWorkspace } from "@/app/_components/partnership-workspace";
import { listPartnerDeals, listPartnerOutreach, listPartners } from "@/lib/api/b2b-partnership";

export const metadata = { title: "B2B Partnership" };

const statuses = ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"] as const;
const categories = ["MT Program Company", "HR Services Company"];

export default async function B2bPartnershipPage() {
  const [rows, deals, outreach] = await Promise.all([listPartners(), listPartnerDeals(), listPartnerOutreach()]);
  const parser = (
    <AiTextRecordParser
      definitionKey="partners"
      kind="partnership"
      title="Input dengan AI"
      fields={[{ name: "name", label: "Company", required: true }, { name: "category", label: "Category" }, { name: "tier", label: "Tier", type: "select", options: ["Strategic", "Standard"] }, { name: "status", label: "Status", type: "select", options: [...statuses] }, { name: "contact_name", label: "PIC" }, { name: "contact_email", label: "PIC email" }, { name: "contact_phone", label: "PIC WhatsApp" }, { name: "scope", label: "Scope", type: "textarea" }, { name: "notes", label: "Notes", type: "textarea" }, { name: "input_date", label: "Input date", type: "date" }]}
    />
  );
  return (
    <PartnershipWorkspace
      title="B2B Partnership"
      entityLabel="partner"
      rows={rows}
      deals={deals}
      outreach={outreach}
      tableKey="partners"
      dealsKey="partner_deals"
      outreachKey="partner_outreach"
      partnerField="partner_id"
      categories={categories}
      aiPanel={parser}
    />
  );
}
