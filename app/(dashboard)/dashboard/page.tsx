import { DashboardCalendar } from "@/app/_components/dashboard-calendar";
import { DashboardAiCommand } from "@/app/_components/dashboard-ai-command";
import { getDashboardCounts, listRecentActivity } from "@/lib/api/dashboard";
import { listProgramEvents, listProgramTasks } from "@/lib/api/program";
import { listTickets } from "@/lib/api/tickets";
import styles from "../dashboard.module.css";

function activityTime(value: unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(date) : "-";
}

export const metadata = { title: "Dashboard", description: "Live CareerCclub operational counts and recent activity." };

export default async function DashboardPage() {
  const [counts, activity, tickets, tasks, events] = await Promise.all([getDashboardCounts(), listRecentActivity(20), listTickets(), listProgramTasks(), listProgramEvents()]);
  const metrics = [{ label: "Programs", value: counts.programs }, { label: "Tasks", value: counts.tasks }, { label: "CRM deals", value: counts.crmDeals }, { label: "Tickets", value: counts.tickets }, { label: "Content assets", value: counts.contentAssets }];
  return <><header className={styles.moduleHeader}><div><div className={styles.breadcrumb}>Operations</div><h1><i className="ti ti-layout-dashboard" aria-hidden="true" />Dashboard</h1><p>Live operational totals and the latest persisted activity from PostgreSQL.</p></div></header><DashboardAiCommand/><section className={styles.statsGrid} aria-label="Operational totals">{metrics.map((metric) => <article className={styles.statCard} key={metric.label}><div className={styles.statLabel}>{metric.label}</div><div className={styles.statValue}>{metric.value.toLocaleString()}</div></article>)}</section><section className={styles.card}><DashboardCalendar tickets={tickets} tasks={tasks} events={events} referenceDate={new Date().toISOString()} /></section><section className={styles.card}><div className={styles.cardHeader}><div><span>PostgreSQL</span><h2>Recent activity</h2></div><i className="ti ti-history" aria-hidden="true" /></div>{activity.length ? <div className={styles.tableWrap}><table><thead><tr><th>Module</th><th>Action</th><th>Detail</th><th>User</th><th>Time</th></tr></thead><tbody>{activity.map((item) => <tr key={String(item.id)}><td>{item.module || "-"}</td><td>{item.action || "-"}</td><td>{item.detail || "-"}</td><td>{item.user_name || "System"}</td><td>{activityTime(item.created_at)}</td></tr>)}</tbody></table></div> : <p className={styles.mutedCopy}>No persisted activity has been recorded yet.</p>}</section></>;
}
