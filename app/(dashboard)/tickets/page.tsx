import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
import { auth } from "@/auth";
import { RecordManager } from "@/app/_components/record-manager";
import { TicketTools } from "@/app/_components/ticket-tools";
import { listAuthRoles } from "@/lib/api/auth-users";
import { getTicketWorkspace } from "@/lib/api/tickets";
import { ticketLinks } from "@/lib/records/links";

export const metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const [workspace, roles, session] = await Promise.all([getTicketWorkspace(), listAuthRoles(), auth()]);
  const role = session?.user?.role || "staff";
  const currentPerson = workspace.people.find((person) => String(person.email || "").toLowerCase() === String(session?.user?.email || "").toLowerCase());
  const divisionPeople = currentPerson ? workspace.people.filter((person) => String(person.divisi_id || "") === String(currentPerson.divisi_id || "")).map((person) => String(person.id)) : [];
  const visibleTickets = role === "admin" ? workspace.tickets : currentPerson ? workspace.tickets.filter((ticket) => { const assigned = Array.isArray(ticket.assigned_to_ids) ? ticket.assigned_to_ids.map(String) : ticket.assigned_to_id ? [String(ticket.assigned_to_id)] : []; return String(ticket.requester_id || "") === String(currentPerson.id) || (role === "lead" ? assigned.some((id) => divisionPeople.includes(id)) : assigned.includes(String(currentPerson.id))); }) : [];
  const links = role === "admin" ? ticketLinks : ticketLinks.slice(0, 1);
  return <RecordManager definitionKey="tickets" links={links} rows={visibleTickets} fieldOptions={{ notification_roles: roles }} tools={<><AiTextRecordParser definitionKey="tickets" kind="ticket" title="Create ticket from text" fields={[{ name: "title", label: "Title", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["Todo", "In Progress", "Done"] }, { name: "priority", label: "Priority", type: "select", options: ["High", "Med", "Low"] }, { name: "due_date", label: "Deadline", type: "date" }]} /><TicketTools rows={visibleTickets} people={workspace.people} divisions={workspace.divisions} types={workspace.types} /></>} />;
}
