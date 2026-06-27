import "server-only";
import { countRows, listRows } from "@/lib/db/query";
import type { TableName } from "@/lib/db/tables";
import type { ApiRecord } from "./_crud";

const dashboardCounts: { label: string; table: TableName }[] = [
  { label: "programs", table: "events" },
  { label: "tasks", table: "tasks" },
  { label: "crmDeals", table: "crm_deals" },
  { label: "tickets", table: "tickets" },
  { label: "contentAssets", table: "content_library" },
];

export type ActivityLogRecord = ApiRecord & {
  user_name?: string | null;
  module?: string | null;
  action?: string | null;
  detail?: string | null;
};

export async function getDashboardCounts() {
  const entries = await Promise.all(
    dashboardCounts.map(async ({ label, table }) => [label, await countRows(table)] as const),
  );

  return Object.fromEntries(entries) as Record<(typeof dashboardCounts)[number]["label"], number>;
}

export function listRecentActivity(limit = 20) {
  return listRows<ActivityLogRecord>("activity_log", {
    orderBy: "created_at",
    ascending: false,
    limit,
  });
}
