"use server";

import { expected } from "@/lib/actions/expected";
import { deleteWithDependents } from "@/lib/records/delete";

import { auth } from "@/auth";
import { createProductAsset, createProductBenefit, createProductBundle, createProductFeature, createProductFeatureLink, createProductFeedback, createProductPainPoint, createProductPassionPoint, createSubProduct, createSubProductLink } from "@/lib/api/products";
import { revalidatePath } from "next/cache";

const KIND_TABLE: Record<string, string> = { pain: "product_pain_points", passion: "product_passion_points", benefit: "product_benefits", feature: "product_features", featureLink: "product_feature_links", subProduct: "sub_products", subLink: "sub_product_links", asset: "product_assets", feedback: "product_feedbacks", bundle: "product_bundles" };
type Kind = "pain" | "passion" | "benefit" | "feature" | "featureLink" | "subProduct" | "subLink" | "asset" | "feedback" | "bundle";
async function requireUser() { if (!(await auth())?.user) throw new Error("Unauthorized"); }
const value = (data: FormData, key: string) => String(data.get(key) || "").trim();

export async function createProductKnowledgeAction(kind: Kind, productId: string, data: FormData) {
  return expected(async () => {
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
  });
}

export async function deleteProductKnowledgeAction(kind: Kind, id: string) {
  return expected(async () => {
  await requireUser();
  // Shortlinks of a feature or sub-product go with it (lib/records/delete-rules.ts).
  const table = KIND_TABLE[kind];
  if (!table) throw new Error("Unknown item.");
  await deleteWithDependents(table, [id]);
  revalidatePath("/products");
  });
}
