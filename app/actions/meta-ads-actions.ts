"use server";

import { expected } from "@/lib/actions/expected";

import { auth } from "@/auth";
import { syncAdsFromContentEvaluations, updateAdsContent } from "@/lib/api/meta-ads";
import { revalidatePath } from "next/cache";

export async function syncMetaAdsAction() {
  return expected(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await syncAdsFromContentEvaluations();
  revalidatePath("/meta-ads");
  });
}

export async function setMetaAdsDecisionAction(id: string, decision: "Boost" | "Pending" | "Skip") {
  return expected(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!["Boost", "Pending", "Skip"].includes(decision)) throw new Error("Invalid ads decision.");
  await updateAdsContent(id, { ad_decision: decision });
  revalidatePath("/meta-ads");
  });
}
