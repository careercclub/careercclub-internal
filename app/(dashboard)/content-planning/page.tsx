import { ContentPlanningTools } from "@/app/_components/content-planning-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { StoryPlanAiParser } from "@/app/_components/story-plan-ai-parser";
import { listCarouselCtas, listCarouselPlanLinks, listCarouselPlans, listKols, listMtStories, listStoryPlanDates, listStoryPlanItems, listStoryPlanLinks } from "@/lib/api/content-planning";

export const metadata = { title: "Content Planning" };

export default async function ContentPlanningPage() {
  const [dates, stories, storyLinks, carousels, carouselLinks, ctas, kols, mtStories] = await Promise.all([listStoryPlanDates(), listStoryPlanItems(), listStoryPlanLinks(), listCarouselPlans(), listCarouselPlanLinks(), listCarouselCtas(), listKols(), listMtStories()]);
  return <ContentPlanningTools dates={dates} stories={stories} storyLinks={storyLinks} carousels={carousels} carouselLinks={carouselLinks} ctas={ctas} kols={kols} mtStories={mtStories} management={<><StoryPlanAiParser /><RecordManager definitionKey="story_plan_dates" rows={dates}/></>} />;
}
