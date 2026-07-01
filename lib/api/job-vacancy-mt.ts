import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

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

function list(value: unknown) { return Array.isArray(value) ? value.map(String) : String(value || "").split(/[;,|]/).map((item) => item.trim()).filter(Boolean); }

export function importMtVacancies(rows: Array<Record<string, unknown>>) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    let inserted = 0; let updated = 0;
    for (const row of rows) {
      const company = String(row.company || "").trim(); const program = String(row.program || "").trim();
      if (!company || !program) continue;
      const year = String(row.year || "").trim();
      const deadline = String(row.deadline || "").trim() || null;
      const openDate = String(row.open_date || "").trim() || null;
      const [existing] = await tx<{ id: string }[]>`select id from mt_vacancies where lower(company) = lower(${company}) and lower(program) = lower(${program}) and coalesce(year::text, '') = ${year} limit 1`;
      const values = {
        company, program, industry: String(row.industry || ""), roles: list(row.roles), selection: list(row.selection),
        career_links: list(row.career_links), ref_links: list(row.ref_links), deadline,
        status: String(row.status || "Active"), gpa: String(row.gpa || ""), edu: String(row.edu || ""), majors: list(row.majors),
        placement: list(row.placement), other_req: String(row.other_req || ""), duration: String(row.duration || ""),
        months: list(row.months), year, open_date: openDate, notes: String(row.notes || ""),
      };
      if (existing) { await tx`update mt_vacancies set ${tx(values)} where id = ${existing.id}`; updated += 1; }
      else { await tx`insert into mt_vacancies ${tx(values)}`; inserted += 1; }
    }
    return { inserted, updated };
  }));
}
