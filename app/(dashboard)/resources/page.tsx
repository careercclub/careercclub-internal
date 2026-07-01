import { RecordManager } from "@/app/_components/record-manager";
import { ResourceTools } from "@/app/_components/resource-tools";
import { listResources } from "@/lib/api/resources";

export default async function ResourcesPage() {
  const rows = await listResources();
  return <ResourceTools manage={<RecordManager definitionKey="resources" rows={rows} />} rows={rows} />;
}
