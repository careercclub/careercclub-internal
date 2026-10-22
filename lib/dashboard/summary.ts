// Dashboard numbers and lists, computed in one place (IJIS layout, Oct 2026).
// Pure: no runtime imports, so the rules are unit-tested directly under `node --test`.
// "Late" means the same everywhere: not Done and its date is before today (calendar dates, WIB).

type Row = Record<string, unknown>;

export function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export function localIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Task/ticket deadlines and event dates are calendar dates (YYYY-MM-DD). */
export function dateKey(value: unknown) {
  if (!value) return "";
  return value instanceof Date ? localIso(value) : String(value).slice(0, 10);
}

/** Today's date (YYYY-MM-DD) and hour in Jakarta; the server may run in UTC. */
export function jakartaNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  return { today: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function isDone(row: Row) {
  return text(row.status) === "Done" || text(row.status) === "Cancelled";
}

/** The one overdue rule used by Dashboard, Program and Tickets. */
export function isOverdue(row: Row, today: string, field = "due_date") {
  const due = dateKey(row[field]);
  return !isDone(row) && Boolean(due) && due < today;
}

function addDays(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return localIso(new Date(y, m - 1, d + days));
}

/** Monday-to-Sunday week that contains `today`. */
export function weekKeys(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const offset = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const monday = addDays(today, -offset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function initials(name: unknown) {
  const parts = text(name).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : text(name).slice(0, 2)).toUpperCase() || "?";
}

function ids(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* comma list */ }
    return value.replace(/[{}]/g, "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export type Person = { id: string; name: string; initials: string };
export type ProgramCard = { id: string; name: string; kind: string; date: string; time: string; place: string; done: number; total: number; pct: number; people: Person[] };
export type UpNextItem = { kind: "ticket" | "task"; id: string; title: string; where: string; due: string; dueKey: string; state: "late" | "today" | "soon" | "later"; href: string; person?: Person };
export type WeekDay = { key: string; day: number; weekday: string; count: number; isToday: boolean };

export type DashboardSummary = {
  today: string;
  openTickets: number;
  lateTickets: number;
  weekTasksDone: number;
  weekTasksTotal: number;
  lateTasks: number;
  programsThisMonth: number;
  programs: ProgramCard[];
  upNext: UpNextItem[];
  week: WeekDay[];
  weekEvents: { id: string; title: string; when: string; href: string }[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(key: string, withWeekday = true) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${withWeekday ? WEEKDAYS[date.getDay()] + ", " : ""}${d} ${MONTHS[m - 1]}`;
}

function dueLabel(due: string, today: string) {
  if (due < today) {
    const [y1, m1, d1] = due.split("-").map(Number); const [y2, m2, d2] = today.split("-").map(Number);
    const days = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000);
    return `${days} day${days === 1 ? "" : "s"} late`;
  }
  if (due === today) return "Today";
  if (due === addDays(today, 1)) return "Tomorrow";
  return shortDate(due);
}

export function summarizeDashboard(input: { tickets: Row[]; tasks: Row[]; events: Row[]; people: Row[] }, referenceIso: string): DashboardSummary {
  const today = dateKey(referenceIso.length > 10 ? new Date(referenceIso) : referenceIso);
  const people = new Map(input.people.map((row) => [String(row.id), { id: String(row.id), name: text(row.nama) || text(row.name) || "Unknown", initials: initials(row.nama || row.name) }]));
  const person = (id: unknown) => (id ? people.get(String(id)) : undefined);
  const events = new Map(input.events.map((row) => [String(row.id), row]));
  const week = weekKeys(today);
  const monthKey = today.slice(0, 7);

  const openTicketRows = input.tickets.filter((row) => !isDone(row));
  // Tickets created for a program task are shown once, as the task.
  const standaloneTickets = openTicketRows.filter((row) => !row.related_task_id);
  const weekTasks = input.tasks.filter((row) => week.includes(dateKey(row.due_date)));

  const programs = input.events
    .filter((row) => !isDone(row) && dateKey(row.tanggal) >= today)
    .sort((a, b) => dateKey(a.tanggal).localeCompare(dateKey(b.tanggal)))
    .slice(0, 3)
    .map((row): ProgramCard => {
      const tasks = input.tasks.filter((task) => String(task.project_id || "") === String(row.id));
      const done = tasks.filter((task) => text(task.status) === "Done").length;
      const assigneeIds = [...new Set(tasks.flatMap((task) => [...ids(task.assignee_ids), ...(task.assignee_id ? [String(task.assignee_id)] : [])]))];
      return {
        id: String(row.id), name: text(row.nama) || "Untitled program", kind: text(row.jenis_program) || "Program",
        date: shortDate(dateKey(row.tanggal)), time: text(row.waktu).slice(0, 5), place: text(row.platform),
        done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
        people: assigneeIds.map((id) => person(id)).filter((p): p is Person => Boolean(p)).slice(0, 4),
      };
    });

  const horizon = addDays(today, 14);
  const stateOf = (due: string): UpNextItem["state"] => (due < today ? "late" : due === today ? "today" : due <= addDays(today, 2) ? "soon" : "later");
  const upNext: UpNextItem[] = [
    ...standaloneTickets.filter((row) => dateKey(row.due_date) && dateKey(row.due_date) <= horizon).map((row): UpNextItem => {
      const due = dateKey(row.due_date);
      return { kind: "ticket", id: String(row.id), title: text(row.title) || "Untitled ticket", where: `Ticket${row.ticket_no ? " " + text(row.ticket_no) : ""}`, due: dueLabel(due, today), dueKey: due, state: stateOf(due), href: `/tickets?focus=${encodeURIComponent(String(row.id))}`, person: person(ids(row.assigned_to_ids)[0] || row.assigned_to_id) };
    }),
    ...input.tasks.filter((row) => !isDone(row) && dateKey(row.due_date) && dateKey(row.due_date) <= horizon).map((row): UpNextItem => {
      const due = dateKey(row.due_date); const event = events.get(String(row.project_id || ""));
      return { kind: "task", id: String(row.id), title: text(row.title) || "Untitled task", where: event ? `Program · ${text(event.nama)}` : "Program task", due: dueLabel(due, today), dueKey: due, state: stateOf(due), href: event ? `/program?focus=${encodeURIComponent(String(event.id))}` : "/program", person: person(ids(row.assignee_ids)[0] || row.assignee_id) };
    }),
  ].sort((a, b) => {
    const order = { late: 0, today: 1, soon: 2, later: 3 };
    return order[a.state] - order[b.state] || a.dueKey.localeCompare(b.dueKey);
  });

  const dayCount = (key: string) =>
    input.tasks.filter((row) => !isDone(row) && dateKey(row.due_date) === key).length
    + standaloneTickets.filter((row) => dateKey(row.due_date) === key).length
    + input.events.filter((row) => !isDone(row) && dateKey(row.tanggal) === key).length;

  return {
    today,
    openTickets: openTicketRows.length,
    lateTickets: openTicketRows.filter((row) => isOverdue(row, today)).length,
    weekTasksDone: weekTasks.filter((row) => text(row.status) === "Done").length,
    weekTasksTotal: weekTasks.length,
    lateTasks: input.tasks.filter((row) => isOverdue(row, today)).length,
    programsThisMonth: input.events.filter((row) => text(row.status) !== "Cancelled" && dateKey(row.tanggal).startsWith(monthKey)).length,
    programs,
    upNext: upNext.slice(0, 6),
    week: week.map((key) => { const [y, m, d] = key.split("-").map(Number); return { key, day: d, weekday: WEEKDAYS[new Date(y, m - 1, d).getDay()], count: dayCount(key), isToday: key === today }; }),
    weekEvents: input.events
      .filter((row) => !isDone(row) && week.includes(dateKey(row.tanggal)))
      .sort((a, b) => `${dateKey(a.tanggal)}${text(a.waktu)}`.localeCompare(`${dateKey(b.tanggal)}${text(b.waktu)}`))
      .map((row) => ({ id: String(row.id), title: text(row.nama) || "Untitled program", when: `${shortDate(dateKey(row.tanggal))}${row.waktu ? " · " + text(row.waktu).slice(0, 5) : ""}`, href: `/program?focus=${encodeURIComponent(String(row.id))}` })),
  };
}
