import type { ModulePage as ModulePageData } from "../_data/navigation";
import styles from "../dashboard.module.css";

type ModulePageProps = Readonly<{
  page: ModulePageData;
}>;

const kanbanStages = ["Backlog", "In Progress", "Review", "Done"];
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ModulePage({ page }: ModulePageProps) {
  return (
    <>
      <header className={styles.moduleHeader}>
        <div>
          <div className={styles.breadcrumb}>{page.section}</div>
          <h1>
            <i className={`ti ${page.icon}`} aria-hidden="true" />
            {page.title}
          </h1>
          <p>{page.description}</p>
        </div>
        <button className={styles.primaryAction} type="button">
          <i className="ti ti-plus" aria-hidden="true" />
          {page.primaryAction}
        </button>
      </header>

      <section className={styles.statsGrid} aria-label={`${page.title} stats`}>
        {page.stats.map((stat) => (
          <article className={styles.statCard} key={stat.label}>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={styles.statValue}>{stat.value}</div>
            <div className={stat.trend === "down" ? styles.statDown : styles.statUp}>
              {stat.note}
            </div>
          </article>
        ))}
      </section>

      <div className={styles.tabRow}>
        {page.tabs.map((tab, index) => (
          <button className={index === 0 ? styles.tabActive : styles.tab} type="button" key={tab}>
            {tab}
          </button>
        ))}
      </div>

      {page.kind === "dashboard" ? <DashboardBody /> : null}
      {page.kind === "planning" ? <PlanningBody page={page} /> : null}
      {page.kind === "analytics" ? <AnalyticsBody page={page} /> : null}
      {page.kind === "pipeline" ? <PipelineBody page={page} /> : null}
      {page.kind === "library" ? <LibraryBody page={page} /> : null}
      {page.kind === "table" ? <TableBody page={page} /> : null}
      {page.kind === "knowledge" ? <KnowledgeBody page={page} /> : null}
      {page.kind === "settings" ? <SettingsBody /> : null}
    </>
  );
}

function DashboardBody() {
  return (
    <section className={styles.dashboardGrid}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <span>Today</span>
            <h2>Operational pulse</h2>
          </div>
          <i className="ti ti-activity-heartbeat" aria-hidden="true" />
        </div>
        <div className={styles.activityList}>
          {["Program onboarding moved to review", "8 new CRM leads imported", "Content library labels cleaned", "Ticket SLA improved to 1.8d"].map((item) => (
            <div className={styles.activityItem} key={item}>
              <span />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <span>Calendar</span>
            <h2>Week view</h2>
          </div>
          <i className="ti ti-calendar-week" aria-hidden="true" />
        </div>
        <div className={styles.weekGrid}>
          {weekDays.map((day, index) => (
            <div className={index === 2 ? styles.weekDayActive : styles.weekDay} key={day}>
              <b>{day}</b>
              <span>{12 + index}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanningBody({ page }: ModulePageProps) {
  return (
    <section className={styles.card}>
      <div className={styles.filterBar}>
        <select aria-label="Owner">
          <option>Owner</option>
        </select>
        <select aria-label="Status">
          <option>Status</option>
        </select>
        <input aria-label="Search" placeholder={`Search ${page.title.toLowerCase()}...`} />
        <button type="button">This month</button>
      </div>
      <div className={styles.kanban}>
        {kanbanStages.map((stage, index) => (
          <article className={styles.kanbanColumn} key={stage}>
            <h3>{stage}</h3>
            {[0, 1, 2].map((item) => (
              <div className={styles.taskCard} key={`${stage}-${item}`}>
                <span>{page.title}</span>
                <strong>{stage} item {item + 1}</strong>
                <p>{index + item + 2} tasks linked</p>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function AnalyticsBody({ page }: ModulePageProps) {
  return (
    <section className={styles.analyticsGrid}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <span>Trend</span>
            <h2>{page.title} performance</h2>
          </div>
          <i className="ti ti-chart-bar" aria-hidden="true" />
        </div>
        <div className={styles.barChart}>
          {[42, 66, 58, 81, 74, 92, 88].map((height, index) => (
            <span style={{ height: `${height}%` }} key={`${height}-${index}`} />
          ))}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <span>Insights</span>
            <h2>Signals to act on</h2>
          </div>
          <i className="ti ti-bulb" aria-hidden="true" />
        </div>
        <div className={styles.insightStack}>
          <p>Best performing assets cluster around practical MT interview preparation.</p>
          <p>Creative fatigue appears after the fourth repeated hook format.</p>
          <p>CTA wording should be tested against saves and profile visit uplift.</p>
        </div>
      </div>
    </section>
  );
}

function PipelineBody({ page }: ModulePageProps) {
  return (
    <section className={styles.pipelineWrap}>
      {["Approached", "Meeting", "Negotiation", "Closed"].map((stage) => (
        <article className={styles.pipelineColumn} key={stage}>
          <h3>{stage}</h3>
          {[1, 2, 3].map((item) => (
            <div className={styles.pipelineCard} key={`${stage}-${item}`}>
              <strong>{page.title} #{item}</strong>
              <span>{stage}</span>
              <p>Owner assigned · next action ready</p>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}

function LibraryBody({ page }: ModulePageProps) {
  return (
    <section className={styles.galleryGrid}>
      {Array.from({ length: 8 }, (_, index) => (
        <article className={styles.galleryCard} key={index}>
          <div className={styles.galleryPreview}>
            <i className={`ti ${page.icon}`} aria-hidden="true" />
          </div>
          <strong>{page.title} item {index + 1}</strong>
          <span>Label · Reference · Notes</span>
        </article>
      ))}
    </section>
  );
}

function TableBody({ page }: ModulePageProps) {
  return (
    <section className={styles.card}>
      <div className={styles.filterBar}>
        <input aria-label="Search" placeholder={`Search ${page.title.toLowerCase()}...`} />
        <select aria-label="Category">
          <option>Category</option>
        </select>
        <select aria-label="Month">
          <option>Month</option>
        </select>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((item) => (
              <tr key={item}>
                <td>{page.title} record {item}</td>
                <td>{page.section}</td>
                <td><span className={styles.statusPill}>Active</span></td>
                <td>CCC Ops</td>
                <td>13 Jun 2026</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KnowledgeBody({ page }: ModulePageProps) {
  return (
    <section className={styles.knowledgeGrid}>
      {["Theme", "Evidence", "Action", "Owner"].map((label, index) => (
        <article className={styles.card} key={label}>
          <div className={styles.cardHeader}>
            <div>
              <span>{label}</span>
              <h2>{page.title}</h2>
            </div>
            <i className="ti ti-message-search" aria-hidden="true" />
          </div>
          <p className={styles.mutedCopy}>
            {index % 2 === 0
              ? "Collected signals are grouped by label so the team can turn repeated questions into content and offers."
              : "Each entry should retain source context, confidence, and next action for the responsible team."}
          </p>
        </article>
      ))}
    </section>
  );
}

function SettingsBody() {
  return (
    <section className={styles.settingsGrid}>
      {["Menu Visibility", "Master Lists", "Email Defaults", "Import Rules"].map((setting) => (
        <article className={styles.card} key={setting}>
          <div className={styles.cardHeader}>
            <div>
              <span>Settings</span>
              <h2>{setting}</h2>
            </div>
            <i className="ti ti-settings" aria-hidden="true" />
          </div>
          <label className={styles.toggleRow}>
            <span>Enabled</span>
            <input type="checkbox" defaultChecked />
          </label>
        </article>
      ))}
    </section>
  );
}
