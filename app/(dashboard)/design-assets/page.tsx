import { AssetGallery } from "@/app/_components/asset-gallery";
import { AssetUploadTools } from "@/app/_components/asset-upload-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listDesignAssets } from "@/lib/api/design-assets";
import { compareText } from "@/lib/text/sort";

export default async function DesignAssetsPage() {
  const rows = await listDesignAssets();
  return <AssetGallery title="Design Assets" definitionKey="design_assets" canSendToLibrary categoryField="kategori" imageFields={["storage_paths", "storage_path"]} manage={<RecordManager embedded definitionKey="design_assets" rows={rows} />} rows={rows} titleField="nama" upload={<AssetUploadTools categories={[...new Set(rows.map((row) => String(row.kategori || "")).filter(Boolean))].sort(compareText)} mode="design" />} />;
}
