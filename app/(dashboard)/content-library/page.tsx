import { AssetGallery } from "@/app/_components/asset-gallery";
import { AssetUploadTools } from "@/app/_components/asset-upload-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listContentLibraryItems } from "@/lib/api/content-library";

export default async function ContentLibraryPage() {
  const rows = await listContentLibraryItems();
  return <RecordManager definitionKey="content_library" rows={rows} tools={<><AssetUploadTools mode="content" /><AssetGallery rows={rows} titleField="copywriting" categoryField="platform" imageFields={["storage_paths"]} /></>} />;
}
