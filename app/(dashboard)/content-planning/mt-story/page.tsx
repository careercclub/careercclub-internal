import { RecordManager } from "@/app/_components/record-manager";
import { listMtStories } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export const metadata = { title: "MT Story" };

export default async function MtStoryPage() {
  return <RecordManager definitionKey="mt_story_list" links={contentPlanningLinks} rows={await listMtStories()} />;
}
