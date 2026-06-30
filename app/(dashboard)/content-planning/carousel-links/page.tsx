import { RecordManager } from "@/app/_components/record-manager";
import { listCarouselPlanLinks } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export default async function CarouselLinksPage() {
  return <RecordManager definitionKey="carousel_plan_links" links={contentPlanningLinks} rows={await listCarouselPlanLinks()} />;
}
