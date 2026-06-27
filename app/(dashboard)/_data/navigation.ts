export type PageKind =
  | "dashboard"
  | "planning"
  | "analytics"
  | "pipeline"
  | "library"
  | "table"
  | "knowledge"
  | "settings";

export type Stat = {
  label: string;
  value: string;
  note: string;
  trend?: "up" | "down" | "neutral";
};

export type ModulePage = {
  slug: string;
  title: string;
  path: string;
  section: string;
  icon: string;
  kind: PageKind;
  description: string;
  stats: Stat[];
  primaryAction: string;
  tabs: string[];
};

export type NavSection = {
  label: string;
  pages: ModulePage[];
};

const pages: ModulePage[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    path: "/dashboard",
    section: "Overview",
    icon: "ti-layout-dashboard",
    kind: "dashboard",
    description: "Executive view for programs, CRM movement, content output, tickets, and recent activity.",
    primaryAction: "Refresh data",
    tabs: ["Overview", "Calendar", "Activity"],
    stats: [
      { label: "Active Programs", value: "18", note: "+4 this month", trend: "up" },
      { label: "CRM Leads", value: "642", note: "73 warm leads", trend: "up" },
      { label: "Content Assets", value: "1,284", note: "211 ready to post", trend: "neutral" },
      { label: "Open Tickets", value: "12", note: "5 high priority", trend: "down" },
    ],
  },
  {
    slug: "content-planning",
    title: "Content Planning",
    path: "/content-planning",
    section: "Marketing",
    icon: "ti-calendar-event",
    kind: "planning",
    description: "Calendar planning for IG, TikTok, Threads, copy briefs, approvals, and publishing rhythm.",
    primaryAction: "Add content brief",
    tabs: ["Calendar", "Backlog", "Approval", "Published"],
    stats: [
      { label: "This Week", value: "26", note: "scheduled posts", trend: "up" },
      { label: "Needs Approval", value: "8", note: "waiting review", trend: "neutral" },
      { label: "Drafts", value: "41", note: "copy and creative", trend: "up" },
      { label: "Blocked", value: "3", note: "missing assets", trend: "down" },
    ],
  },
  {
    slug: "content-evaluation",
    title: "Content Evaluation",
    path: "/content-evaluation",
    section: "Marketing",
    icon: "ti-chart-line",
    kind: "analytics",
    description: "Performance scoring for Reels, carousels, feed posts, stories, and repeatable insights.",
    primaryAction: "Add evaluation",
    tabs: ["Overview", "Reels", "Feed & Carousel", "Story", "Insights"],
    stats: [
      { label: "Avg Score", value: "82", note: "top quartile", trend: "up" },
      { label: "Posts Reviewed", value: "156", note: "last 90 days", trend: "up" },
      { label: "Top Format", value: "Reels", note: "1.8x reach", trend: "up" },
      { label: "Weak Signal", value: "Saves", note: "needs CTA", trend: "down" },
    ],
  },
  {
    slug: "meta-ads",
    title: "Meta Ads",
    path: "/meta-ads",
    section: "Marketing",
    icon: "ti-ad-2",
    kind: "analytics",
    description: "Ad library, campaign snapshots, funnel mapping, and creative performance notes.",
    primaryAction: "Add ad snapshot",
    tabs: ["Dashboard", "Campaigns", "Library", "Experiments"],
    stats: [
      { label: "Spend", value: "Rp18.4M", note: "this month", trend: "neutral" },
      { label: "CPL", value: "Rp21K", note: "-11% vs prior", trend: "up" },
      { label: "Winning Ads", value: "9", note: "reuse candidates", trend: "up" },
      { label: "Fatigue", value: "4", note: "refresh needed", trend: "down" },
    ],
  },
  {
    slug: "instagram",
    title: "Instagram",
    path: "/instagram",
    section: "Marketing",
    icon: "ti-brand-instagram",
    kind: "analytics",
    description: "Weekly follower, reach, engagement, and account health tracking for Instagram.",
    primaryAction: "Import snapshot",
    tabs: ["Dashboard", "Weekly Avg", "Upload", "Targets"],
    stats: [
      { label: "Followers", value: "23.8K", note: "+612 this month", trend: "up" },
      { label: "Reach", value: "418K", note: "30 days", trend: "up" },
      { label: "Engagement", value: "6.4%", note: "weekly avg", trend: "neutral" },
      { label: "Profile Visits", value: "8,920", note: "+18%", trend: "up" },
    ],
  },
  {
    slug: "content-library",
    title: "Content Library",
    path: "/content-library",
    section: "Marketing",
    icon: "ti-bookmark",
    kind: "library",
    description: "Reusable screenshots, captions, labels, social links, and engagement benchmarks.",
    primaryAction: "Upload content",
    tabs: ["Gallery", "Labels", "Saved Links", "Benchmarks"],
    stats: [
      { label: "Assets", value: "1,284", note: "indexed items", trend: "up" },
      { label: "Labels", value: "42", note: "topic clusters", trend: "neutral" },
      { label: "Top Platform", value: "IG", note: "61% of assets", trend: "neutral" },
      { label: "Unlabeled", value: "37", note: "needs cleanup", trend: "down" },
    ],
  },
  {
    slug: "voucher",
    title: "Voucher",
    path: "/voucher",
    section: "Marketing",
    icon: "ti-ticket",
    kind: "table",
    description: "Voucher codes, usage rules, campaign attribution, and redemption monitoring.",
    primaryAction: "Create voucher",
    tabs: ["Active", "Campaigns", "Usage", "Expired"],
    stats: [
      { label: "Active Codes", value: "31", note: "live campaigns", trend: "up" },
      { label: "Redeemed", value: "486", note: "this month", trend: "up" },
      { label: "Avg Discount", value: "18%", note: "weighted", trend: "neutral" },
      { label: "Expiring", value: "6", note: "next 7 days", trend: "down" },
    ],
  },
  {
    slug: "program",
    title: "Program",
    path: "/program",
    section: "Operations",
    icon: "ti-checklist",
    kind: "planning",
    description: "Program calendar, operational tasks, event history, and readiness tracking.",
    primaryAction: "Add task",
    tabs: ["Overview", "Calendar", "Tasks", "History"],
    stats: [
      { label: "Programs", value: "18", note: "active", trend: "up" },
      { label: "Tasks Due", value: "24", note: "this week", trend: "neutral" },
      { label: "Overdue", value: "5", note: "needs owner", trend: "down" },
      { label: "Events", value: "9", note: "this month", trend: "up" },
    ],
  },
  {
    slug: "products",
    title: "Products",
    path: "/products",
    section: "Operations",
    icon: "ti-package",
    kind: "library",
    description: "Product catalog, bundles, benefit notes, prices, and sales collateral.",
    primaryAction: "Add product",
    tabs: ["Catalog", "Bundles", "Knowledge Base", "Pricing"],
    stats: [
      { label: "Products", value: "22", note: "sellable", trend: "neutral" },
      { label: "Bundles", value: "7", note: "active", trend: "up" },
      { label: "Top SKU", value: "MT+", note: "by revenue", trend: "up" },
      { label: "Needs Copy", value: "4", note: "incomplete pages", trend: "down" },
    ],
  },
  {
    slug: "crm",
    title: "CRM",
    path: "/crm",
    section: "Operations",
    icon: "ti-users",
    kind: "pipeline",
    description: "Customer records, deals, purchase history, follow-up stages, and import QA.",
    primaryAction: "Import leads",
    tabs: ["Pipeline", "Customers", "Deals", "Blast"],
    stats: [
      { label: "Customers", value: "5,842", note: "known contacts", trend: "up" },
      { label: "Open Deals", value: "214", note: "in pipeline", trend: "up" },
      { label: "Won", value: "86", note: "last 30 days", trend: "up" },
      { label: "Stale", value: "39", note: "needs follow-up", trend: "down" },
    ],
  },
  {
    slug: "job-vacancy-mt",
    title: "Job Vacancy MT",
    path: "/job-vacancy-mt",
    section: "Operations",
    icon: "ti-briefcase",
    kind: "table",
    description: "Management trainee openings, industries, newsletter generation, and company intel.",
    primaryAction: "Add vacancy",
    tabs: ["Dashboard", "All Vacancies", "Newsletter", "Master Data", "Company Intel"],
    stats: [
      { label: "Vacancies", value: "318", note: "tracked", trend: "up" },
      { label: "New This Week", value: "42", note: "fresh openings", trend: "up" },
      { label: "Industries", value: "12", note: "master data", trend: "neutral" },
      { label: "Newsletter", value: "Ready", note: "weekly draft", trend: "up" },
    ],
  },
  {
    slug: "competitor-intel",
    title: "Competitor Intel",
    path: "/competitor-intel",
    section: "Intelligence",
    icon: "ti-shield-search",
    kind: "knowledge",
    description: "Competitor profiles, product pricing, offer tracking, and market flags.",
    primaryAction: "Add competitor",
    tabs: ["Overview", "Profiles", "Products", "Flags"],
    stats: [
      { label: "Competitors", value: "18", note: "tracked", trend: "neutral" },
      { label: "Products", value: "74", note: "mapped", trend: "up" },
      { label: "Price Moves", value: "11", note: "this month", trend: "down" },
      { label: "Flags", value: "6", note: "watch list", trend: "neutral" },
    ],
  },
  {
    slug: "customer-knowledge",
    title: "Customer Knowledge",
    path: "/customer-knowledge",
    section: "Intelligence",
    icon: "ti-message-search",
    kind: "knowledge",
    description: "Pain points, labels, free class analytics, and customer language patterns.",
    primaryAction: "Add insight",
    tabs: ["Dashboard", "Pain Points", "Analytics Free Class", "Labels"],
    stats: [
      { label: "Pain Points", value: "392", note: "coded entries", trend: "up" },
      { label: "Labels", value: "54", note: "taxonomy", trend: "neutral" },
      { label: "Top Theme", value: "Interview", note: "28% share", trend: "up" },
      { label: "Unsorted", value: "21", note: "needs review", trend: "down" },
    ],
  },
  {
    slug: "tickets",
    title: "Tickets",
    path: "/tickets",
    section: "Internal",
    icon: "ti-ticket",
    kind: "pipeline",
    description: "Internal requests, assignees, CCs, file links, priority, status, and SLA coverage.",
    primaryAction: "Create ticket",
    tabs: ["Inbox", "In Progress", "Done", "Master Data"],
    stats: [
      { label: "Open", value: "12", note: "across teams", trend: "down" },
      { label: "High Priority", value: "5", note: "urgent", trend: "down" },
      { label: "Done", value: "48", note: "this month", trend: "up" },
      { label: "Avg SLA", value: "1.8d", note: "resolution", trend: "up" },
    ],
  },
  {
    slug: "b2b-partnership",
    title: "B2B Partnership",
    path: "/b2b-partnership",
    section: "Internal",
    icon: "ti-users-group",
    kind: "pipeline",
    description: "Company partner pipeline, contacts, scopes, outreach, and deal stage tracking.",
    primaryAction: "Add partner",
    tabs: ["Overview", "Master", "Pipeline", "Deals", "Outreach"],
    stats: [
      { label: "Partners", value: "126", note: "known companies", trend: "up" },
      { label: "Negotiation", value: "14", note: "active", trend: "up" },
      { label: "Closed Deal", value: "8", note: "this quarter", trend: "up" },
      { label: "Lost", value: "3", note: "needs notes", trend: "down" },
    ],
  },
  {
    slug: "org-partnership",
    title: "Org Partnership",
    path: "/org-partnership",
    section: "Internal",
    icon: "ti-school",
    kind: "pipeline",
    description: "Campus and organization partnerships, PICs, scopes, and activation progress.",
    primaryAction: "Add organization",
    tabs: ["Overview", "Master", "Pipeline", "Deals", "Outreach"],
    stats: [
      { label: "Organizations", value: "93", note: "tracked", trend: "up" },
      { label: "Approached", value: "27", note: "waiting response", trend: "neutral" },
      { label: "Activations", value: "12", note: "this month", trend: "up" },
      { label: "Dormant", value: "9", note: "follow-up", trend: "down" },
    ],
  },
  {
    slug: "design-assets",
    title: "Design Assets",
    path: "/design-assets",
    section: "Internal",
    icon: "ti-palette",
    kind: "library",
    description: "Graphic design references, uploaded creatives, labels, and usage notes.",
    primaryAction: "Upload asset",
    tabs: ["Gallery", "Labels", "References", "Archive"],
    stats: [
      { label: "Assets", value: "842", note: "stored", trend: "up" },
      { label: "Campaigns", value: "37", note: "tagged", trend: "neutral" },
      { label: "Needs Review", value: "16", note: "unapproved", trend: "down" },
      { label: "Top Format", value: "Carousel", note: "creative type", trend: "up" },
    ],
  },
  {
    slug: "resources",
    title: "Resources",
    path: "/resources",
    section: "Internal",
    icon: "ti-key",
    kind: "table",
    description: "Internal links, credentials, tool references, and operational notes by category.",
    primaryAction: "Add resource",
    tabs: ["All", "Links", "Credentials", "Tools"],
    stats: [
      { label: "Resources", value: "68", note: "saved", trend: "up" },
      { label: "Credentials", value: "17", note: "restricted", trend: "neutral" },
      { label: "Categories", value: "11", note: "groups", trend: "neutral" },
      { label: "Needs Audit", value: "5", note: "old access", trend: "down" },
    ],
  },
  {
    slug: "settings",
    title: "Settings",
    path: "/settings",
    section: "Settings",
    icon: "ti-settings",
    kind: "settings",
    description: "Menu visibility, master lists, classification rules, link templates, and app preferences.",
    primaryAction: "Save settings",
    tabs: ["Menu", "Classifications", "Lists", "Email"],
    stats: [
      { label: "Menu Version", value: "v12", note: "App Router", trend: "up" },
      { label: "Master Lists", value: "9", note: "configured", trend: "neutral" },
      { label: "Templates", value: "14", note: "email/link", trend: "up" },
      { label: "Env", value: "Ready", note: "Resend route", trend: "neutral" },
    ],
  },
];

const sectionOrder = ["Overview", "Marketing", "Operations", "Intelligence", "Internal", "Settings"];

export const navSections: NavSection[] = sectionOrder.map((label) => ({
  label,
  pages: pages.filter((page) => page.section === label),
}));

export const modulePages = pages;

export function getPageBySlug(slug: string): ModulePage {
  const page = pages.find((item) => item.slug === slug);

  if (!page) {
    throw new Error(`Unknown dashboard page: ${slug}`);
  }

  return page;
}
