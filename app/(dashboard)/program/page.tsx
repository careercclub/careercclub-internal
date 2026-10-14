import { ProgramWorkspace } from "@/app/_components/program-workspace";
import { listEventLinkTemplates, listEventRundown, listProgramEvents, listProgramTasks } from "@/lib/api/program";
import { getVisibleTicketWorkspace } from "@/lib/api/tickets";
import { auth } from "@/auth";

export const metadata = { title: "Program" };

export default async function ProgramPage() {
  const session = await auth();
  const [events, tasks, workspace, linkTemplates, rundown] = await Promise.all([
    listProgramEvents(),
    listProgramTasks(),
    // Same role rule as the Tickets page for the tickets shown on the Program calendar.
    getVisibleTicketWorkspace({ role: session?.user?.role, userId: session?.user?.id, email: session?.user?.email }),
    listEventLinkTemplates(),
    listEventRundown(),
  ]);
  return <ProgramWorkspace events={events} tasks={tasks} people={workspace.people} divisions={workspace.divisions} tickets={workspace.tickets} linkTemplates={linkTemplates} rundown={rundown} referenceDate={new Date().toISOString()} />;
}
