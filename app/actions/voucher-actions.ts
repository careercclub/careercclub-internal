"use server";

import { auth } from "@/auth";
import { incrementVoucherUsage } from "@/lib/api/voucher";
import { revalidatePath } from "next/cache";

export async function changeVoucherUsage(id: string, amount: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!Number.isInteger(amount) || Math.abs(amount) !== 1) throw new Error("Invalid usage adjustment.");
  await incrementVoucherUsage(id, amount);
  revalidatePath("/voucher");
}
