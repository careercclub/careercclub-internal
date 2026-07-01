import { MetaAdsTools } from "@/app/_components/meta-ads-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listAdsContents } from "@/lib/api/meta-ads";

export default async function MetaAdsPage() {
  const rows = await listAdsContents();
  return <RecordManager definitionKey="ads_contents" rows={rows} tools={<MetaAdsTools rows={rows} />} />;
}
