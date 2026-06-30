import { RecordManager } from "@/app/_components/record-manager";
import { listCarouselPlans } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export const metadata = { title: "Carousel Planning" };

export default async function CarouselsPage() {
  return <RecordManager definitionKey="carousel_plans" links={contentPlanningLinks} rows={await listCarouselPlans()} />;
}
