import { DashboardAiCommand } from "@/app/_components/dashboard-ai-command";
import { DashboardCalendar, DashboardUpcoming } from "@/app/_components/dashboard-calendar";
import { listProgramEvents, listProgramTasks } from "@/lib/api/program";
import { getVisibleTicketWorkspace } from "@/lib/api/tickets";
import { auth } from "@/auth";
import styles from "../dashboard.module.css";

export const metadata = { title: "Dashboard", description: "Program tasks and tickets on one operational calendar." };

export default async function DashboardPage() {
  const session = await auth();
  // Same role rule as the Tickets page: the calendar only shows tickets this person may see.
  const [workspace, tasks, events] = await Promise.all([getVisibleTicketWorkspace({ role: session?.user?.role, userId: session?.user?.id, email: session?.user?.email }), listProgramTasks(), listProgramEvents()]);
  return (
    <>
      <DashboardAiCommand />
      <div className={styles.dashboardMain}>
        <section className={styles.card}>
          <DashboardCalendar tickets={workspace.tickets} tasks={tasks} events={events} people={workspace.people} divisions={workspace.divisions} referenceDate={new Date().toISOString()} />
        </section>
        <DashboardUpcoming tasks={tasks} tickets={workspace.tickets} />
      </div>
    </>
  );
}
