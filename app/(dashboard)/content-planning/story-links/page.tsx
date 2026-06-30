import { RecordManager } from "@/app/_components/record-manager";
import { listStoryPlanLinks } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export default async function StoryLinksPage() {
  return <RecordManager definitionKey="story_plan_links" links={contentPlanningLinks} rows={await listStoryPlanLinks()} />;
}
