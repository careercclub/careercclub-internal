"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import { createCarouselPlanLink, createStoryPlanItem, updateStoryPlanDate } from "@/lib/api/content-planning";
import { createStoryPlanWithItems } from "@/lib/api/content-planning";
import { revalidatePath } from "next/cache";

export async function createStoryPlanFromTextAction(input: { tanggal: string; status?: string; items: Array<{ urutan?: number; isi?: string }> }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await createStoryPlanWithItems(input);
  await logActivity({ userName: session.user.name || session.user.email || "CCC User", module: "Story planner", action: "Tambah", detail: input.tanggal, table: "story_plan_dates" });
  revalidatePath("/content-planning");
  revalidatePath("/content-planning/stories");
}

export async function addStorySlideAction(dateId: string, formData: FormData) {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  const content = String(formData.get("isi") || "").trim();
  const order = Number(formData.get("urutan") || 1);
  if (!content) throw new Error("Slide content is required.");
  await createStoryPlanItem({ date_id: dateId, isi: content, urutan: Number.isFinite(order) ? order : 1 });
  revalidatePath("/content-planning");
}

export async function setStoryPlanStatusAction(dateId: string, status: "Draft" | "Done") {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  await updateStoryPlanDate(dateId, { status });
  revalidatePath("/content-planning");
}

export async function addCarouselPlanLinkAction(planId: string, formData: FormData) {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  const label = String(formData.get("label") || "").trim();
  const url = String(formData.get("url") || "").trim();
  if (!label || !/^https?:\/\//i.test(url)) throw new Error("A label and valid URL are required.");
  await createCarouselPlanLink({ plan_id: planId, label, url });
  revalidatePath("/content-planning");
}
