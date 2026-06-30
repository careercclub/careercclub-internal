import { RecordManager } from "@/app/_components/record-manager";
import { listStoryPlanItems } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export const metadata = { title: "Story Slides" };

export default async function StorySlidesPage() {
  return <RecordManager definitionKey="story_plan_items" links={contentPlanningLinks} rows={await listStoryPlanItems()} />;
}
