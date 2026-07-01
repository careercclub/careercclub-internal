import { DashboardAiCommand } from "@/app/_components/dashboard-ai-command";
import { DashboardCalendar, DashboardUpcoming } from "@/app/_components/dashboard-calendar";
import { listProgramEvents, listProgramTasks } from "@/lib/api/program";
import { getTicketWorkspace } from "@/lib/api/tickets";
import styles from "../dashboard.module.css";

export const metadata = { title: "Dashboard", description: "Program tasks and tickets on one operational calendar." };

export default async function DashboardPage() {
  const [workspace, tasks, events] = await Promise.all([getTicketWorkspace(), listProgramTasks(), listProgramEvents()]);
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
