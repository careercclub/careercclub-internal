"use server";

import { auth } from "@/auth";
import { saveAppSetting } from "@/lib/api/settings";
import { revalidatePath } from "next/cache";

export async function saveMenuVisibilityAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("Admin access required.");
  const all = formData.getAll("all_slug").map(String);
  const visible = new Set(formData.getAll("visible_slug").map(String));
  await saveAppSetting("menu_visibility", { hiddenSlugs: all.filter((slug) => !visible.has(slug)) });
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}
