"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
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
