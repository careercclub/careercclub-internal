import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

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

export async function getProductKnowledgeWorkspace() {
  const [productRows, painPointRows, passionPointRows, benefitRows, featureRows, featureLinkRows, bundleRows, subProductRows, subProductLinkRows] = await Promise.all([
    listProducts(), listProductPainPoints(), listProductPassionPoints(), listProductBenefits(),
    listProductFeatures(), listProductFeatureLinks(), listProductBundles(), listSubProducts(), listSubProductLinks(),
  ]);
  return {
    products: productRows,
    painPoints: painPointRows,
    passionPoints: passionPointRows,
    benefits: benefitRows,
    features: featureRows,
    featureLinks: featureLinkRows,
    bundles: bundleRows,
    subProducts: subProductRows,
    subProductLinks: subProductLinkRows,
  };
}

export function duplicateProduct(sourceId: string, name: string) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const [source] = await tx<{
      id: string; type: string | null; kategori: string | null; harga: number | null;
      deskripsi: string | null; link: string | null; cover_url: string | null;
    }[]>`select * from products where id = ${sourceId}`;
    if (!source) throw new Error("Product not found.");
    const [created] = await tx<{ id: string }[]>`
      insert into products (nama, type, kategori, harga, status, deskripsi, link, cover_url)
      values (${name}, ${source.type || "satuan"}, ${source.kategori || null}, ${source.harga || 0}, 'Draft', ${source.deskripsi || null}, ${source.link || null}, ${source.cover_url || null})
      returning id
    `;
    await tx`
      insert into product_pain_points (product_id, text, severity, source)
      select ${created.id}, text, severity, source from product_pain_points where product_id = ${source.id}
    `;
    await tx`
      insert into product_passion_points (product_id, text, severity, source)
      select ${created.id}, text, severity, source from product_passion_points where product_id = ${source.id}
    `;
    await tx`
      insert into product_benefits (product_id, nama, text)
      select ${created.id}, nama, text from product_benefits where product_id = ${source.id}
    `;
    const sourceFeatures = await tx<{ id: string; name: string; description: string }[]>`
      select id, name, description from product_features where product_id = ${source.id} order by created_at
    `;
    for (const feature of sourceFeatures) {
      const [newFeature] = await tx<{ id: string }[]>`
        insert into product_features (product_id, name, description)
        values (${created.id}, ${feature.name}, ${feature.description}) returning id
      `;
      await tx`
        insert into product_feature_links (feature_id, label, url)
        select ${newFeature.id}, label, url from product_feature_links where feature_id = ${feature.id}
      `;
    }
    const sourceSubProducts = await tx<{ id: string; name: string; harga: number }[]>`
      select id, name, harga from sub_products where product_id = ${source.id} order by created_at
    `;
    for (const subProduct of sourceSubProducts) {
      const [newSubProduct] = await tx<{ id: string }[]>`
        insert into sub_products (product_id, name, harga)
        values (${created.id}, ${subProduct.name}, ${subProduct.harga}) returning id
      `;
      await tx`
        insert into sub_product_links (sub_product_id, label, url)
        select ${newSubProduct.id}, label, url from sub_product_links where sub_product_id = ${subProduct.id}
      `;
    }
    await tx`
      insert into product_bundles (bundle_id, item_id)
      select ${created.id}, item_id from product_bundles where bundle_id = ${source.id}
      on conflict do nothing
    `;
    return created.id;
  }));
}
