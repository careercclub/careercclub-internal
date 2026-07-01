import { ProgramWorkflowTools } from "@/app/_components/program-workflow-tools";
import { ProgramWorkspace } from "@/app/_components/program-workspace";
import { RecordManager } from "@/app/_components/record-manager";
import { listProgramEvents, listProgramTasks } from "@/lib/api/program";
import { listTicketPeople } from "@/lib/api/tickets";
import { programLinks } from "@/lib/records/links";

export default async function ProgramPage() {
  const [events, tasks, people] = await Promise.all([
    listProgramEvents(),
    listProgramTasks(),
    listTicketPeople(),
  ]);
  return <ProgramWorkspace events={events} tasks={tasks} people={people} referenceDate={new Date().toISOString()} tools={<ProgramWorkflowTools events={events} tasks={tasks} people={people} />} management={<RecordManager definitionKey="events" links={programLinks} rows={events} />} />;
}
