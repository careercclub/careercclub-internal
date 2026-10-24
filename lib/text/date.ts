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
