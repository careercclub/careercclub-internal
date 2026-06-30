import { RecordManager } from "@/app/_components/record-manager";
import { listProducts } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  return <RecordManager definitionKey="products" links={productLinks} rows={await listProducts()} />;
}
