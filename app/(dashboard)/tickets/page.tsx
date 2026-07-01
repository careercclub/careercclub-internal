import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
import { TicketsWorkspace } from "@/app/_components/tickets-workspace";
import { auth } from "@/auth";
import { getTicketWorkspace } from "@/lib/api/tickets";

export const metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const [workspace, session] = await Promise.all([getTicketWorkspace(), auth()]);
  const role = session?.user?.role || "staff";
  const currentPerson = workspace.people.find((person) => String(person.email || "").toLowerCase() === String(session?.user?.email || "").toLowerCase());
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
