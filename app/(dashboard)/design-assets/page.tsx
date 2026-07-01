import { AssetGallery } from "@/app/_components/asset-gallery";
import { AssetUploadTools } from "@/app/_components/asset-upload-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listDesignAssets } from "@/lib/api/design-assets";

export default async function DesignAssetsPage() {
  const rows = await listDesignAssets();
  return <AssetGallery canSendToLibrary categoryField="kategori" imageFields={["storage_paths", "storage_path"]} manage={<RecordManager definitionKey="design_assets" rows={rows} />} rows={rows} titleField="nama" upload={<AssetUploadTools mode="design" />} />;
}
