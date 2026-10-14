import type { SearchDefinitionInput } from "./registry";

// Tables that have their own module page but are not in the generic record catalog.
// Listed here (search only) instead of the catalog so they do not also gain the
// catalog's generic create/update/delete actions.
export const extraSearchDefinitions: Record<string, SearchDefinitionInput> = {
  mt_vacancies: {
    table: "mt_vacancies",
    title: "Job Vacancy MT",
    path: "/job-vacancy-mt",
    fields: [
      { name: "company", label: "Perusahaan" },
      { name: "program", label: "Program" },
      { name: "industry", label: "Industri" },
      { name: "roles", label: "Role", type: "text-array" },
      { name: "placement", label: "Penempatan", type: "text-array" },
      { name: "majors", label: "Jurusan", type: "text-array" },
      { name: "selection", label: "Tahap seleksi", type: "text-array" },
      { name: "edu", label: "Pendidikan" },
      { name: "other_req", label: "Syarat lain", type: "textarea" },
      { name: "status", label: "Status" },
      { name: "notes", label: "Catatan", type: "textarea" },
    ],
  },
};
