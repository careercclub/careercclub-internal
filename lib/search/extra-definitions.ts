import type { SearchDefinitionInput } from "./registry";

// Tables that have their own module page but are not in the generic record catalog.
// Listed here (search only) instead of the catalog so they do not also gain the
// catalog's generic create/update/delete actions.
export const extraSearchDefinitions: Record<string, SearchDefinitionInput> = {
  mt_prospects: {
    table: "mt_prospects",
    title: "Job Vacancy MT",
    path: "/job-vacancy-mt",
    fields: [
      { name: "brand", label: "Brand" },
      { name: "legal_name", label: "Legal name" },
      { name: "program", label: "Programme", type: "textarea" },
      { name: "industry", label: "Industry" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  mt_prospect_contacts: {
    table: "mt_prospect_contacts",
    title: "MT HR contacts",
    path: "/job-vacancy-mt",
    fields: [
      { name: "name", label: "Name" },
      { name: "title", label: "Job title" },
    ],
  },
};
