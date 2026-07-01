import { ProductWorkbench } from "@/app/_components/product-workbench";
import { RecordManager } from "@/app/_components/record-manager";
import { getProductKnowledgeWorkspace } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const workspace = await getProductKnowledgeWorkspace();
  return <ProductWorkbench workspace={workspace} management={<RecordManager definitionKey="products" links={productLinks} rows={workspace.products} />} />;
}
