import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
import { TicketsWorkspace } from "@/app/_components/tickets-workspace";
import { auth } from "@/auth";
import { getTicketWorkspace } from "@/lib/api/tickets";

export const metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const [workspace, session] = await Promise.all([getTicketWorkspace(), auth()]);
  const role = session?.user?.role || "staff";
  // Prefer the explicit account link (018_ticket_assignee_auth_user.sql); fall back to
  // the email match for person rows created before it, and for databases where the
  // migration has not been applied yet.
  const sessionUserId = String(session?.user?.id || "");
  const sessionEmail = String(session?.user?.email || "").toLowerCase();
  const currentPerson = (sessionUserId ? workspace.people.find((person) => String(person.auth_user_id || "") === sessionUserId) : undefined)
    ?? workspace.people.find((person) => String(person.email || "").toLowerCase() === sessionEmail);
  const divisionPeople = currentPerson ? workspace.people.filter((person) => String(person.divisi_id || "") === String(currentPerson.divisi_id || "")).map((person) => String(person.id)) : [];
  const visibleTickets = role === "admin"
    ? workspace.tickets
    : currentPerson
      ? workspace.tickets.filter((ticket) => {
          const assigned = Array.isArray(ticket.assigned_to_ids) ? ticket.assigned_to_ids.map(String) : ticket.assigned_to_id ? [String(ticket.assigned_to_id)] : [];
          return String(ticket.requester_id || "") === String(currentPerson.id) || (role === "lead" ? assigned.some((id) => divisionPeople.includes(id)) : assigned.includes(String(currentPerson.id)));
        })
      : [];
  const aiPanel = <AiTextRecordParser definitionKey="tickets" kind="ticket" title="Input dengan AI" fields={[{ name: "title", label: "Judul", required: true }, { name: "description", label: "Deskripsi", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["Todo", "In Progress", "Done"] }, { name: "priority", label: "Prioritas", type: "select", options: ["High", "Med", "Low"] }, { name: "due_date", label: "Deadline", type: "date" }]} />;
  return <TicketsWorkspace rows={visibleTickets} people={workspace.people} divisions={workspace.divisions} types={workspace.types} aiPanel={aiPanel} />;
}
