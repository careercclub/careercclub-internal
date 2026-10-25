import { formatDay } from "@/lib/text/date";

// "Synced by Claude": rows Claude added or refreshed through Claude access.
// The mark sits next to a title; the chip is for detail views.

function label(by: unknown, at: unknown) {
  const when = typeof at === "string" || at instanceof Date ? formatDay(String(at instanceof Date ? at.toISOString() : at).slice(0, 10)) : "";
  return `Synced by ${String(by || "Claude")}${when ? ` · ${when}` : ""}`;
}

export function ClaudeMark({ by, at }: { by: unknown; at: unknown }) {
  if (!by) return null;
  const text = label(by, at);
  return <span aria-label={text} className="ml-1.5 inline-grid place-items-center align-[-1px] text-[13px] text-[var(--purple-mid)]" role="img" title={text}><i aria-hidden="true" className="ti ti-sparkles" /></span>;
}

export function ClaudeChip({ by, at }: { by: unknown; at: unknown }) {
  if (!by) return null;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--purple-light)] px-2.5 py-1 text-[12px] font-semibold text-[var(--purple-dark)]"><i aria-hidden="true" className="ti ti-sparkles" />{label(by, at)}</span>;
}
