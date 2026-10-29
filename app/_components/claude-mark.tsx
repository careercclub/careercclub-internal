import { formatDay } from "@/lib/text/date";

// "Synced by Claude" / "Added by Claude": rows Claude added or refreshed through Claude access.
// The mark sits next to a title; the chip is for detail views. The source is named in words
// ("Claude"), not shown as a generic AI sparkle (antislop R-04).

function label(by: unknown, at: unknown, verb: string) {
  const when = typeof at === "string" || at instanceof Date ? formatDay(String(at instanceof Date ? at.toISOString() : at).slice(0, 10)) : "";
  return `${verb} by ${String(by || "Claude")}${when ? ` · ${when}` : ""}`;
}

export function ClaudeMark({ by, at, verb = "Synced" }: { by: unknown; at: unknown; verb?: "Synced" | "Added" }) {
  if (!by) return null;
  const text = label(by, at, verb);
  return <span aria-label={text} className="ml-1.5 align-[1px] text-[11px] font-semibold text-[var(--purple-mid)]" role="img" title={text}>Claude</span>;
}

export function ClaudeChip({ by, at, verb = "Synced" }: { by: unknown; at: unknown; verb?: "Synced" | "Added" }) {
  if (!by) return null;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--purple-light)] px-2.5 py-1 text-[12px] font-semibold text-[var(--purple-dark)]">{label(by, at, verb)}</span>;
}
