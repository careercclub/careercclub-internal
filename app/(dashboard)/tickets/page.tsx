import { RecordManager } from "@/app/_components/record-manager";
import { TicketTools } from "@/app/_components/ticket-tools";
import { listAuthRoles } from "@/lib/api/auth-users";
import { getTicketWorkspace } from "@/lib/api/tickets";
import { ticketLinks } from "@/lib/records/links";

export const metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const [workspace, roles] = await Promise.all([getTicketWorkspace(), listAuthRoles()]);
  return <RecordManager definitionKey="tickets" links={ticketLinks} rows={workspace.tickets} fieldOptions={{ notification_roles: roles }} tools={<><AiTextRecordParser definitionKey="tickets" kind="ticket" title="Create ticket from text" fields={[{ name: "title", label: "Title", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["Open", "In Review", "In Progress", "Done", "Rejected"] }, { name: "priority", label: "Priority", type: "select", options: ["Low", "Med", "High", "Urgent"] }, { name: "due_date", label: "Deadline", type: "date" }]} /><TicketTools rows={workspace.tickets} people={workspace.people} /></>} />;
}
import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
