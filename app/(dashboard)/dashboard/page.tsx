import { DashboardAiCommand } from "@/app/_components/dashboard-ai-command";
import { DashboardCalendar } from "@/app/_components/dashboard-calendar";
import { DashboardHome } from "@/app/_components/dashboard-home";
import { listProgramEvents, listProgramTasks } from "@/lib/api/program";
import { getVisibleTicketWorkspace } from "@/lib/api/tickets";
import { jakartaNow, summarizeDashboard } from "@/lib/dashboard/summary";
import { auth } from "@/auth";

export const metadata = { title: "Dashboard", description: "Today's numbers, upcoming programs, what is due next and the operational calendar." };

export default async function DashboardPage() {
  const session = await auth();
  // Same role rule as the Tickets page: the dashboard only shows tickets this person may see.
  const [workspace, tasks, events] = await Promise.all([getVisibleTicketWorkspace({ role: session?.user?.role, userId: session?.user?.id, email: session?.user?.email }), listProgramTasks(), listProgramEvents()]);
  const now = jakartaNow();
  const summary = summarizeDashboard({ tickets: workspace.tickets, tasks, events, people: workspace.people }, now.today);
  const firstName = (session?.user?.name || session?.user?.email || "there").split(/[\s@]/)[0];
  return (
    <DashboardHome
      aiCommand={<DashboardAiCommand />}
      calendar={<DashboardCalendar tickets={workspace.tickets} tasks={tasks} events={events} people={workspace.people} divisions={workspace.divisions} referenceDate={new Date().toISOString()} />}
      firstName={firstName}
      hour={now.hour}
      summary={summary}
    />
  );
}
