import { AssetGallery } from "@/app/_components/asset-gallery";
import { RecordManager } from "@/app/_components/record-manager";
import { listCollaborators } from "@/lib/api/collaborators";

export const metadata = { title: "Collaborators" };

export default async function CollaboratorsPage() {
  const rows = await listCollaborators();
  return <RecordManager definitionKey="collaborators" rows={rows} tools={<AssetGallery rows={rows} titleField="nama" categoryField="tipe" imageFields={["foto_url"]} />} />;
}
