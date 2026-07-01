"use server";

import { auth } from "@/auth";
import { updateRow } from "@/lib/db/query";
import { revalidatePath } from "next/cache";

const pipelines = {
  partners: { column: "status", path: "/b2b-partnership", statuses: ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"] },
  org_partners: { column: "status", path: "/org-partnership", statuses: ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"] },
  crm_deals: { column: "stage", path: "/crm/deals", statuses: ["Belum diblast", "Diblast", "Sedang di-upsell", "Sedang di-downsell", "Convert"] },
} as const;

export async function movePipelineRecord(table: keyof typeof pipelines, id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const pipeline = pipelines[table];
  if (!pipeline.statuses.some((item) => item === status)) throw new Error("Invalid pipeline status.");
  await updateRow(table, id, { [pipeline.column]: status });
  revalidatePath(pipeline.path);
}
