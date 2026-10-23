// Marketing analytics helpers (Content Evaluation, Meta Ads, Instagram). Pure: tested under `node --test`.

type Row = Record<string, unknown>;

export function num(value: unknown) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
export function day(value: unknown) { if (value instanceof Date) return value.toISOString().slice(0, 10); return typeof value === "string" ? value.slice(0, 10) : ""; }
export function compact(value: unknown) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(num(value)); }

/** Stored "next action" values are Indonesian; the UI shows English. */
const ACTION_LABELS: Record<string, string> = {
  "Boost ke Meta Ads": "Boost on Meta Ads",
  "Jadiin template konten serupa": "Turn into a template",
  "Repurpose jadi format lain": "Repurpose to another format",
  Archive: "Archive",
};
export const ACTION_VALUES = Object.keys(ACTION_LABELS);
export function actionLabel(value: unknown) { const v = String(value ?? "").trim(); return ACTION_LABELS[v] || v; }

/** Date range: "0" = all, "7"/"30"/"90" = last N days up to today, "custom" = between start and end (either optional). */
export function inRange(dateKey: string, range: string, today: string, start = "", end = "") {
  if (range === "0") return true;
  if (range === "custom") return (!start || dateKey >= start) && (!end || dateKey <= end);
  const [y, m, d] = today.split("-").map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1, d - Number(range))).toISOString().slice(0, 10);
  return dateKey >= cutoff;
}

/**
 * Instagram followers per week. Stored followers_total drifts (Instagram's "Follows" ignores
 * unfollows), so the manually verified baseline anchors the series and every other week is
 * derived from weekly follows gained: week[i+1] = week[i] + gained[i+1].
 */
export function followersSeries<T extends Row>(snapshots: T[], baseline: Row | null) {
  const sorted = [...snapshots].sort((a, b) => day(a.week_start).localeCompare(day(b.week_start))).map((row) => ({ ...row, computedFollowers: num(row.followers_total) }));
  if (!sorted.length) return sorted;
  const anchorDate = day(baseline?.baseline_date) || day(sorted.at(-1)?.week_start);
  const anchorValue = num(baseline?.followers_total) || num(sorted.at(-1)?.followers_total);
  let anchor = sorted.length - 1; let distance = Number.POSITIVE_INFINITY;
  sorted.forEach((row, index) => { const diff = Math.abs(new Date(day(row.week_start)).getTime() - new Date(anchorDate).getTime()); if (diff < distance) { distance = diff; anchor = index; } });
  sorted[anchor].computedFollowers = anchorValue;
  for (let i = anchor + 1; i < sorted.length; i += 1) sorted[i].computedFollowers = sorted[i - 1].computedFollowers + num(sorted[i].follows_gained);
  for (let i = anchor - 1; i >= 0; i -= 1) sorted[i].computedFollowers = Math.max(0, sorted[i + 1].computedFollowers - num(sorted[i + 1].follows_gained));
  return sorted;
}

export const DECISIONS = ["Pending", "Boost", "Skip"] as const;
export type Decision = (typeof DECISIONS)[number];
export function decisionOf(row: Row): Decision { const v = String(row.ad_decision || "Pending"); return v === "Boost" || v === "Skip" ? v : "Pending"; }
