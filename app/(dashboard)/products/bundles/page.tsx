import { RecordManager } from "@/app/_components/record-manager";
import { listProductBundles } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export const metadata = { title: "Product Bundles" };

export default async function ProductBundlesPage() {
  return <RecordManager definitionKey="product_bundles" links={productLinks} rows={await listProductBundles()} />;
}
