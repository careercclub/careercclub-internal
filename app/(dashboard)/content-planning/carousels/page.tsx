import { RecordManager } from "@/app/_components/record-manager";
import { listCarouselPlans } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export const metadata = { title: "Carousel Planning" };

export default async function CarouselsPage() {
  return <RecordManager definitionKey="carousel_plans" links={contentPlanningLinks} rows={await listCarouselPlans()} tools={<AiTextRecordParser definitionKey="carousel_plans" kind="carousel" title="Create carousel plan from text" fields={[{ name: "judul", label: "Title", required: true }, { name: "tanggal_posting", label: "Publish date", type: "date" }, { name: "funnel", label: "Funnel", type: "select", options: ["TOFU", "MOFU", "BOFU"] }, { name: "cta", label: "CTA" }, { name: "status", label: "Status", type: "select", options: ["Draft", "Done"] }]} />} />;
}
import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
