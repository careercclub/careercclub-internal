import { RecordManager } from "@/app/_components/record-manager";
import { listTicketPeople } from "@/lib/api/tickets";
import { ticketLinks } from "@/lib/records/links";

export default async function TicketPeoplePage() {
  return <RecordManager definitionKey="tkt_people" links={ticketLinks} rows={await listTicketPeople()} />;
}
