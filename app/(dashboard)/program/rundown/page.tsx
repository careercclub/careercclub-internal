import { RecordManager } from "@/app/_components/record-manager";
import { listEventRundown } from "@/lib/api/program";
import { programLinks } from "@/lib/records/links";

export const metadata = { title: "Event Rundown" };

export default async function EventRundownPage() {
  return <RecordManager definitionKey="event_rundown" links={programLinks} rows={await listEventRundown()} />;
}
