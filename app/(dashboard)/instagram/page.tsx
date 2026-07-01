import { InstagramTools } from "@/app/_components/instagram-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { getInstagramBaseline, listInstagramSnapshots, listInstagramTargets } from "@/lib/api/instagram";

export default async function InstagramPage() {
  const [snapshots, targets, baseline] = await Promise.all([listInstagramSnapshots(), listInstagramTargets(), getInstagramBaseline()]);
  return <InstagramTools snapshots={snapshots} targets={targets} baseline={baseline} referenceDate={new Date().toISOString()} snapshotManagement={<RecordManager definitionKey="ig_snapshots" rows={snapshots}/>} targetManagement={<RecordManager definitionKey="ig_targets" rows={targets}/>} />;
}
