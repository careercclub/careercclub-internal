import "server-only";

export const tableNames = [
  "activity_log",
  "ads_contents",
  "app_settings",
  "auth_users",
  "buyers",
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
  "events",
  "free_class_eval",
  "ig_snapshots",
  "ig_targets",
  "mt_industries",
  "mt_vacancies",
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
  "products",
  "resources",
  "tasks",
  "tickets",
  "tkt_divisi",
  "tkt_people",
  "tkt_types",
  "vouchers",
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
