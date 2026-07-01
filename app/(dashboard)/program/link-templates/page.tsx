import { RecordManager } from "@/app/_components/record-manager";
import { listEventLinkTemplates } from "@/lib/api/program";
import { programLinks } from "@/lib/records/links";

export default async function ProgramLinkTemplatesPage() {
  return <RecordManager definitionKey="event_link_templates" links={programLinks} rows={await listEventLinkTemplates()} />;
}
