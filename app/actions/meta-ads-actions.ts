"use server";

import { auth } from "@/auth";
import { syncAdsFromContentEvaluations } from "@/lib/api/meta-ads";
import { revalidatePath } from "next/cache";

export async function syncMetaAdsAction() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await syncAdsFromContentEvaluations();
  revalidatePath("/meta-ads");
}
