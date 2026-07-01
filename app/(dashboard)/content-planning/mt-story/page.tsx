import { AssetGallery } from "@/app/_components/asset-gallery";
import { RecordManager } from "@/app/_components/record-manager";
import { listMtStories } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export default async function MtStoryPage() { const rows = await listMtStories(); return <RecordManager definitionKey="mt_story_list" links={contentPlanningLinks} rows={rows} tools={<AssetGallery rows={rows} titleField="nama" categoryField="perusahaan" imageFields={["foto_url"]} />} />; }
