// Content Planning calendar + agenda rules (IJIS layout, Oct 2026). Pure: tested under `node --test`.
// Weeks run Monday–Sunday, the same as the Dashboard's "This week".

type Row = Record<string, unknown>;

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number) { return String(n).padStart(2, "0"); }
export function iso(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
export function dayKey(value: unknown) { if (!value) return ""; return value instanceof Date ? iso(value) : String(value).slice(0, 10); }
function parse(key: string) { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); }

export function shortDay(key: string) { if (!key) return ""; const d = parse(key); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`; }
export function weekdayDay(key: string) { if (!key) return ""; const d = parse(key); return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; }

export function weekStart(key: string) { const d = parse(key); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }

/** "Week 2 · October" — counted from the week that holds the 1st of the month. */
export function weekLabel(startKey: string) {
  const start = parse(startKey);
  const first = parse(weekStart(iso(new Date(start.getFullYear(), start.getMonth(), 1))));
  const n = Math.round((start.getTime() - first.getTime()) / (7 * 86_400_000)) + 1;
  return `Week ${n} · ${MONTHS[start.getMonth()]}`;
}
export function weekRange(startKey: string) {
  const start = parse(startKey); const end = parse(startKey); end.setDate(end.getDate() + 6);
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
}

/** Items grouped by week (oldest first); items without a date go to the current week. */
export function groupByWeek<T extends Row>(rows: T[], field: string, today: string) {
  const map = new Map<string, T[]>();
  for (const row of rows) { const wk = weekStart(dayKey(row[field]) || today); map.set(wk, [...(map.get(wk) || []), row]); }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([start, items]) => ({
    start, label: weekLabel(start), range: weekRange(start), items: [...items].sort((a, b) => dayKey(a[field]).localeCompare(dayKey(b[field]))),
    done: items.filter((item) => String(item.status) === "Done").length,
  }));
}

/** Monday-first month grid: leading blanks (null) then every day key. */
export function monthCells(year: number, month: number) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)];
}

/** Per day: the items planned that day (for calendar chips and the date picker). */
export function byDay<T extends Row>(rows: T[], field: string) {
  const map: Record<string, T[]> = {};
  for (const row of rows) { const key = dayKey(row[field]); if (key) (map[key] ||= []).push(row); }
  return map;
}

export function fmtFollowers(n: number) {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
