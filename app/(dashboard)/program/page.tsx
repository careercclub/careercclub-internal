import { ProgramWorkspace } from "@/app/_components/program-workspace";
import { listEventLinkTemplates, listEventRundown, listProgramEvents, listProgramTasks } from "@/lib/api/program";
import { getTicketWorkspace } from "@/lib/api/tickets";

export const metadata = { title: "Program" };

export default async function ProgramPage() {
  const [events, tasks, workspace, linkTemplates, rundown] = await Promise.all([
    listProgramEvents(),
    listProgramTasks(),
    getTicketWorkspace(),
    listEventLinkTemplates(),
    listEventRundown(),
  ]);
  return <ProgramWorkspace events={events} tasks={tasks} people={workspace.people} divisions={workspace.divisions} tickets={workspace.tickets} linkTemplates={linkTemplates} rundown={rundown} referenceDate={new Date().toISOString()} />;
}
