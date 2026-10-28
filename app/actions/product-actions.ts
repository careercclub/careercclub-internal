"use server";

import { expected } from "@/lib/actions/expected";

import { auth } from "@/auth";
import { duplicateProduct } from "@/lib/api/products";
import { revalidatePath } from "next/cache";

export async function duplicateProductAction(formData: FormData) {
  return expected(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const productId = String(formData.get("product_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!productId || !name) throw new Error("Source product and duplicate name are required.");
  await duplicateProduct(productId, name);
  revalidatePath("/products");
  });
}
