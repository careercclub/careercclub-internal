import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type ProductRecord = ApiRecord;
export type ProductPainPointRecord = ApiRecord;
export type ProductPassionPointRecord = ApiRecord;

const products = createTableApi<ProductRecord>("products", {
  orderBy: "created_at",
  ascending: true,
});

const painPoints = createTableApi<ProductPainPointRecord>("product_pain_points", {
  orderBy: "created_at",
  ascending: true,
});

const passionPoints = createTableApi<ProductPassionPointRecord>("product_passion_points", {
  orderBy: "created_at",
  ascending: true,
});

export const listProducts = products.list;
export const countProducts = products.count;
export const getProduct = products.get;
export const createProduct = products.create;
export const updateProduct = products.update;
export const deleteProduct = products.remove;

export const listProductPainPoints = painPoints.list;
export const createProductPainPoint = painPoints.create;
export const updateProductPainPoint = painPoints.update;
export const deleteProductPainPoint = painPoints.remove;

export const listProductPassionPoints = passionPoints.list;
export const createProductPassionPoint = passionPoints.create;
export const updateProductPassionPoint = passionPoints.update;
export const deleteProductPassionPoint = passionPoints.remove;
