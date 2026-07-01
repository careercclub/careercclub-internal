"use server";

import { auth } from "@/auth";
import { reorderResources } from "@/lib/api/resources";
import { revalidatePath } from "next/cache";

export async function reorderResourcesAction(rows: Array<{ id: string; kategori: string; urutan: number }>) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const normalized = rows.slice(0, 500).map((row, index) => ({ id: String(row.id), kategori: String(row.kategori).slice(0, 100), urutan: Number.isInteger(row.urutan) ? row.urutan : index }));
  if (normalized.some((row) => !/^[0-9a-f-]{36}$/i.test(row.id))) throw new Error("Invalid resource order.");
  await reorderResources(normalized);
  revalidatePath("/resources");
}
