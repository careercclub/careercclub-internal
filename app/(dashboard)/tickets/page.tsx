import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
import { TicketsWorkspace } from "@/app/_components/tickets-workspace";
import { auth } from "@/auth";
import { getVisibleTicketWorkspace } from "@/lib/api/tickets";

export const metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const session = await auth();
  const workspace = await getVisibleTicketWorkspace({ role: session?.user?.role, userId: session?.user?.id, email: session?.user?.email });
  const aiPanel = <AiTextRecordParser definitionKey="tickets" kind="ticket" noun="ticket" fields={[{ name: "title", label: "Title", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["Todo", "In Progress", "Done"] }, { name: "priority", label: "Priority", type: "select", options: ["High", "Med", "Low"] }, { name: "due_date", label: "Deadline", type: "date" }]} />;
  return <TicketsWorkspace rows={workspace.tickets} people={workspace.people} divisions={workspace.divisions} types={workspace.types} meId={workspace.meId} aiPanel={aiPanel} />;
}
