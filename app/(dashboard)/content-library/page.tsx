import { AssetGallery } from "@/app/_components/asset-gallery";
import { AssetUploadTools } from "@/app/_components/asset-upload-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listContentLibraryItems } from "@/lib/api/content-library";

export default async function ContentLibraryPage() {
  const rows = await listContentLibraryItems();
  return <AssetGallery categoryField="platform" imageFields={["storage_paths"]} manage={<RecordManager definitionKey="content_library" rows={rows} />} rows={rows} titleField="copywriting" upload={<AssetUploadTools mode="content" />} />;
}
