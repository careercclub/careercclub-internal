import { RecordManager } from "@/app/_components/record-manager";
import { ResourceTools } from "@/app/_components/resource-tools";
import { listResources } from "@/lib/api/resources";

export default async function ResourcesPage() {
  // Passwords never travel with the page: only "has a password". The value is fetched when someone
  // shows or copies it, and that is logged (revealResourcePasswordAction, Putaran 58).
  const rows = (await listResources()).map(({ password, ...row }) => ({ ...row, has_password: Boolean(password) }));
  return <ResourceTools manage={<RecordManager embedded definitionKey="resources" rows={rows} />} rows={rows} />;
}
