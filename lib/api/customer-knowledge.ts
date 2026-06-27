import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type PainPointRecord = ApiRecord;
export type PainPointPlatformRecord = ApiRecord;
export type PainPointCategoryRecord = ApiRecord;
export type FreeClassEvalRecord = ApiRecord;

const painPoints = createTableApi<PainPointRecord>("pain_points", {
  orderBy: "created_at",
  ascending: false,
});

const platforms = createTableApi<PainPointPlatformRecord>("pain_point_platforms", {
  orderBy: "nama",
  ascending: true,
});

const categories = createTableApi<PainPointCategoryRecord>("pain_point_categories", {
  orderBy: "nama",
  ascending: true,
});

const freeClassEval = createTableApi<FreeClassEvalRecord>("free_class_eval", {
  orderBy: "created_at",
  ascending: false,
});

export const listPainPoints = painPoints.list;
export const countPainPoints = painPoints.count;
export const getPainPoint = painPoints.get;
export const createPainPoint = painPoints.create;
export const updatePainPoint = painPoints.update;
export const deletePainPoint = painPoints.remove;

export const listPainPointPlatforms = platforms.list;
export const createPainPointPlatform = platforms.create;
export const updatePainPointPlatform = platforms.update;
export const deletePainPointPlatform = platforms.remove;

export const listPainPointCategories = categories.list;
export const createPainPointCategory = categories.create;
export const updatePainPointCategory = categories.update;
export const deletePainPointCategory = categories.remove;

export const listFreeClassEvaluations = freeClassEval.list;
export const createFreeClassEvaluation = freeClassEval.create;
export const updateFreeClassEvaluation = freeClassEval.update;
export const deleteFreeClassEvaluation = freeClassEval.remove;
