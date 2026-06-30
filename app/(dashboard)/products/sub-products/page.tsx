import { RecordManager } from "@/app/_components/record-manager";
import { listSubProducts } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export const metadata = { title: "Sub-products" };

export default async function SubProductsPage() {
  return <RecordManager definitionKey="sub_products" links={productLinks} rows={await listSubProducts()} />;
}
