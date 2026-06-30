import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type ProductRecord = ApiRecord;
export type ProductPainPointRecord = ApiRecord;
export type ProductPassionPointRecord = ApiRecord;
export type ProductBenefitRecord = ApiRecord;
export type ProductFeatureRecord = ApiRecord;
export type ProductFeatureLinkRecord = ApiRecord;
export type ProductBundleRecord = ApiRecord;
export type ProductClassificationRecord = ApiRecord;
export type MasterProductRecord = ApiRecord;
export type SubProductRecord = ApiRecord;
export type SubProductLinkRecord = ApiRecord;

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

const benefits = createTableApi<ProductBenefitRecord>("product_benefits", { orderBy: "created_at" });
const features = createTableApi<ProductFeatureRecord>("product_features", { orderBy: "created_at" });
const featureLinks = createTableApi<ProductFeatureLinkRecord>("product_feature_links", { orderBy: "created_at" });
const bundles = createTableApi<ProductBundleRecord>("product_bundles", { orderBy: "created_at" });
const classifications = createTableApi<ProductClassificationRecord>("product_klasifikasi", { orderBy: "name" });
const masterProducts = createTableApi<MasterProductRecord>("master_produk", { orderBy: "nama" });
const subProducts = createTableApi<SubProductRecord>("sub_products", { orderBy: "created_at" });
const subProductLinks = createTableApi<SubProductLinkRecord>("sub_product_links", { orderBy: "created_at" });

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

export const listProductBenefits = benefits.list;
export const createProductBenefit = benefits.create;
export const updateProductBenefit = benefits.update;
export const deleteProductBenefit = benefits.remove;

export const listProductFeatures = features.list;
export const createProductFeature = features.create;
export const updateProductFeature = features.update;
export const deleteProductFeature = features.remove;

export const listProductFeatureLinks = featureLinks.list;
export const createProductFeatureLink = featureLinks.create;
export const deleteProductFeatureLink = featureLinks.remove;

export const listProductBundles = bundles.list;
export const createProductBundle = bundles.create;
export const deleteProductBundle = bundles.remove;

export const listProductClassifications = classifications.list;
export const createProductClassification = classifications.create;
export const deleteProductClassification = classifications.remove;

export const listMasterProducts = masterProducts.list;
export const createMasterProduct = masterProducts.create;
export const updateMasterProduct = masterProducts.update;
export const deleteMasterProduct = masterProducts.remove;

export const listSubProducts = subProducts.list;
export const createSubProduct = subProducts.create;
export const updateSubProduct = subProducts.update;
export const deleteSubProduct = subProducts.remove;

export const listSubProductLinks = subProductLinks.list;
export const createSubProductLink = subProductLinks.create;
export const deleteSubProductLink = subProductLinks.remove;
