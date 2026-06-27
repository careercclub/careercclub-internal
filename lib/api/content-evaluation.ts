import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type ContentEvaluationRecord = ApiRecord;

const contentEvaluations = createTableApi<ContentEvaluationRecord>("content_evaluations", {
  orderBy: "tanggal",
  ascending: false,
});

export const listContentEvaluations = contentEvaluations.list;
export const countContentEvaluations = contentEvaluations.count;
export const getContentEvaluation = contentEvaluations.get;
export const createContentEvaluation = contentEvaluations.create;
export const updateContentEvaluation = contentEvaluations.update;
export const deleteContentEvaluation = contentEvaluations.remove;
