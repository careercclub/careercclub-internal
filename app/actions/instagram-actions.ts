"use server";

import { auth } from "@/auth";
import { saveInstagramBaseline } from "@/lib/api/instagram";
import { revalidatePath } from "next/cache";

export async function saveInstagramBaselineAction(formData: FormData) {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  const followers = Number(formData.get("followers_total"));
  const date = String(formData.get("baseline_date") || "");
  if (!Number.isInteger(followers) || followers <= 0) throw new Error("Followers must be a positive whole number.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("A valid baseline date is required.");
  await saveInstagramBaseline(followers, date);
  revalidatePath("/instagram");
}
