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

export async function saveMenuLabelsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("Admin access required.");
  const allSections = formData.getAll("all_section").map(String);
  const sections = allSections.map((section) => ({
    section,
    label: String(formData.get(`section_label__${section}`) || section).trim() || section,
  }));
  const allSlugs = formData.getAll("all_slug").map(String);
  const items = allSlugs.map((slug) => ({
    slug,
    label: String(formData.get(`item_label__${slug}`) || "").trim(),
  })).filter((item) => item.label);
  await saveAppSetting("menu_labels", { sections, items });
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function saveCompetitorIntelListsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("Admin access required.");
  const categories = formData.getAll("category").map(String).map((value) => value.trim()).filter(Boolean);
  const targetAudience = formData.getAll("target_audience").map(String).map((value) => value.trim()).filter(Boolean);
  await saveAppSetting("ci_product_categories", categories);
  await saveAppSetting("ci_target_audience", targetAudience);
  revalidatePath("/settings");
}
