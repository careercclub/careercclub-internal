// Navigation below module level — one source for the sidebar, the in-page section chips,
// the Settings sections, the Ctrl+K page index, and the redirects of retired sub-pages.
// Pure: no runtime imports, tested directly under `node --test`.

export type NavLink = { href: string; label: string };

export const productLinks: NavLink[] = [
  { href: "/products", label: "Catalog" },
  { href: "/products/features", label: "Features" },
  { href: "/products/feature-links", label: "Feature links" },
  { href: "/products/benefits", label: "Benefits" },
  { href: "/products/pain-points", label: "Pain points" },
  { href: "/products/passion-points", label: "Passion points" },
  { href: "/products/sub-products", label: "Sub-products" },
  { href: "/products/sub-product-links", label: "Sub-product links" },
  { href: "/products/bundles", label: "Bundles" },
];

export const contentPlanningLinks: NavLink[] = [
  { href: "/content-planning", label: "Planner" },
  { href: "/content-planning/stories", label: "Story slides" },
  { href: "/content-planning/story-links", label: "Story links" },
  { href: "/content-planning/carousels", label: "Carousels" },
  { href: "/content-planning/carousel-links", label: "Carousel links" },
  { href: "/content-planning/kol", label: "KOL" },
  { href: "/content-planning/mt-story", label: "MT Story" },
];

export const programLinks: NavLink[] = [
  { href: "/program", label: "Program overview" },
  { href: "/program/tasks", label: "Tasks" },
  { href: "/program/rundown", label: "Event rundown" },
];

export const crmLinks: NavLink[] = [
  { href: "/crm", label: "Buyers" },
  { href: "/crm/deals", label: "Deals pipeline" },
];

export const instagramLinks: NavLink[] = [
  { href: "/instagram", label: "Snapshots" },
  { href: "/instagram/targets", label: "Targets" },
];

export const competitorLinks: NavLink[] = [
  { href: "/competitor-intel", label: "Profiles" },
  { href: "/competitor-intel/products", label: "Products" },
  { href: "/competitor-intel/prices", label: "Price history" },
  { href: "/competitor-intel/snapshots", label: "Snapshots" },
  { href: "/competitor-intel/flags", label: "Flags" },
];

// Platforms & categories, divisions, people and request types are managed in Settings.
export const customerKnowledgeLinks: NavLink[] = [{ href: "/customer-knowledge", label: "Pain points" }];
export const ticketLinks: NavLink[] = [{ href: "/tickets", label: "Tickets" }];

// Deals and outreach are managed in the partnership page's own tabs.
export const partnershipLinks: NavLink[] = [
  { href: "/b2b-partnership", label: "Overview" },
  { href: "/b2b-partnership?tab=deals", label: "Deals & scope" },
  { href: "/b2b-partnership?tab=outreach", label: "Outreach log" },
];

export const orgPartnershipLinks: NavLink[] = [
  { href: "/org-partnership", label: "Overview" },
  { href: "/org-partnership?tab=deals", label: "Deals & scope" },
  { href: "/org-partnership?tab=outreach", label: "Outreach log" },
];

/** Settings sections, in the order shown. Master data used across modules lives here only. */
export const SETTINGS_SECTIONS = [
  { id: "menu", label: "Menu" },
  { id: "users", label: "Users & roles", adminOnly: true },
  { id: "tickets", label: "Ticket setup" },
  { id: "customer-knowledge", label: "Pain point lists" },
  { id: "product-classes", label: "Product classes" },
  { id: "product-mapping", label: "Product mapping" },
  { id: "carousel-ctas", label: "Carousel CTAs" },
  { id: "link-templates", label: "Link templates" },
  { id: "competitor-lists", label: "Competitor lists" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export const TICKET_SETUP_SECTIONS = [
  { id: "divisions", label: "Divisions" },
  { id: "people", label: "People" },
  { id: "types", label: "Request types" },
  { id: "flow", label: "Status & email" },
] as const;

export type TicketSetupSectionId = (typeof TICKET_SETUP_SECTIONS)[number]["id"];

export function settingsHref(section: SettingsSectionId, sub?: string) {
  return `/settings?tab=${section}${sub ? `&section=${sub}` : ""}`;
}

export function isSettingsSection(value: unknown): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

/** Retired sub-pages → where that data is managed now. Old bookmarks and ?focus links keep working. */
export const RETIRED_PAGES: Record<string, string> = {
  "/tickets/divisions": settingsHref("tickets", "divisions"),
  "/tickets/people": settingsHref("tickets", "people"),
  "/tickets/types": settingsHref("tickets", "types"),
  "/customer-knowledge/platforms": settingsHref("customer-knowledge"),
  "/customer-knowledge/categories": settingsHref("customer-knowledge"),
  "/products/classifications": settingsHref("product-classes"),
  "/products/mapping": settingsHref("product-mapping"),
  "/content-planning/cta": settingsHref("carousel-ctas"),
  "/program/link-templates": settingsHref("link-templates"),
  "/b2b-partnership/deals": "/b2b-partnership?tab=deals",
  "/b2b-partnership/outreach": "/b2b-partnership?tab=outreach",
  "/org-partnership/deals": "/org-partnership?tab=deals",
  "/org-partnership/outreach": "/org-partnership?tab=outreach",
};

/** Adds ?focus=<id> (from a search result) to a redirect target. */
export function withFocus(href: string, focus: unknown) {
  const id = Array.isArray(focus) ? focus[0] : focus;
  if (typeof id !== "string" || !id) return href;
  return `${href}${href.includes("?") ? "&" : "?"}focus=${encodeURIComponent(id)}`;
}

/** Sidebar children per module path. A module with one page shows no children. */
export function moduleChildren(isAdmin: boolean): Record<string, NavLink[]> {
  return {
    "/products": productLinks,
    "/content-planning": contentPlanningLinks,
    "/program": programLinks,
    "/crm": crmLinks,
    "/instagram": instagramLinks,
    "/competitor-intel": competitorLinks,
    "/b2b-partnership": partnershipLinks,
    "/org-partnership": orgPartnershipLinks,
    "/settings": SETTINGS_SECTIONS.filter((section) => isAdmin || !("adminOnly" in section)).map((section) => ({ href: settingsHref(section.id), label: section.label })),
  };
}

/** Which child link is current: exact path match, or the same ?tab= on the module page. */
export function isChildActive(href: string, pathname: string, search: string) {
  const [path, query = ""] = href.split("?");
  if (path !== pathname) return false;
  const want = new URLSearchParams(query).get("tab") || "";
  const have = new URLSearchParams(search).get("tab") || "";
  return want === have;
}
