import { PipelineBoard } from "@/app/_components/pipeline-board";
import { RecordManager } from "@/app/_components/record-manager";
import { listCrmDealsWithBuyers } from "@/lib/api/crm";
import { crmLinks } from "@/lib/records/links";

const stages = ["Belum diblast", "Diblast", "Sedang di-upsell", "Sedang di-downsell", "Convert"] as const;

export default async function CrmDealsPage() {
  const rows = await listCrmDealsWithBuyers();
  return <RecordManager definitionKey="crm_deals" links={crmLinks} rows={rows} tools={<PipelineBoard rows={rows} table="crm_deals" statusField="stage" titleField="buyer_name" subtitleField="produk_target" statuses={stages} />} />;
}
