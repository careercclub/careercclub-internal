import { RecordManager } from "@/app/_components/record-manager";
import { listProductFeatureLinks } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export default async function ProductFeatureLinksPage() {
  return <RecordManager definitionKey="product_feature_links" links={productLinks} rows={await listProductFeatureLinks()} />;
}
