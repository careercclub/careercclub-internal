import { RecordManager } from "@/app/_components/record-manager";
import { listProgramTasks } from "@/lib/api/program";
import { programLinks } from "@/lib/records/links";

export default async function ProgramTasksPage() {
  return <RecordManager definitionKey="tasks" links={programLinks} rows={await listProgramTasks()} tools={<AiTextRecordParser definitionKey="tasks" kind="task" title="Create task from text" fields={[{ name: "title", label: "Title", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["Todo", "In Progress", "Done"] }, { name: "priority", label: "Priority", type: "select", options: ["Low", "Med", "High", "Urgent"] }, { name: "phase", label: "Phase", type: "select", options: ["Pre Event", "Event Day", "Post Event"] }, { name: "due_date", label: "Deadline", type: "date" }]} /> } />;
}
import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
