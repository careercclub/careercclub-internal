import { ProductTools } from "@/app/_components/product-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { getProductKnowledgeWorkspace } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const workspace = await getProductKnowledgeWorkspace();
  return <RecordManager definitionKey="products" links={productLinks} rows={workspace.products} tools={<ProductTools workspace={workspace} />} />;
}
