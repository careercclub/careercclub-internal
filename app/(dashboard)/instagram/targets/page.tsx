import { RecordManager } from "@/app/_components/record-manager";
import { listInstagramTargets } from "@/lib/api/instagram";
import { instagramLinks } from "@/lib/records/links";

export default async function InstagramTargetsPage() {
  return <RecordManager definitionKey="ig_targets" links={instagramLinks} rows={await listInstagramTargets()} />;
}
