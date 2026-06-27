import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type MtVacancyRecord = ApiRecord;
export type MtIndustryRecord = ApiRecord;

const vacancies = createTableApi<MtVacancyRecord>("mt_vacancies", {
  orderBy: "created_at",
  ascending: false,
});

const industries = createTableApi<MtIndustryRecord>("mt_industries", {
  orderBy: "nama",
  ascending: true,
});

export const listMtVacancies = vacancies.list;
export const countMtVacancies = vacancies.count;
export const getMtVacancy = vacancies.get;
export const createMtVacancy = vacancies.create;
export const updateMtVacancy = vacancies.update;
export const deleteMtVacancy = vacancies.remove;

export const listMtIndustries = industries.list;
export const createMtIndustry = industries.create;
export const updateMtIndustry = industries.update;
export const deleteMtIndustry = industries.remove;
