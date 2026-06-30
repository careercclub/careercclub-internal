import { RecordManager } from "@/app/_components/record-manager";
import { listStoryPlanDates } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export const metadata = { title: "Content Planning" };

export default async function ContentPlanningPage() {
  return <RecordManager definitionKey="story_plan_dates" links={contentPlanningLinks} rows={await listStoryPlanDates()} />;
}
