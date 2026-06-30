import { navSections, type ModulePage } from "./navigation";

const additionalPages: ModulePage[] = [
  {
    slug: "talent-pool",
    title: "Talent Pool",
    path: "/talent-pool",
    section: "Operations",
    icon: "ti-user-search",
    kind: "table",
    description: "Candidate profiles linked to CRM buyers through normalized email and WhatsApp data.",
    primaryAction: "Add candidate",
    tabs: ["Candidates", "Pipeline", "Buyer matches"],
    stats: [],
  },
  {
    slug: "collaborators",
    title: "Collaborators",
    path: "/collaborators",
    section: "Internal",
    icon: "ti-address-book",
    kind: "table",
    description: "Operational directory for collaborators, advisors, obligations, and services.",
    primaryAction: "Add collaborator",
    tabs: ["Directory", "Obligations", "Services"],
    stats: [],
  },
];

export const enhancedNavSections = navSections.map((section) => ({
  ...section,
  pages: [...section.pages, ...additionalPages.filter((page) => page.section === section.label)],
}));
