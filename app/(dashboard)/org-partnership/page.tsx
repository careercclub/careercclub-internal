import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
import { PipelineBoard } from "@/app/_components/pipeline-board";
import { PartnershipWorkspace } from "@/app/_components/partnership-workspace";
import { RecordManager } from "@/app/_components/record-manager";
import { listOrgPartners } from "@/lib/api/org-partnership";

const statuses = ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"] as const;

export default async function OrgPartnershipPage() {
  const rows = await listOrgPartners();
  const parser=<AiTextRecordParser definitionKey="org_partners" kind="partnership" title="Create organization from text" fields={[{ name: "name", label: "Organization", required: true }, { name: "category", label: "Category" }, { name: "tier", label: "Tier", type: "select", options: ["Strategic", "Standard"] }, { name: "status", label: "Status", type: "select", options: [...statuses] }, { name: "contact_name", label: "PIC" }, { name: "contact_email", label: "PIC email" }, { name: "contact_phone", label: "PIC WhatsApp" }, { name: "scope", label: "Scope", type: "textarea" }, { name: "notes", label: "Notes", type: "textarea" }, { name: "input_date", label: "Input date", type: "date" }]}/>;
  return <PartnershipWorkspace rows={rows} title="Organization Partnership" entityLabel="organizations" pipeline={<PipelineBoard rows={rows} table="org_partners" statusField="status" titleField="name" subtitleField="contact_name" statuses={statuses}/>} management={<RecordManager definitionKey="org_partners" rows={rows} tools={parser}/>}/>;
}
