"use server";

import { expected } from "@/lib/actions/expected";

import { auth } from "@/auth";
import { getResource, reorderResources } from "@/lib/api/resources";
import { logActivity } from "@/lib/api/activity";
import { revalidatePath } from "next/cache";

export async function reorderResourcesAction(rows: Array<{ id: string; kategori: string; urutan: number }>) {
  return expected(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const normalized = rows.slice(0, 500).map((row, index) => ({ id: String(row.id), kategori: String(row.kategori).slice(0, 100), urutan: Number.isInteger(row.urutan) ? row.urutan : index }));
  if (normalized.some((row) => !/^[0-9a-f-]{36}$/i.test(row.id))) throw new Error("Invalid resource order.");
  await reorderResources(normalized);
  revalidatePath("/resources");
  });
}

/** A resource's password, for Show / Copy. Logged in the activity log (who, which resource). */
export async function revealResourcePasswordAction(id: string) {
  return expected(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw new Error("Unknown resource.");
  const row = await getResource(String(id));
  if (!row) throw new Error("This resource no longer exists.");
  await logActivity({ userName: session.user.name || session.user.email || "CCC User", module: "Resources", action: "Lihat password", detail: String(row.nama || "") });
  return String(row.password || "");
  });
}
