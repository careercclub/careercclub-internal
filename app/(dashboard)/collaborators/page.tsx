import { CollaboratorWorkspace } from "@/app/_components/collaborator-workspace";
import { RecordManager } from "@/app/_components/record-manager";
import { listCollaborators } from "@/lib/api/collaborators";

export const metadata = { title: "Collaborators" };

export default async function CollaboratorsPage() {
  const rows = await listCollaborators();
  return <CollaboratorWorkspace rows={rows} management={<RecordManager definitionKey="collaborators" rows={rows}/>} />;
}
