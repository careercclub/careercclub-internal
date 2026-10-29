// One way to show a date in text: "22 Mar 2026" (inputs and table cells use dd/mm/yyyy).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03-22" (or a Date / ISO timestamp) → "22 Mar 2026"; anything else → "". */
export function formatDay(value: unknown, { year = true }: { year?: boolean } = {}) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return "";
  const label = `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]}`;
  return year ? `${label} ${match[1]}` : label;
}

/**
 * For sorting by date (Putaran 58): database dates arrive as Date objects, older rows as text.
 * Sorting their text form compares "Tue Sep 01…" with "Thu Oct 01…" (weekday names), so the
 * "latest" row could be an old one. This turns both into a number; empty or unreadable → 0.
 */
export function timeOf(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  const parsed = Date.parse(String(value ?? ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}
