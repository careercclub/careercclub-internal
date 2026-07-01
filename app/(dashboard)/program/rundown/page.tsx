import { RundownWorkspace } from "@/app/_components/rundown-workspace";
import { listEventRundown, listProgramEvents } from "@/lib/api/program";

export const metadata = { title: "Event Rundown" };

export default async function EventRundownPage() {
  const [events, rows] = await Promise.all([listProgramEvents(), listEventRundown()]);
  return <RundownWorkspace events={events} rows={rows} />;
}
