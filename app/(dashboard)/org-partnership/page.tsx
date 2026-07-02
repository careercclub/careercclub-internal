import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
import { PartnershipWorkspace } from "@/app/_components/partnership-workspace";
import { listOrgDeals, listOrgOutreach, listOrgPartners } from "@/lib/api/org-partnership";

export const metadata = { title: "Organization Partnership" };

const statuses = ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"] as const;
const categories = ["BEM / Organisasi Mahasiswa", "Career Center", "Himpunan Mahasiswa", "Unit Kemahasiswaan", "Lainnya"];

export default async function OrgPartnershipPage() {
  const [rows, deals, outreach] = await Promise.all([listOrgPartners(), listOrgDeals(), listOrgOutreach()]);
  const parser = (
    <AiTextRecordParser
      definitionKey="org_partners"
      kind="partnership"
      title="Input dengan AI"
      fields={[{ name: "name", label: "Organization", required: true }, { name: "category", label: "Category" }, { name: "tier", label: "Tier", type: "select", options: ["Strategic", "Standard"] }, { name: "status", label: "Status", type: "select", options: [...statuses] }, { name: "contact_name", label: "PIC" }, { name: "contact_email", label: "PIC email" }, { name: "contact_phone", label: "PIC WhatsApp" }, { name: "scope", label: "Scope", type: "textarea" }, { name: "notes", label: "Notes", type: "textarea" }, { name: "input_date", label: "Input date", type: "date" }]}
    />
  );
  return (
    <PartnershipWorkspace
      title="Organization Partnership"
      entityLabel="organisasi"
      rows={rows}
      deals={deals}
      outreach={outreach}
      tableKey="org_partners"
      dealsKey="org_deals"
      outreachKey="org_outreach"
      partnerField="org_partner_id"
      categories={categories}
      aiPanel={parser}
    />
  );
}
