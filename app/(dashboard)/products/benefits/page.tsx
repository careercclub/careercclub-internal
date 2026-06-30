import { RecordManager } from "@/app/_components/record-manager";
import { listProductBenefits } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export default async function ProductBenefitsPage() {
  return <RecordManager definitionKey="product_benefits" links={productLinks} rows={await listProductBenefits()} />;
}
