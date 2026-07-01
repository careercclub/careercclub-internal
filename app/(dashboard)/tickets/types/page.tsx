import { RecordManager } from "@/app/_components/record-manager";
import { listTicketTypes } from "@/lib/api/tickets";
import { ticketLinks } from "@/lib/records/links";

export default async function TicketTypesPage() {
  return <RecordManager definitionKey="tkt_types" links={ticketLinks} rows={await listTicketTypes()} />;
}
