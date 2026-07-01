import { ContentPlanningTools } from "@/app/_components/content-planning-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { StoryPlanAiParser } from "@/app/_components/story-plan-ai-parser";
import { listCarouselPlans, listKols, listMtStories, listStoryPlanDates, listStoryPlanItems } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export const metadata = { title: "Content Planning" };

export default async function ContentPlanningPage() {
  const [dates, stories, carousels, kols, mtStories] = await Promise.all([listStoryPlanDates(), listStoryPlanItems(), listCarouselPlans(), listKols(), listMtStories()]);
  return <RecordManager definitionKey="story_plan_dates" links={contentPlanningLinks} rows={dates} tools={<><StoryPlanAiParser /><ContentPlanningTools dates={dates} stories={stories} carousels={carousels} kols={kols} mtStories={mtStories} /></>} />;
}
