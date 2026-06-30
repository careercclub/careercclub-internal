import { RecordManager } from "@/app/_components/record-manager";
import { listAuthRoles } from "@/lib/api/auth-users";
import { listTickets } from "@/lib/api/tickets";

export const metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const [tickets, roles] = await Promise.all([listTickets(), listAuthRoles()]);
  return <RecordManager definitionKey="tickets" rows={tickets} fieldOptions={{ notification_roles: roles }} />;
}
