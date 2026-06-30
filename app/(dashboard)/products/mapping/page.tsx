import { RecordManager } from "@/app/_components/record-manager";
import { listMasterProducts } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export const metadata = { title: "Product Import Mapping" };

export default async function ProductMappingPage() {
  return <RecordManager definitionKey="master_produk" links={productLinks} rows={await listMasterProducts()} />;
}
