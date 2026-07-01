import { RecordManager } from "@/app/_components/record-manager";
import { listCompetitorProducts } from "@/lib/api/competitor-intel";
import { competitorLinks } from "@/lib/records/links";

export default async function CompetitorProductsPage() {
  return <RecordManager definitionKey="competitor_products" links={competitorLinks} rows={await listCompetitorProducts()} />;
}
