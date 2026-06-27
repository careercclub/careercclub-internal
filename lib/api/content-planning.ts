import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type ContentPlanRecord = ApiRecord;

const contentPlans = createTableApi<ContentPlanRecord>("content_plans", {
  orderBy: "created_at",
  ascending: false,
});

export const listContentPlans = contentPlans.list;
export const countContentPlans = contentPlans.count;
export const getContentPlan = contentPlans.get;
export const createContentPlan = contentPlans.create;
export const updateContentPlan = contentPlans.update;
export const deleteContentPlan = contentPlans.remove;
