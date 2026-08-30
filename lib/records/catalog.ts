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
  mutationRoles?: readonly string[];
};

export const recordDefinitions = {
  events: {
    table: "events", title: "Programs & events", eyebrow: "Program", path: "/program", orderBy: "tanggal", ascending: false,
    description: "Manage program schedules, speakers, delivery links, targets, and operational status.", columns: ["nama", "tanggal", "waktu", "status", "speaker", "platform"],
    fields: [{ name: "nama", label: "Program name", required: true }, { name: "jenis_program", label: "Program type" }, { name: "tanggal", label: "Date", type: "date", required: true }, { name: "waktu", label: "Time", type: "time" }, { name: "status", label: "Status", type: "select", options: ["Planning", "On Progress", "Done", "Cancelled"] }, { name: "deskripsi", label: "Description", type: "textarea" }, { name: "speaker", label: "Speaker" }, { name: "platform", label: "Platform", type: "select", options: ["Zoom", "Google Meet", "Offline"] }, { name: "link_zoom", label: "Meeting URL" }, { name: "target", label: "Target participants", type: "number" }, { name: "capaian_peserta", label: "Participants achieved", type: "number" }, { name: "notes_post", label: "Post-event notes", type: "textarea" }, { name: "links", label: "Event links JSON", type: "json", placeholder: "[]" }],
  },
  buyers: {
    table: "buyers", title: "CRM buyers", eyebrow: "CRM", path: "/crm", orderBy: "created_at", ascending: false,
    description: "Manage imported buyers, payment state, product classification, outreach, and talent-pool status.", columns: ["name", "wa", "email", "produk", "payment_status", "status"],
    fields: [{ name: "name", label: "Name", required: true }, { name: "wa", label: "WhatsApp" }, { name: "email", label: "Email" }, { name: "produk", label: "Product" }, { name: "klasifikasi", label: "Classification" }, { name: "harga", label: "Price", type: "number" }, { name: "industri", label: "Industry" }, { name: "tahap", label: "Stage" }, { name: "sumber", label: "Source" }, { name: "status", label: "Outreach status" }, { name: "payment_status", label: "Payment status" }, { name: "talent_pool", label: "Talent pool", type: "checkbox" }, { name: "tanggal", label: "Transaction date", type: "date" }, { name: "riwayat", label: "History JSON", type: "json", placeholder: "[]" }],
  },
  content_evaluations: {
    table: "content_evaluations", title: "Content evaluation", eyebrow: "Content", path: "/content-evaluation", orderBy: "tanggal", ascending: false,
    description: "Review published content metrics, creative findings, and the next action for each post.", columns: ["judul", "tanggal", "format", "views", "reach", "likes"],
    fields: [{ name: "post_id", label: "Post ID" }, { name: "account_id", label: "Account ID" }, { name: "account_username", label: "Account username" }, { name: "judul", label: "Title", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "url", label: "Post URL" }, { name: "format", label: "Format", type: "select", options: ["Carousel", "Feed Photo", "Reel", "Story"] }, { name: "tanggal", label: "Publish date", type: "date" }, { name: "topik", label: "Topic" }, { name: "followers", label: "Followers", type: "number" }, { name: "views", label: "Views", type: "number" }, { name: "reach", label: "Reach", type: "number" }, { name: "nf_pct", label: "Non-follower reach %", type: "number" }, { name: "from_home", label: "Reach from home", type: "number" }, { name: "from_profile", label: "Reach from profile", type: "number" }, { name: "from_other", label: "Reach from other", type: "number" }, { name: "likes", label: "Likes", type: "number" }, { name: "comments", label: "Comments", type: "number" }, { name: "saves", label: "Saves", type: "number" }, { name: "shares", label: "Shares", type: "number" }, { name: "engaged", label: "Accounts engaged", type: "number" }, { name: "profile_visits", label: "Profile visits", type: "number" }, { name: "follows", label: "Follows", type: "number" }, { name: "link_taps", label: "Link taps", type: "number" }, { name: "watchtime", label: "Average watch time", type: "number" }, { name: "wtr", label: "Watch-through rate %", type: "number" }, { name: "duration", label: "Duration seconds", type: "number" }, { name: "replays", label: "Replays", type: "number" }, { name: "dropoff", label: "Drop-off second", type: "number" }, { name: "taps_forward", label: "Story taps forward", type: "number" }, { name: "taps_back", label: "Story taps back", type: "number" }, { name: "exits", label: "Story exits", type: "number" }, { name: "replies", label: "Story replies", type: "number" }, { name: "stickers_interact", label: "Sticker interactions", type: "number" }, { name: "hook_rating", label: "Hook rating", type: "number" }, { name: "cta_eff", label: "CTA effectiveness", type: "select", options: ["high", "med", "low"] }, { name: "win", label: "What worked", type: "textarea" }, { name: "improve", label: "Improve", type: "textarea" }, { name: "action", label: "Next action", type: "textarea" }, { name: "thumbnail_url", label: "Thumbnail key / URL", storageArea: "uploads" }],
  },
  ads_contents: {
    table: "ads_contents", title: "Meta Ads content", eyebrow: "Paid media", path: "/meta-ads", orderBy: "created_at", ascending: false,
    description: "Evaluate organic content for paid distribution and record campaign decisions.", columns: ["judul", "tanggal", "format", "reach", "impressions", "ad_decision"],
    fields: [{ name: "eval_id", label: "Evaluation ID" }, { name: "judul", label: "Title", required: true }, { name: "format", label: "Format", type: "select", options: ["Carousel", "Reels", "Story", "Single Image"] }, { name: "tanggal", label: "Date", type: "date" }, { name: "reach", label: "Reach", type: "number" }, { name: "impressions", label: "Impressions", type: "number" }, { name: "views", label: "Views", type: "number" }, { name: "likes", label: "Likes", type: "number" }, { name: "comments", label: "Comments", type: "number" }, { name: "saves", label: "Saves", type: "number" }, { name: "shares", label: "Shares", type: "number" }, { name: "link_taps", label: "Link taps", type: "number" }, { name: "follows", label: "Follows", type: "number" }, { name: "funnel", label: "Funnel", type: "select", options: ["TOFU", "MOFU", "BOFU"] }, { name: "objective", label: "Objective" }, { name: "ad_decision", label: "Decision", type: "select", options: ["Pending", "Boost", "Skip"] }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  ig_snapshots: {
    table: "ig_snapshots", title: "Instagram performance", eyebrow: "Social", path: "/instagram", orderBy: "week_start", ascending: false,
    description: "Track weekly audience growth, reach, engagement, traffic, and operating notes.", columns: ["week_start", "followers_total", "follows_gained", "reach", "views", "interactions"],
    fields: [{ name: "week_start", label: "Week start", type: "date", required: true }, { name: "followers_total", label: "Followers total", type: "number" }, { name: "follows_gained", label: "Follows gained", type: "number" }, { name: "reach", label: "Reach", type: "number" }, { name: "views", label: "Views", type: "number" }, { name: "interactions", label: "Interactions", type: "number" }, { name: "link_clicks", label: "Link clicks", type: "number" }, { name: "profile_visits", label: "Profile visits", type: "number" }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  vouchers: {
    table: "vouchers", title: "Vouchers", eyebrow: "Revenue", path: "/voucher", orderBy: "created_at", ascending: false,
    description: "Create campaign voucher rules, product eligibility, discount limits, and active periods.", columns: ["nama_event", "kode", "tipe", "periode_mulai", "periode_selesai", "diskon_persen"],
    fields: [{ name: "nama_event", label: "Event name", required: true }, { name: "kode", label: "Code", required: true }, { name: "tipe", label: "Type", type: "select", options: ["Flash Sale", "Mega Sale", "Bundle Sale", "Voucher Gift"] }, { name: "periode_mulai", label: "Start date", type: "date", required: true }, { name: "periode_selesai", label: "End date", type: "date", required: true }, { name: "diskon_persen", label: "Discount percent", type: "number" }, { name: "maks_potongan", label: "Maximum discount", type: "number" }, { name: "min_transaksi", label: "Minimum transaction", type: "number" }, { name: "product_ids", label: "Product UUIDs", type: "uuid-array", placeholder: "uuid, uuid" }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  partners: {
    table: "partners", title: "B2B partnerships", eyebrow: "Partnerships", path: "/b2b-partnership", orderBy: "name",
    description: "Manage corporate prospects, contacts, tier, pipeline status, scope, and relationship notes.", columns: ["name", "category", "tier", "status", "contact_name", "contact_phone"],
    fields: [{ name: "name", label: "Company", required: true }, { name: "type", label: "Type", type: "select", options: ["Corporate"] }, { name: "category", label: "Category" }, { name: "tier", label: "Tier", type: "select", options: ["Strategic", "Standard"] }, { name: "status", label: "Status", type: "select", options: ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"] }, { name: "contact_name", label: "PIC" }, { name: "contact_email", label: "PIC email" }, { name: "contact_phone", label: "PIC WhatsApp" }, { name: "pos", label: "PIC position" }, { name: "li", label: "LinkedIn" }, { name: "scope", label: "Scope", type: "textarea" }, { name: "notes", label: "Notes", type: "textarea" }, { name: "input_date", label: "Input date", type: "date" }],
  },
  org_partners: {
    table: "org_partners", title: "Organization partnerships", eyebrow: "Partnerships", path: "/org-partnership", orderBy: "name",
    description: "Manage campus and organization prospects, contacts, relationship tier, scope, and deal status.", columns: ["name", "category", "tier", "status", "contact_name", "contact_phone"],
    fields: [{ name: "name", label: "Organization", required: true }, { name: "category", label: "Category" }, { name: "tier", label: "Tier", type: "select", options: ["Strategic", "Standard"] }, { name: "status", label: "Status", type: "select", options: ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"] }, { name: "contact_name", label: "PIC" }, { name: "contact_email", label: "PIC email" }, { name: "contact_phone", label: "PIC WhatsApp" }, { name: "pos", label: "PIC position" }, { name: "li", label: "LinkedIn" }, { name: "scope", label: "Scope", type: "textarea" }, { name: "notes", label: "Notes", type: "textarea" }, { name: "input_date", label: "Input date", type: "date" }],
  },
  design_assets: {
    table: "design_assets", title: "Design assets", eyebrow: "Creative", path: "/design-assets", orderBy: "created_at", ascending: false,
    description: "Store design references and reusable creative assets backed by the private R2 bucket.", columns: ["nama", "kategori", "tipe", "storage_path", "link", "created_at"],
    fields: [{ name: "nama", label: "Name" }, { name: "kategori", label: "Category", required: true }, { name: "tipe", label: "Type", type: "select", options: ["assets", "references"] }, { name: "storage_path", label: "Primary object key", storageArea: "design-assets" }, { name: "storage_paths", label: "Object keys JSON", type: "json", placeholder: "[]" }, { name: "link", label: "Source link" }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  competitor_profiles: {
    table: "competitor_profiles", title: "Competitor profiles", eyebrow: "Research", path: "/competitor-intel", orderBy: "name",
    description: "Maintain competitor positioning, channels, audience, threat level, and supporting notes.", columns: ["name", "category", "niche", "target_audience", "threat_level", "primary_url"],
    fields: [{ name: "name", label: "Competitor", required: true }, { name: "category", label: "Category" }, { name: "platforms", label: "Platforms JSON", type: "json", placeholder: "[]" }, { name: "primary_url", label: "Primary URL" }, { name: "niche", label: "Niche" }, { name: "target_audience", label: "Target audience", type: "textarea" }, { name: "followers", label: "Followers JSON", type: "json", placeholder: "{}" }, { name: "threat_level", label: "Threat level", type: "select", options: ["low", "medium", "high"] }, { name: "logo_url", label: "Logo object key / URL", storageArea: "design-assets" }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  content_library: {
    table: "content_library", title: "Content library", eyebrow: "Content", path: "/content-library", orderBy: "created_at", ascending: false,
    description: "Store reusable creative references, performance context, labels, copywriting, and source links.", columns: ["tipe", "platform", "jenis", "link", "views", "likes", "created_at"],
    fields: [{ name: "tipe", label: "Library type", type: "select", options: ["organic", "ads"] }, { name: "platform", label: "Platform", type: "select", options: ["Instagram", "TikTok", "X", "Threads", "YouTube"] }, { name: "jenis", label: "Content type", type: "select", options: ["Carousel", "Reels/Video", "Single Image", "Thread/Text"] }, { name: "link", label: "Content URL", required: true }, { name: "copywriting", label: "Copywriting", type: "textarea" }, { name: "views", label: "Views", type: "number" }, { name: "likes", label: "Likes", type: "number", required: true }, { name: "comments", label: "Comments", type: "number" }, { name: "shares", label: "Shares", type: "number" }, { name: "labels", label: "Labels JSON", type: "json", placeholder: "[]" }, { name: "storage_paths", label: "R2 object keys JSON", type: "json", placeholder: "[]" }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  resources: {
    table: "resources", title: "Resources", eyebrow: "Internal", path: "/resources", orderBy: "kategori",
    description: "Maintain internal links and credentials grouped by operational category.", columns: ["kategori", "nama", "tipe", "url", "email", "username"],
    fields: [{ name: "tipe", label: "Type", type: "select", options: ["link", "credential"] }, { name: "kategori", label: "Category", required: true }, { name: "nama", label: "Name", required: true }, { name: "url", label: "URL" }, { name: "email", label: "Email" }, { name: "username", label: "Username" }, { name: "password", label: "Password" }, { name: "notes", label: "Notes", type: "textarea" }, { name: "urutan", label: "Order", type: "number" }],
  },
  app_settings: {
    table: "app_settings", title: "Application settings", eyebrow: "Internal", path: "/settings", orderBy: "created_at", ascending: false,
    description: "Manage persisted application configuration values.", columns: ["key", "value", "updated_at"],
    fields: [{ name: "key", label: "Key", required: true }, { name: "value", label: "Value JSON", type: "json", required: true }], mutationRoles: ["admin"],
  },
  crm_deals: {
    table: "crm_deals", title: "CRM deals", eyebrow: "CRM", path: "/crm/deals", orderBy: "created_at", ascending: false,
    description: "Track parallel upsell, downsell, and cross-sell opportunities for buyers.", columns: ["buyer_id", "tipe", "produk_target", "harga_target", "stage", "tanggal"],
    fields: [{ name: "buyer_id", label: "Buyer ID", required: true }, { name: "tipe", label: "Deal type", type: "select", options: ["Upsell", "Downsell", "Cross-sell"] }, { name: "produk_target", label: "Target product" }, { name: "klas_target", label: "Target classification" }, { name: "harga_target", label: "Target value", type: "number" }, { name: "stage", label: "Stage", type: "select", options: ["Belum diblast", "Diblast", "Sedang di-upsell", "Sedang di-downsell", "Convert"] }, { name: "catatan", label: "Notes", type: "textarea" }, { name: "tanggal", label: "Date", type: "date" }],
  },
  tasks: {
    table: "tasks", title: "Program tasks", eyebrow: "Program", path: "/program/tasks", orderBy: "created_at", ascending: false,
    description: "Manage event tasks, phases, ownership, deadlines, linked tickets, and calendar state.", columns: ["title", "project_id", "phase", "status", "priority", "due_date", "ticket_id"],
    fields: [{ name: "project_id", label: "Program ID" }, { name: "title", label: "Title", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["Todo", "On Progress", "Done"] }, { name: "priority", label: "Priority", type: "select", options: ["High", "Med", "Low"] }, { name: "phase", label: "Phase", type: "select", options: ["Pre Event", "Hari H", "Post Event"] }, { name: "assignee_id", label: "Primary assignee ID" }, { name: "assignee_ids", label: "Assignee UUIDs", type: "uuid-array", placeholder: "uuid, uuid" }, { name: "due_date", label: "Deadline", type: "date" }, { name: "ticket_id", label: "Linked ticket ID" }, { name: "gcal_added", label: "Added to calendar", type: "checkbox" }, { name: "attachments", label: "Attachments JSON", type: "json", placeholder: "[]" }],
  },
  event_link_templates: {
    table: "event_link_templates", title: "Event link templates", eyebrow: "Program", path: "/program/link-templates", orderBy: "urutan",
    description: "Maintain reusable operational links grouped by program type.", columns: ["jenis_program", "label", "url", "urutan"],
    fields: [{ name: "jenis_program", label: "Program type", required: true }, { name: "label", label: "Label", required: true }, { name: "url", label: "URL", required: true }, { name: "urutan", label: "Order", type: "number" }], mutationRoles: ["admin"],
  },
  ig_targets: {
    table: "ig_targets", title: "Instagram targets", eyebrow: "Social", path: "/instagram/targets", orderBy: "year",
    description: "Set annual follower targets used by Instagram projections.", columns: ["year", "target_followers", "created_at"],
    fields: [{ name: "year", label: "Year", type: "number", required: true }, { name: "target_followers", label: "Target followers", type: "number", required: true }],
  },
  partner_deals: {
    table: "partner_deals", title: "B2B partnership deals", eyebrow: "Partnerships", path: "/b2b-partnership/deals", orderBy: "created_at", ascending: false,
    description: "Track multiple commercial scopes and values for each corporate partner.", columns: ["title", "partner_id", "stage", "scope", "deadline", "value"],
    fields: [{ name: "partner_id", label: "Partner ID", required: true }, { name: "title", label: "Deal", required: true }, { name: "stage", label: "Stage", type: "select", options: ["Active", "Negotiation", "Done", "Cancelled"] }, { name: "scope", label: "Scope", type: "textarea" }, { name: "deadline", label: "Deadline", type: "date" }, { name: "value", label: "Value", type: "number" }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  partner_outreach: {
    table: "partner_outreach", title: "B2B outreach log", eyebrow: "Partnerships", path: "/b2b-partnership/outreach", orderBy: "tanggal", ascending: false,
    description: "Record each partner contact attempt and its response.", columns: ["partner_id", "channel", "tanggal", "isi", "respons", "catatan"],
    fields: [{ name: "partner_id", label: "Partner ID", required: true }, { name: "channel", label: "Channel", type: "select", options: ["WhatsApp", "Email", "LinkedIn", "Meeting"] }, { name: "tanggal", label: "Date", type: "date", required: true }, { name: "isi", label: "Outreach message", type: "textarea" }, { name: "respons", label: "Response", type: "select", options: ["Replied", "No Reply", "Meeting Scheduled", "Declined"] }, { name: "catatan", label: "Notes", type: "textarea" }],
  },
  org_deals: {
    table: "org_deals", title: "Organization partnership deals", eyebrow: "Partnerships", path: "/org-partnership/deals", orderBy: "created_at", ascending: false,
    description: "Track scopes, deadlines, values, and status for organization partnerships.", columns: ["title", "org_partner_id", "stage", "scope", "deadline", "value"],
    fields: [{ name: "org_partner_id", label: "Organization ID", required: true }, { name: "title", label: "Deal", required: true }, { name: "stage", label: "Stage", type: "select", options: ["Active", "Negotiation", "Done", "Cancelled"] }, { name: "scope", label: "Scope", type: "textarea" }, { name: "deadline", label: "Deadline", type: "date" }, { name: "value", label: "Value", type: "number" }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  org_outreach: {
    table: "org_outreach", title: "Organization outreach log", eyebrow: "Partnerships", path: "/org-partnership/outreach", orderBy: "tanggal", ascending: false,
    description: "Record organization contact attempts and responses.", columns: ["org_partner_id", "channel", "tanggal", "isi", "respons", "catatan"],
    fields: [{ name: "org_partner_id", label: "Organization ID", required: true }, { name: "channel", label: "Channel", type: "select", options: ["WhatsApp", "Email", "LinkedIn", "Meeting"] }, { name: "tanggal", label: "Date", type: "date", required: true }, { name: "isi", label: "Outreach message", type: "textarea" }, { name: "respons", label: "Response", type: "select", options: ["Replied", "No Reply", "Meeting Scheduled", "Declined"] }, { name: "catatan", label: "Notes", type: "textarea" }],
  },
  competitor_snapshots: {
    table: "competitor_snapshots", title: "Competitor snapshots", eyebrow: "Research", path: "/competitor-intel/snapshots", orderBy: "snapshot_date", ascending: false,
    description: "Capture dated follower, advertising, and threat-level observations.", columns: ["competitor_id", "snapshot_date", "threat_level", "followers", "ads_active"],
    fields: [{ name: "competitor_id", label: "Competitor ID", required: true }, { name: "snapshot_date", label: "Snapshot date", type: "date", required: true }, { name: "threat_level", label: "Threat level", type: "select", options: ["low", "medium", "high"] }, { name: "followers", label: "Followers JSON", type: "json", placeholder: "{}" }, { name: "ads_active", label: "Ads active", type: "checkbox" }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  competitor_flags: {
    table: "competitor_flags", title: "Competitor intelligence flags", eyebrow: "Research", path: "/competitor-intel/flags", orderBy: "flag_date", ascending: false,
    description: "Log product, pricing, campaign, and other market changes.", columns: ["competitor_id", "flag_type", "flag_date", "description"],
    fields: [{ name: "competitor_id", label: "Competitor ID", required: true }, { name: "flag_type", label: "Flag type", type: "select", options: ["new_product", "price_change", "new_campaign", "other"] }, { name: "flag_date", label: "Date", type: "date", required: true }, { name: "description", label: "Description", type: "textarea", required: true }],
  },
  competitor_products: {
    table: "competitor_products", title: "Competitor products", eyebrow: "Research", path: "/competitor-intel/products", orderBy: "created_at", ascending: false,
    description: "Map competitor offers, positioning, pricing, features, links, and product imagery.", columns: ["competitor_id", "name", "category", "price_min", "price_max", "status"],
    fields: [{ name: "competitor_id", label: "Competitor ID", required: true }, { name: "name", label: "Product", required: true }, { name: "category", label: "Category" }, { name: "description", label: "Description", type: "textarea" }, { name: "price_min", label: "Minimum price", type: "number" }, { name: "price_max", label: "Maximum price", type: "number" }, { name: "status", label: "Status" }, { name: "features", label: "Features JSON", type: "json", placeholder: "[]" }, { name: "links", label: "Links JSON", type: "json", placeholder: "[]" }, { name: "image_url", label: "Primary image", storageArea: "design-assets" }, { name: "image_urls", label: "Images JSON", type: "json", placeholder: "[]" }],
  },
  competitor_product_prices: {
    table: "competitor_product_prices", title: "Competitor price history", eyebrow: "Research", path: "/competitor-intel/prices", orderBy: "recorded_at", ascending: false,
    description: "Keep dated price observations for competitor products.", columns: ["product_id", "price_min", "price_max", "recorded_at", "notes"],
    fields: [{ name: "product_id", label: "Product ID", required: true }, { name: "price_min", label: "Minimum price", type: "number" }, { name: "price_max", label: "Maximum price", type: "number" }, { name: "recorded_at", label: "Recorded date", type: "date", required: true }, { name: "notes", label: "Notes", type: "textarea" }],
  },
  pain_point_platforms: {
    table: "pain_point_platforms", title: "Pain-point platforms", eyebrow: "Customer knowledge", path: "/customer-knowledge/platforms", orderBy: "nama",
    description: "Maintain source platforms used by customer-language entries.", columns: ["nama", "created_at"], fields: [{ name: "nama", label: "Platform", required: true }],
  },
  pain_point_categories: {
    table: "pain_point_categories", title: "Pain-point categories", eyebrow: "Customer knowledge", path: "/customer-knowledge/categories", orderBy: "nama",
    description: "Maintain the customer pain-point taxonomy and display colors.", columns: ["nama", "color", "created_at"], fields: [{ name: "nama", label: "Category", required: true }, { name: "color", label: "Color", type: "select", options: ["purple", "blue", "teal", "amber", "coral", "pink", "green", "red"] }],
  },
  tkt_divisi: {
    table: "tkt_divisi", title: "Ticket divisions", eyebrow: "Tickets", path: "/tickets/divisions", orderBy: "nama",
    description: "Manage ticket ownership divisions and notification addresses.", columns: ["nama", "color", "email"], fields: [{ name: "nama", label: "Division", required: true }, { name: "color", label: "Color", type: "select", options: ["purple", "blue", "teal", "amber", "coral", "pink", "green", "red"] }, { name: "email", label: "Email" }], mutationRoles: ["admin"],
  },
  tkt_people: {
    table: "tkt_people", title: "Ticket people", eyebrow: "Tickets", path: "/tickets/people", orderBy: "nama",
    description: "Manage ticket assignees, email recipients, division membership, and access level.", columns: ["nama", "email", "divisi_id", "level", "auth_user_id"], fields: [{ name: "nama", label: "Name", required: true }, { name: "email", label: "Email", required: true }, { name: "divisi_id", label: "Division ID" }, { name: "level", label: "Level", type: "select", options: ["staff", "lead", "admin"] }, { name: "auth_user_id", label: "Linked account ID" }], mutationRoles: ["admin"],
  },
  tkt_types: {
    table: "tkt_types", title: "Ticket request types", eyebrow: "Tickets", path: "/tickets/types", orderBy: "nama",
    description: "Maintain request types and their owning division.", columns: ["nama", "divisi_id"], fields: [{ name: "nama", label: "Request type", required: true }, { name: "divisi_id", label: "Division ID" }], mutationRoles: ["admin"],
  },
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
      { name: "status", label: "Status", type: "select", options: ["Draft", "Pre-launch", "Live", "Archived"] },
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
    fields: [{ name: "judul", label: "Title", required: true }, { name: "tanggal_posting", label: "Publish date", type: "date" }, { name: "funnel", label: "Funnel", type: "select", options: ["TOFU", "MOFU", "BOFU"] }, { name: "cta", label: "CTA" }, { name: "assignee_id", label: "Assignee ID" }, { name: "status", label: "Status", type: "select", options: ["Draft", "Done"] }, { name: "link_brief", label: "Brief URL" }, { name: "link_referensi", label: "Reference URL" }],
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
    description: "Track creator profiles, niche, per-platform reach, contact details, and rate cards.", columns: ["nama", "niche", "username_ig", "followers_ig", "username_tiktok", "followers_tiktok"],
    fields: [{ name: "nama", label: "Name", required: true }, { name: "niche", label: "Niche" }, { name: "username_ig", label: "Instagram username" }, { name: "followers_ig", label: "Instagram followers", type: "number" }, { name: "username_tiktok", label: "TikTok username" }, { name: "followers_tiktok", label: "TikTok followers", type: "number" }, { name: "linkedin_url", label: "LinkedIn URL" }, { name: "contact", label: "Contact" }, { name: "rate_card_text", label: "Rate card", type: "textarea" }, { name: "rate_card_file_url", label: "Rate card object key / URL", storageArea: "uploads" }, { name: "foto_url", label: "Photo object key / URL", storageArea: "uploads" }, { name: "catatan", label: "Notes", type: "textarea" }],
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
    fields: [{ name: "ticket_no", label: "Ticket number" }, { name: "title", label: "Title", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["Todo", "In Progress", "Done"] }, { name: "priority", label: "Priority", type: "select", options: ["High", "Med", "Low"] }, { name: "type_id", label: "Request type ID" }, { name: "divisi_id", label: "Division ID" }, { name: "assigned_to_id", label: "Primary assignee ID" }, { name: "assigned_to_ids", label: "Assignee UUIDs", type: "uuid-array", placeholder: "uuid, uuid" }, { name: "requester_id", label: "Requester ID" }, { name: "due_date", label: "Deadline", type: "date" }, { name: "cc", label: "CC JSON", type: "json", placeholder: "[]" }, { name: "links", label: "Links JSON", type: "json", placeholder: "[]" }, { name: "files", label: "Files JSON", type: "json", placeholder: "[]" }, { name: "komentar", label: "Comments JSON", type: "json", placeholder: "[]" }, { name: "notification_roles", label: "Notify roles", type: "text-array", required: true }, { name: "source", label: "Source" }, { name: "gcal_added", label: "Added to calendar", type: "checkbox" }],
  },
} as const satisfies Record<string, RecordDefinition>;

export type RecordDefinitionKey = keyof typeof recordDefinitions;

export function isRecordDefinitionKey(value: string): value is RecordDefinitionKey {
  return value in recordDefinitions;
}
