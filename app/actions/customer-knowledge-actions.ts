"use server";

import { auth } from "@/auth";
import { updatePainPoint } from "@/lib/api/customer-knowledge";
import { revalidatePath } from "next/cache";

export async function updatePainPointLabelsAction(id: string, formData: FormData) {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  const labels = formData.getAll("labels").map(String).map((value) => value.trim()).filter(Boolean);
  const created = String(formData.get("new_label") || "").trim();
  if (created) labels.push(created);
  await updatePainPoint(id, { labels: [...new Set(labels)] });
  revalidatePath("/customer-knowledge");
}
