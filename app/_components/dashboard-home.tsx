import Link from "next/link";
import { ScoreLine } from "./score-line";
import type { ReactNode } from "react";
import type { DashboardSummary, Person } from "@/lib/dashboard/summary";
import { shortDate } from "@/lib/dashboard/summary";
import styles from "./dashboard-home.module.css";

// Dashboard in the IJIS layout: greeting, four numbers, upcoming programs as cards,
// what is due next, this week at a glance, then the full calendar.
// Numbers and lists come from summarizeDashboard() so they always agree.

function Avatars({ people, tone }: { people: Person[]; tone: "light" | "dark" }) {
  if (!people.length) return null;
  return (
    <span className={styles.avatars}>
      {people.map((person) => <span className={tone === "light" ? styles.avatarOnColor : styles.avatar} key={person.id} title={person.name} aria-label={person.name}>{person.initials}</span>)}
    </span>
  );
}

function greeting(hour: number) {
  if (hour < 11) return "Good morning";
  if (hour < 15) return "Good afternoon";
  if (hour < 19) return "Good evening";
  return "Good night";
}

const CARD_TONES = [styles.programAccent, styles.programDeep, styles.programSoft];

export function DashboardHome({ summary, firstName, hour, aiCommand, calendar }: { summary: DashboardSummary; firstName: string; hour: number; aiCommand: ReactNode; calendar: ReactNode }) {
  const s = summary;
  const late = s.lateTickets + s.lateTasks;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{shortDate(s.today)}</span>
          <h1 className={styles.title}>{greeting(hour)}, {firstName}</h1>
        </div>
        <Link className={styles.primaryButton} href="/tickets?create=ticket"><i className="ti ti-plus" aria-hidden="true" /> Add ticket</Link>
      </header>

      {/* Rapor karier (DESIGN.md): one lead number, the thing to act on today; the rest compact. */}
      <section className={styles.stats} aria-label="Today in numbers">
        {late ? (
          <Link className={`${styles.stat} ${styles.statLead}`} href="/tickets"><span>Late, needs action</span><b className={styles.lateNumber}>{late}</b><em>{s.lateTickets} {s.lateTickets === 1 ? "ticket" : "tickets"} · {s.lateTasks} {s.lateTasks === 1 ? "task" : "tasks"}</em></Link>
        ) : (
          <Link className={`${styles.stat} ${styles.statLead}`} href="/program"><span>Tasks due this week</span><b>{s.weekTasksDone}<small>/{s.weekTasksTotal} done</small></b><ScoreLine label={`${s.weekTasksDone} of ${s.weekTasksTotal} tasks done`} max={s.weekTasksTotal} value={s.weekTasksDone} /><em>{s.weekTasksTotal && s.weekTasksDone === s.weekTasksTotal ? "all done" : "nothing late"}</em></Link>
        )}
        <Link className={styles.stat} href="/tickets"><span>Open tickets</span><b>{s.openTickets}</b>{s.lateTickets ? <em className={styles.late}>{s.lateTickets} late</em> : <em>none late</em>}</Link>
        {late ? (
          <Link className={styles.stat} href="/program"><span>Tasks due this week</span><b>{s.weekTasksDone}<small>/{s.weekTasksTotal}</small></b><ScoreLine label={`${s.weekTasksDone} of ${s.weekTasksTotal} tasks done`} max={s.weekTasksTotal} value={s.weekTasksDone} /></Link>
        ) : null}
        <Link className={styles.stat} href="/program"><span>Programs this month</span><b>{s.programsThisMonth}</b><em>{s.programs.length ? `next: ${s.programs[0].date}` : "none planned"}</em></Link>
      </section>

      <section className={styles.section} aria-labelledby="programs-title">
        <div className={styles.sectionHead}><h2 id="programs-title">Upcoming programs</h2><Link href="/program">All programs</Link></div>
        <div className={styles.programGrid}>
          {s.programs.map((program, index) => (
            <Link className={`${styles.program} ${CARD_TONES[index % CARD_TONES.length]}`} href={`/program?focus=${encodeURIComponent(program.id)}`} key={program.id}>
              <span className={styles.programKind}>{program.kind}</span>
              <h3>{program.name}</h3>
              <span className={styles.programWhen}>{program.date}{program.time ? ` · ${program.time}` : ""}{program.place ? ` · ${program.place}` : ""}</span>
              <span className={styles.programFoot}>
                <Avatars people={program.people} tone={index % CARD_TONES.length === 2 ? "dark" : "light"} />
                <span>{program.total ? `${program.done}/${program.total} tasks` : "No tasks yet"}</span>
              </span>
              <span aria-label={`${program.pct}% of tasks done`} className={styles.ring} role="img" style={{ ["--pct" as string]: `${program.pct}%` }}><span>{program.pct}%</span></span>
            </Link>
          ))}
          <Link className={styles.programNew} href="/program">+ Add event</Link>
        </div>
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="upnext-title">
          <div className={styles.sectionHead}><h2 id="upnext-title">Up next</h2><Link href="/tickets">All tickets</Link></div>
          {s.upNext.length ? (
            <ul className={styles.list}>
              {s.upNext.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link className={styles.listItem} href={item.href}>
                    {item.person ? <span className={styles.avatar} title={item.person.name}>{item.person.initials}</span> : <span aria-label="No assignee" className={styles.avatarEmpty} role="img" title="No assignee"><i className="ti ti-user" aria-hidden="true" /></span>}
                    <span className={styles.listText}><b>{item.title}</b><small>{item.where}</small></span>
                    <span className={item.state === "late" ? styles.chipLate : item.state === "later" ? styles.chip : styles.chipSoon}>{item.due}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}><i className="ti ti-checks" aria-hidden="true" />Nothing due in the next two weeks.</p>}
        </section>

        <section className={styles.panel} aria-labelledby="week-title">
          <div className={styles.sectionHead}><h2 id="week-title">This week</h2><span>{shortDate(s.week[0].key, false)} – {shortDate(s.week[6].key, false)}</span></div>
          <ol className={styles.week}>
            {s.week.map((day) => (
              <li className={day.isToday ? styles.dayToday : styles.day} key={day.key} aria-current={day.isToday ? "date" : undefined}>
                <span>{day.weekday}</span><b>{day.day}</b><small>{day.count ? `${day.count} due` : "–"}</small>
              </li>
            ))}
          </ol>
          {s.weekEvents.length ? (
            <ul className={styles.weekEvents}>
              {s.weekEvents.map((event) => <li key={event.id}><Link href={event.href}><b>{event.title}</b><span>{event.when}</span></Link></li>)}
            </ul>
          ) : <p className={styles.emptySmall}>No programs this week.</p>}
          <div className={styles.ai}>{aiCommand}</div>
        </section>
      </div>

      <section className={styles.section} aria-labelledby="calendar-title">
        <div className={styles.sectionHead}><h2 id="calendar-title">Calendar</h2><span>Drag a task or ticket to change its date</span></div>
        <div className={styles.calendarPanel}>{calendar}</div>
      </section>
    </div>
  );
}
