import { PipelineBoard } from "@/app/_components/pipeline-board";
import { PartnershipWorkspace } from "@/app/_components/partnership-workspace";
import { RecordManager } from "@/app/_components/record-manager";
import { listPartners } from "@/lib/api/b2b-partnership";

const statuses = ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"] as const;

export default async function B2bPartnershipPage() {
  const rows = await listPartners();
  const parser=<AiTextRecordParser definitionKey="partners" kind="partnership" title="Create partner from text" fields={[{ name: "name", label: "Company", required: true }, { name: "category", label: "Category" }, { name: "tier", label: "Tier", type: "select", options: ["Strategic", "Standard"] }, { name: "status", label: "Status", type: "select", options: [...statuses] }, { name: "contact_name", label: "PIC" }, { name: "contact_email", label: "PIC email" }, { name: "contact_phone", label: "PIC WhatsApp" }, { name: "scope", label: "Scope", type: "textarea" }, { name: "notes", label: "Notes", type: "textarea" }, { name: "input_date", label: "Input date", type: "date" }]}/>;
  return <PartnershipWorkspace rows={rows} title="B2B Partnership" entityLabel="companies" pipeline={<PipelineBoard rows={rows} table="partners" statusField="status" titleField="name" subtitleField="contact_name" statuses={statuses}/>} management={<RecordManager definitionKey="partners" rows={rows} tools={parser}/>}/>;
}
import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
