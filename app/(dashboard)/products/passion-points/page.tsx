import { RecordManager } from "@/app/_components/record-manager";
import { listProductPassionPoints } from "@/lib/api/products";
import { productLinks } from "@/lib/records/links";

export default async function ProductPassionPointsPage() {
  return <RecordManager definitionKey="product_passion_points" links={productLinks} rows={await listProductPassionPoints()} />;
}
