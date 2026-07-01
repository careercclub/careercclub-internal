import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type ContentPlanRecord = ApiRecord;
export type StoryPlanDateRecord = ApiRecord;
export type StoryPlanItemRecord = ApiRecord;
export type StoryPlanLinkRecord = ApiRecord;
export type CarouselPlanRecord = ApiRecord;
export type CarouselCtaRecord = ApiRecord;
export type CarouselPlanLinkRecord = ApiRecord;
export type KolRecord = ApiRecord;
export type MtStoryRecord = ApiRecord;

const contentPlans = createTableApi<ContentPlanRecord>("content_plans", { orderBy: "created_at", ascending: false });
const storyDates = createTableApi<StoryPlanDateRecord>("story_plan_dates", { orderBy: "tanggal" });
const storyItems = createTableApi<StoryPlanItemRecord>("story_plan_items", { orderBy: "urutan" });
const storyLinks = createTableApi<StoryPlanLinkRecord>("story_plan_links", { orderBy: "created_at" });
const carouselPlans = createTableApi<CarouselPlanRecord>("carousel_plans", { orderBy: "tanggal_posting" });
const carouselCtas = createTableApi<CarouselCtaRecord>("carousel_cta_options", { orderBy: "label" });
const carouselLinks = createTableApi<CarouselPlanLinkRecord>("carousel_plan_links", { orderBy: "created_at" });
const kols = createTableApi<KolRecord>("kol_list", { orderBy: "created_at", ascending: false });
const mtStories = createTableApi<MtStoryRecord>("mt_story_list", { orderBy: "created_at", ascending: false });

export const listContentPlans = contentPlans.list;
export const countContentPlans = contentPlans.count;
export const getContentPlan = contentPlans.get;
export const createContentPlan = contentPlans.create;
export const updateContentPlan = contentPlans.update;
export const deleteContentPlan = contentPlans.remove;

export const listStoryPlanDates = storyDates.list;
export const createStoryPlanDate = storyDates.create;
export const updateStoryPlanDate = storyDates.update;
export const deleteStoryPlanDate = storyDates.remove;
export const listStoryPlanItems = storyItems.list;
export const createStoryPlanItem = storyItems.create;
export const updateStoryPlanItem = storyItems.update;
export const deleteStoryPlanItem = storyItems.remove;
export const listStoryPlanLinks = storyLinks.list;
export const createStoryPlanLink = storyLinks.create;
export const deleteStoryPlanLink = storyLinks.remove;

export const listCarouselPlans = carouselPlans.list;
export const createCarouselPlan = carouselPlans.create;
export const updateCarouselPlan = carouselPlans.update;
export const deleteCarouselPlan = carouselPlans.remove;
export const listCarouselCtas = carouselCtas.list;
export const createCarouselCta = carouselCtas.create;
export const deleteCarouselCta = carouselCtas.remove;
export const listCarouselPlanLinks = carouselLinks.list;
export const createCarouselPlanLink = carouselLinks.create;
export const deleteCarouselPlanLink = carouselLinks.remove;

export const listKols = kols.list;
export const createKol = kols.create;
export const updateKol = kols.update;
export const deleteKol = kols.remove;
export const listMtStories = mtStories.list;
export const createMtStory = mtStories.create;
export const updateMtStory = mtStories.update;
export const deleteMtStory = mtStories.remove;

export function createStoryPlanWithItems(input: { tanggal: string; status?: string; items: Array<{ urutan?: number; isi?: string }> }) {
  const status = input.status === "Done" ? "Done" : "Draft";
  const items = input.items.slice(0, 30).map((item, index) => ({ urutan: Number(item.urutan) || index + 1, isi: String(item.isi || "").trim() })).filter((item) => item.isi);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tanggal)) throw new Error("A valid story date is required.");
  if (!items.length) throw new Error("At least one story slide is required.");

  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const [date] = await tx<{ id: string }[]>`
      insert into story_plan_dates (tanggal, status)
      values (${input.tanggal}, ${status})
      returning id
    `;
    for (const item of items) {
      await tx`insert into story_plan_items (date_id, urutan, isi) values (${date.id}::uuid, ${item.urutan}, ${item.isi})`;
    }
    return date.id;
  }));
}
