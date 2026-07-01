import { AssetGallery } from "@/app/_components/asset-gallery";
import { RecordManager } from "@/app/_components/record-manager";
import { listKols } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export default async function KolPage() { const rows = await listKols(); return <RecordManager definitionKey="kol_list" links={contentPlanningLinks} rows={rows} tools={<AssetGallery rows={rows} titleField="nama" categoryField="platform" imageFields={["foto_url"]} />} />; }
