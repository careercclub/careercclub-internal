import { RecordManager } from "@/app/_components/record-manager";
import { listCollaborators } from "@/lib/api/collaborators";

export const metadata = { title: "Collaborators" };

export default async function CollaboratorsPage() {
  return <RecordManager definitionKey="collaborators" rows={await listCollaborators()} />;
}
