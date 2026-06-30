import { RecordManager } from "@/app/_components/record-manager";
import { listSubProductLinks } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export default async function SubProductLinksPage() {
  return <RecordManager definitionKey="sub_product_links" links={productLinks} rows={await listSubProductLinks()} />;
}
