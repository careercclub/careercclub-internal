import { RecordManager } from "@/app/_components/record-manager";
import { listProductFeatures } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export const metadata = { title: "Product Features" };

export default async function ProductFeaturesPage() {
  return <RecordManager definitionKey="product_features" links={productLinks} rows={await listProductFeatures()} />;
}
