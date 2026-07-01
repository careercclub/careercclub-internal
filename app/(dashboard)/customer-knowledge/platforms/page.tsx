import { RecordManager } from "@/app/_components/record-manager";
import { listPainPointPlatforms } from "@/lib/api/customer-knowledge";
import { customerKnowledgeLinks } from "@/lib/records/links";

export default async function PainPointPlatformsPage() {
  return <RecordManager definitionKey="pain_point_platforms" links={customerKnowledgeLinks} rows={await listPainPointPlatforms()} />;
}
