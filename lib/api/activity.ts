import "server-only";
import { insertRow } from "@/lib/db/query";
import type { TableName } from "@/lib/db/tables";

const skippedTables = new Set<string>([
  "activity_log",
  "mt_industries",
  "mt_companies",
  "divisi",
  "people",
  "ticket_types",
]);

type ActivityInput = {
  userName: string;
  module: string;
  action: string;
  detail?: string | null;
  table?: TableName;
};

export async function logActivity(input: ActivityInput) {
  if (input.table && skippedTables.has(input.table)) return;

  try {
    await insertRow("activity_log", {
      user_name: input.userName,
      module: input.module,
      action: input.action,
      detail: input.detail?.slice(0, 120) || "",
    });
  } catch (error) {
    // Activity history must never make the original mutation fail.
    console.error("Activity could not be recorded", error);
  }
}
