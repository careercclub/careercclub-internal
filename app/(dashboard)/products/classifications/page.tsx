import { RecordManager } from "@/app/_components/record-manager";
import { listProductClassifications } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export const metadata = { title: "Product Classifications" };

export default async function ProductClassificationsPage() {
  return <RecordManager definitionKey="product_klasifikasi" links={productLinks} rows={await listProductClassifications()} />;
}
