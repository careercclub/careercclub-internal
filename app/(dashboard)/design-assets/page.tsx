import { AssetGallery } from "@/app/_components/asset-gallery";
import { AssetUploadTools } from "@/app/_components/asset-upload-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listDesignAssets } from "@/lib/api/design-assets";

export default async function DesignAssetsPage() {
  const rows = await listDesignAssets();
  return <RecordManager definitionKey="design_assets" rows={rows} tools={<><AssetUploadTools mode="design" /><AssetGallery rows={rows} titleField="nama" categoryField="kategori" imageFields={["storage_paths", "storage_path"]} canSendToLibrary /></>} />;
}
