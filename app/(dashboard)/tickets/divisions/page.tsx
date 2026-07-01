import { RecordManager } from "@/app/_components/record-manager";
import { listTicketDivisions } from "@/lib/api/tickets";
import { ticketLinks } from "@/lib/records/links";

export default async function TicketDivisionsPage() {
  return <RecordManager definitionKey="tkt_divisi" links={ticketLinks} rows={await listTicketDivisions()} />;
}
