import { RecordManager } from "@/app/_components/record-manager";
import { listProductPainPoints } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export default async function ProductPainPointsPage() {
  return <RecordManager definitionKey="product_pain_points" links={productLinks} rows={await listProductPainPoints()} />;
}
