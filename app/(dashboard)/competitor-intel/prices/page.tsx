import { RecordManager } from "@/app/_components/record-manager";
import { listCompetitorProductPrices } from "@/lib/api/competitor-intel";
import { competitorLinks } from "@/lib/records/links";

export default async function CompetitorPricesPage() {
  return <RecordManager definitionKey="competitor_product_prices" links={competitorLinks} rows={await listCompetitorProductPrices()} />;
}
