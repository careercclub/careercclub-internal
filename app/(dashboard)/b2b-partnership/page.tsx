import { PipelineBoard } from "@/app/_components/pipeline-board";
import { RecordManager } from "@/app/_components/record-manager";
import { listPartners } from "@/lib/api/b2b-partnership";
import { partnershipLinks } from "@/lib/records/links";

const statuses = ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"] as const;

export default async function B2bPartnershipPage() {
  const rows = await listPartners();
  return <RecordManager definitionKey="partners" links={partnershipLinks} rows={rows} tools={<><AiTextRecordParser definitionKey="partners" kind="partnership" title="Create partner from text" fields={[{ name: "name", label: "Company", required: true }, { name: "category", label: "Category" }, { name: "tier", label: "Tier", type: "select", options: ["Strategic", "Standard"] }, { name: "status", label: "Status", type: "select", options: [...statuses] }, { name: "contact_name", label: "PIC" }, { name: "contact_email", label: "PIC email" }, { name: "contact_phone", label: "PIC WhatsApp" }, { name: "scope", label: "Scope", type: "textarea" }, { name: "notes", label: "Notes", type: "textarea" }, { name: "input_date", label: "Input date", type: "date" }]} /><PipelineBoard rows={rows} table="partners" statusField="status" titleField="name" subtitleField="contact_name" statuses={statuses} /></>} />;
}
import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
