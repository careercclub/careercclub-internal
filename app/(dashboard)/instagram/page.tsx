import { InstagramTools } from "@/app/_components/instagram-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listInstagramSnapshots, listInstagramTargets } from "@/lib/api/instagram";
import { instagramLinks } from "@/lib/records/links";

export default async function InstagramPage() {
  const [snapshots, targets] = await Promise.all([listInstagramSnapshots(), listInstagramTargets()]);
  return <RecordManager definitionKey="ig_snapshots" links={instagramLinks} rows={snapshots} tools={<InstagramTools snapshots={snapshots} targets={targets} referenceDate={new Date().toISOString()} />} />;
}
