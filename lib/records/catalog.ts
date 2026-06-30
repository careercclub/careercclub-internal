import type { TableName } from "@/lib/db/tables";
import type { StorageArea } from "@/lib/storage/r2";

export type ManagedField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "textarea" | "select" | "checkbox" | "json" | "uuid-array" | "text-array";
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
  storageArea?: StorageArea;
};

export type RecordDefinition = {
  table: TableName;
  title: string;
  eyebrow: string;
  description: string;
  path: string;
  orderBy: string;
  ascending?: boolean;
  columns: readonly string[];
  fields: readonly ManagedField[];
};

export const recordDefinitions = {
  pain_points: {
    table: "pain_points", title: "Customer pain points", eyebrow: "Customer knowledge", path: "/customer-knowledge", orderBy: "created_at", ascending: false,
    description: "Capture customer language from social comments and classify recurring pain points.", columns: ["komentar", "platform", "kategori", "username", "bulan"],
    fields: [{ name: "komentar", label: "Comment", type: "textarea", required: true }, { name: "platform", label: "Platform", required: true }, { name: "kategori", label: "Category", required: true }, { name: "username", label: "Username" }, { name: "bulan", label: "Month", placeholder: "YYYY-MM" }, { name: "source_url", label: "Source URL" }, { name: "notes", label: "Notes", type: "textarea" }, { name: "labels", label: "Labels JSON", type: "json", placeholder: "[]" }],
  },
  products: {
    table: "products", title: "Product catalog", eyebrow: "Products", path: "/products", orderBy: "created_at", ascending: false,
    description: "Manage sellable products, bundles, classification, pricing, and landing-page references.", columns: ["nama", "type", "kategori", "harga", "status"],
    fields: [
      { name: "nama", label: "Name", required: true },
      { name: "type", label: "Type", type: "select", options: ["satuan", "bundling"] },
      { name: "kategori", label: "Classification" },
      { name: "harga", label: "Price", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["Active", "Draft", "Archived"] },
      { name: "deskripsi", label: "Description", type: "textarea" },
      { name: "link", label: "Landing URL" },
      { name: "cover_url", label: "Cover object key / URL", storageArea: "uploads" },
    ],
  },
  product_features: {
    table: "product_features", title: "Product features", eyebrow: "Products", path: "/products/features", orderBy: "created_at",
    description: "Reusable feature statements connected to a product and its shortlinks.", columns: ["product_id", "name", "description"],
    fields: [{ name: "product_id", label: "Product ID", required: true }, { name: "name", label: "Feature", required: true }, { name: "description", label: "Description", type: "textarea" }],
  },
  product_feature_links: {
    table: "product_feature_links", title: "Feature shortlinks", eyebrow: "Products", path: "/products/feature-links", orderBy: "created_at",
    description: "Attach labeled URLs to product features.", columns: ["feature_id", "label", "url"],
    fields: [{ name: "feature_id", label: "Feature ID", required: true }, { name: "label", label: "Label", required: true }, { name: "url", label: "URL", required: true }],
  },
  product_benefits: {
    table: "product_benefits", title: "Product benefits", eyebrow: "Products", path: "/products/benefits", orderBy: "created_at",
    description: "Document product value propositions for marketing and sales.", columns: ["product_id", "nama", "text"],
    fields: [{ name: "product_id", label: "Product ID", required: true }, { name: "nama", label: "Benefit", required: true }, { name: "text", label: "Description", type: "textarea" }],
  },
  product_pain_points: {
    table: "product_pain_points", title: "Product pain points", eyebrow: "Products", path: "/products/pain-points", orderBy: "created_at",
    description: "Customer problems addressed by each product.", columns: ["product_id", "nama", "text"],
    fields: [{ name: "product_id", label: "Product ID", required: true }, { name: "nama", label: "Pain point", required: true }, { name: "text", label: "Description", type: "textarea" }],
  },
  product_passion_points: {
    table: "product_passion_points", title: "Product passion points", eyebrow: "Products", path: "/products/passion-points", orderBy: "created_at",
    description: "Customer aspirations and motivations connected to each product.", columns: ["product_id", "nama", "text"],
    fields: [{ name: "product_id", label: "Product ID", required: true }, { name: "nama", label: "Passion point", required: true }, { name: "text", label: "Description", type: "textarea" }],
  },
  sub_products: {
    table: "sub_products", title: "Sub-products", eyebrow: "Products", path: "/products/sub-products", orderBy: "created_at",
    description: "Variants and component offers attached to a primary product.", columns: ["product_id", "name", "harga"],
    fields: [{ name: "product_id", label: "Product ID", required: true }, { name: "name", label: "Name", required: true }, { name: "harga", label: "Price", type: "number" }],
  },
  sub_product_links: {
    table: "sub_product_links", title: "Sub-product shortlinks", eyebrow: "Products", path: "/products/sub-product-links", orderBy: "created_at",
    description: "Attach labeled URLs to a product variant.", columns: ["sub_product_id", "label", "url"],
    fields: [{ name: "sub_product_id", label: "Sub-product ID", required: true }, { name: "label", label: "Label", required: true }, { name: "url", label: "URL", required: true }],
  },
  product_bundles: {
    table: "product_bundles", title: "Bundle contents", eyebrow: "Products", path: "/products/bundles", orderBy: "created_at",
    description: "Map bundle products to the individual products included in each offer.", columns: ["bundle_id", "item_id", "created_at"],
    fields: [{ name: "bundle_id", label: "Bundle product ID", required: true }, { name: "item_id", label: "Included product ID", required: true }],
  },
  product_klasifikasi: {
    table: "product_klasifikasi", title: "Product classifications", eyebrow: "Products", path: "/products/classifications", orderBy: "name",
    description: "Maintain product taxonomy used by CRM imports and product reporting.", columns: ["name", "created_at"], fields: [{ name: "name", label: "Classification", required: true }],
  },
  master_produk: {
    table: "master_produk", title: "Lynkid product mapping", eyebrow: "Products", path: "/products/mapping", orderBy: "nama",
    description: "Normalize imported Lynkid product names into the internal classification system.", columns: ["nama", "klasifikasi"],
    fields: [{ name: "nama", label: "Imported product name", required: true }, { name: "klasifikasi", label: "Classification", required: true }],
  },
  event_rundown: {
    table: "event_rundown", title: "Event rundown", eyebrow: "Program", path: "/program/rundown", orderBy: "urutan",
    description: "Sequence event activities, timing, notes, links, and MC cues.", columns: ["event_id", "waktu", "durasi", "activity", "urutan"],
    fields: [{ name: "event_id", label: "Event ID", required: true }, { name: "waktu", label: "Time", type: "time" }, { name: "durasi", label: "Duration (minutes)", type: "number" }, { name: "activity", label: "Activity", required: true }, { name: "keterangan", label: "Notes", type: "textarea" }, { name: "link", label: "Link" }, { name: "cue_mc", label: "MC cue", type: "textarea" }, { name: "urutan", label: "Order", type: "number" }],
  },
  story_plan_dates: {
    table: "story_plan_dates", title: "Story planner", eyebrow: "Content planning", path: "/content-planning", orderBy: "tanggal",
    description: "Schedule Instagram Story groups and track their publishing status.", columns: ["tanggal", "status", "updated_at"],
    fields: [{ name: "tanggal", label: "Date", type: "date", required: true }, { name: "status", label: "Status", type: "select", options: ["Draft", "Done"] }],
  },
  story_plan_items: {
    table: "story_plan_items", title: "Story slides", eyebrow: "Content planning", path: "/content-planning/stories", orderBy: "urutan",
    description: "Manage individual slides within each scheduled Story date.", columns: ["date_id", "urutan", "isi", "thumbnail_key"],
    fields: [{ name: "date_id", label: "Story date ID", required: true }, { name: "urutan", label: "Slide order", type: "number" }, { name: "isi", label: "Slide content", type: "textarea", required: true }, { name: "thumbnail_key", label: "R2 thumbnail key", storageArea: "uploads" }],
  },
  story_plan_links: {
    table: "story_plan_links", title: "Story links", eyebrow: "Content planning", path: "/content-planning/story-links", orderBy: "created_at",
    description: "Reusable links for Story planning and publishing.", columns: ["label", "url", "created_at"],
    fields: [{ name: "label", label: "Label", required: true }, { name: "url", label: "URL", required: true }],
  },
  carousel_plans: {
    table: "carousel_plans", title: "Carousel planner", eyebrow: "Content planning", path: "/content-planning/carousels", orderBy: "tanggal_posting",
    description: "Plan carousel topics, funnel stage, CTA, owner, brief, and publish date.", columns: ["judul", "tanggal_posting", "funnel", "cta", "status"],
    fields: [{ name: "judul", label: "Title", required: true }, { name: "tanggal_posting", label: "Publish date", type: "date" }, { name: "funnel", label: "Funnel", type: "select", options: ["TOFU", "MOFU", "BOFU"] }, { name: "cta", label: "CTA" }, { name: "assignee_id", label: "Assignee ID" }, { name: "status", label: "Status", type: "select", options: ["Draft", "Done"] }, { name: "link_brief", label: "Brief URL" }],
  },
  carousel_cta_options: {
    table: "carousel_cta_options", title: "Carousel CTA master", eyebrow: "Content planning", path: "/content-planning/cta", orderBy: "label",
    description: "Maintain the CTA vocabulary used by carousel planning.", columns: ["label", "created_at"], fields: [{ name: "label", label: "CTA", required: true }],
  },
  carousel_plan_links: {
    table: "carousel_plan_links", title: "Carousel links", eyebrow: "Content planning", path: "/content-planning/carousel-links", orderBy: "created_at",
    description: "Brief and reference links connected to carousel plans.", columns: ["plan_id", "label", "url"],
    fields: [{ name: "plan_id", label: "Carousel plan ID" }, { name: "label", label: "Label", required: true }, { name: "url", label: "URL", required: true }],
  },
  kol_list: {
    table: "kol_list", title: "KOL directory", eyebrow: "Content planning", path: "/content-planning/kol", orderBy: "created_at", ascending: false,
    description: "Track creator profiles, niche, reach, contact details, and rate cards.", columns: ["nama", "username", "platform", "niche", "followers"],
    fields: [{ name: "nama", label: "Name", required: true }, { name: "username", label: "Username" }, { name: "platform", label: "Platform", type: "select", options: ["Instagram", "TikTok", "YouTube", "LinkedIn", "Other"] }, { name: "niche", label: "Niche" }, { name: "followers", label: "Followers", type: "number" }, { name: "engagement_rate", label: "Engagement rate", type: "number" }, { name: "contact", label: "Contact" }, { name: "rate_card_url", label: "Rate card object key / URL", storageArea: "uploads" }, { name: "foto_url", label: "Photo object key / URL", storageArea: "uploads" }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  mt_story_list: {
    table: "mt_story_list", title: "MT Story", eyebrow: "Content planning", path: "/content-planning/mt-story", orderBy: "created_at", ascending: false,
    description: "Manage alumni stories and publishing readiness for social proof content.", columns: ["nama", "perusahaan", "batch", "wa", "is_posted"],
    fields: [{ name: "nama", label: "Name", required: true }, { name: "perusahaan", label: "Company" }, { name: "batch", label: "Batch" }, { name: "wa", label: "WhatsApp" }, { name: "deskripsi", label: "Description", type: "textarea" }, { name: "ig_url", label: "Instagram URL" }, { name: "linkedin_url", label: "LinkedIn URL" }, { name: "brief_url", label: "Brief URL" }, { name: "foto_url", label: "Photo object key / URL", storageArea: "uploads" }, { name: "is_posted", label: "Posted", type: "checkbox" }],
  },
  talent_pool: {
    table: "talent_pool", title: "Talent Pool", eyebrow: "CRM", path: "/talent-pool", orderBy: "created_at", ascending: false,
    description: "Search and maintain candidate profiles connected to CRM buyers by email or WhatsApp.", columns: ["nama", "wa", "email", "status", "universitas", "pipeline", "buyer_match"],
    fields: [{ name: "nama", label: "Name", required: true }, { name: "email", label: "Email" }, { name: "wa", label: "WhatsApp" }, { name: "status", label: "Status" }, { name: "sumber", label: "Source" }, { name: "domisili", label: "City" }, { name: "universitas", label: "University" }, { name: "campus_tier", label: "Campus tier" }, { name: "ipk", label: "GPA" }, { name: "tahun_lulus", label: "Graduation year" }, { name: "target_mt", label: "Target MT" }, { name: "posisi_mt", label: "Target role" }, { name: "pipeline", label: "Pipeline" }, { name: "produk_dibeli", label: "Purchased product" }, { name: "feedback", label: "Feedback", type: "textarea" }],
  },
  collaborators: {
    table: "collaborators", title: "Collaborators & advisors", eyebrow: "Internal", path: "/collaborators", orderBy: "created_at",
    description: "Maintain collaborator obligations and advisor services in one operational directory.", columns: ["nama", "tipe", "status", "privy", "rekening"],
    fields: [{ name: "nama", label: "Name", required: true }, { name: "tipe", label: "Type", type: "select", options: ["collaborator", "advisor"] }, { name: "rekening", label: "Bank account" }, { name: "privy", label: "Privy complete", type: "checkbox" }, { name: "kewajiban", label: "Obligations JSON", type: "json", placeholder: "[]" }, { name: "services", label: "Services JSON", type: "json", placeholder: "[]" }, { name: "background", label: "Background", type: "textarea" }, { name: "status", label: "Status" }, { name: "catatan", label: "Notes", type: "textarea" }, { name: "foto_url", label: "Photo object key / URL", storageArea: "collaborator-photos" }],
  },
  tickets: {
    table: "tickets", title: "Tickets", eyebrow: "Internal", path: "/tickets", orderBy: "created_at", ascending: false,
    description: "Manage internal work, ownership, deadlines, status, and calendar synchronization.", columns: ["ticket_no", "title", "status", "priority", "due_date", "gcal_added"],
    fields: [{ name: "ticket_no", label: "Ticket number" }, { name: "title", label: "Title", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["Todo", "In Progress", "Done"] }, { name: "priority", label: "Priority", type: "select", options: ["Low", "Med", "High", "Urgent"] }, { name: "due_date", label: "Deadline", type: "date" }, { name: "assigned_to_ids", label: "Assignee UUIDs", type: "uuid-array", placeholder: "uuid, uuid" }, { name: "notification_roles", label: "Notify roles", type: "text-array", required: true }, { name: "source", label: "Source" }, { name: "gcal_added", label: "Added to calendar", type: "checkbox" }],
  },
} as const satisfies Record<string, RecordDefinition>;

export type RecordDefinitionKey = keyof typeof recordDefinitions;

export function isRecordDefinitionKey(value: string): value is RecordDefinitionKey {
  return value in recordDefinitions;
}
