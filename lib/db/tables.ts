import "server-only";

export const tableNames = [
  "activity_log",
  "ads_contents",
  "app_settings",
  "auth_users",
  "buyers",
  "carousel_cta_options",
  "carousel_plan_links",
  "carousel_plans",
  "collaborators",
  "competitor_flags",
  "competitor_product_prices",
  "competitor_products",
  "competitor_profiles",
  "competitor_snapshots",
  "content_evaluations",
  "content_library",
  "content_plans",
  "crm_deals",
  "design_assets",
  "event_link_templates",
  "event_rundown",
  "events",
  "free_class_eval",
  "ig_snapshots",
  "ig_targets",
  "kol_list",
  "master_produk",
  "mt_industries",
  "mt_vacancies",
  "mt_story_list",
  "org_deals",
  "org_outreach",
  "org_partners",
  "pain_point_categories",
  "pain_point_platforms",
  "pain_points",
  "partner_deals",
  "partner_outreach",
  "partners",
  "product_pain_points",
  "product_passion_points",
  "product_benefits",
  "product_bundles",
  "product_feature_links",
  "product_features",
  "product_klasifikasi",
  "products",
  "resources",
  "story_plan_dates",
  "story_plan_items",
  "story_plan_links",
  "sub_product_links",
  "sub_products",
  "talent_pool",
  "tasks",
  "ticket_notification_reads",
  "ticket_notifications",
  "tickets",
  "tkt_divisi",
  "tkt_people",
  "tkt_types",
  "vouchers",
  "web_push_subscriptions",
] as const;

export type TableName = (typeof tableNames)[number];

const tableNameSet = new Set<string>(tableNames);

export function assertTableName(table: string): asserts table is TableName {
  if (!tableNameSet.has(table)) {
    throw new Error(`Table is not registered for module API access: ${table}`);
  }
}

export function assertIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
}
