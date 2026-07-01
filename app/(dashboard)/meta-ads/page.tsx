import { MetaAdsTools } from "@/app/_components/meta-ads-tools";
import { listAdsContents } from "@/lib/api/meta-ads";

export default async function MetaAdsPage() {
  const rows = await listAdsContents();
  return <MetaAdsTools rows={rows} />;
}
