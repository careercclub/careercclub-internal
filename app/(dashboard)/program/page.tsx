import { ProgramWorkflowTools } from "@/app/_components/program-workflow-tools";
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
  return (
    <RecordManager
      definitionKey="events"
      links={programLinks}
      rows={events}
      tools={<ProgramWorkflowTools events={events} tasks={tasks} people={people} />}
    />
  );
}
