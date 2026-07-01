"use server";

import { auth } from "@/auth";
import { createProductAsset, createProductBenefit, createProductBundle, createProductFeature, createProductFeatureLink, createProductFeedback, createProductPainPoint, createProductPassionPoint, createSubProduct, createSubProductLink, deleteProductAsset, deleteProductBenefit, deleteProductBundle, deleteProductFeature, deleteProductFeatureLink, deleteProductFeedback, deleteProductPainPoint, deleteProductPassionPoint, deleteSubProduct, deleteSubProductLink } from "@/lib/api/products";
import { revalidatePath } from "next/cache";

type Kind = "pain" | "passion" | "benefit" | "feature" | "featureLink" | "subProduct" | "subLink" | "asset" | "feedback" | "bundle";
async function requireUser() { if (!(await auth())?.user) throw new Error("Unauthorized"); }
const value = (data: FormData, key: string) => String(data.get(key) || "").trim();

export async function createProductKnowledgeAction(kind: Kind, productId: string, data: FormData) {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(productId)) throw new Error("Invalid product.");
  if (kind === "pain") await createProductPainPoint({ product_id: productId, nama: value(data,"nama"), text: value(data,"text") });
  if (kind === "passion") await createProductPassionPoint({ product_id: productId, nama: value(data,"nama"), text: value(data,"text") });
  if (kind === "benefit") await createProductBenefit({ product_id: productId, nama: value(data,"nama"), text: value(data,"text") });
  if (kind === "feature") await createProductFeature({ product_id: productId, name: value(data,"nama"), description: value(data,"text") });
  if (kind === "featureLink") await createProductFeatureLink({ feature_id: value(data,"parent_id"), label: value(data,"nama"), url: value(data,"url") });
  if (kind === "subProduct") await createSubProduct({ product_id: productId, name: value(data,"nama"), harga: Number(value(data,"harga") || 0) });
  if (kind === "subLink") await createSubProductLink({ sub_product_id: value(data,"parent_id"), label: value(data,"nama"), url: value(data,"url") });
  if (kind === "asset") await createProductAsset({ product_id: productId, nama: value(data,"nama"), tipe: value(data,"tipe") || "Link", url: value(data,"url"), status: value(data,"status") || "Draft" });
  if (kind === "feedback") await createProductFeedback({ product_id: productId, tipe: value(data,"tipe") || "Improvement", isi: value(data,"text"), tanggal: value(data,"tanggal") });
  if (kind === "bundle") await createProductBundle({ bundle_id: productId, item_id: value(data,"parent_id") });
  revalidatePath("/products");
}

export async function deleteProductKnowledgeAction(kind: Kind, id: string) {
  await requireUser();
  if (kind === "pain") await deleteProductPainPoint(id); if (kind === "passion") await deleteProductPassionPoint(id);
  if (kind === "benefit") await deleteProductBenefit(id); if (kind === "feature") await deleteProductFeature(id);
  if (kind === "featureLink") await deleteProductFeatureLink(id); if (kind === "subProduct") await deleteSubProduct(id);
  if (kind === "subLink") await deleteSubProductLink(id); if (kind === "asset") await deleteProductAsset(id);
  if (kind === "feedback") await deleteProductFeedback(id); if (kind === "bundle") await deleteProductBundle(id);
  revalidatePath("/products");
}
