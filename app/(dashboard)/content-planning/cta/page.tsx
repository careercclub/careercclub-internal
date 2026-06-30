import { RecordManager } from "@/app/_components/record-manager";
import { listCarouselCtas } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export const metadata = { title: "Carousel CTA Master" };

export default async function CarouselCtaPage() {
  return <RecordManager definitionKey="carousel_cta_options" links={contentPlanningLinks} rows={await listCarouselCtas()} />;
}
