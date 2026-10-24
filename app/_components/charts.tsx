"use client";

import { BarController, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from "chart.js";
import { Bar, Chart } from "react-chartjs-2";
import { useMemo } from "react";
import { useResolvedTheme } from "./theme-switch";

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, Legend, Tooltip);


// Colours come from the app's tokens so charts match the page (Chart.js cannot read CSS vars itself).
type Tokens = { mark: string; markSoft: string; ink: string; muted: string; grid: string; ref: string; surface: string };
const FALLBACK: Tokens = { mark: "#1554c0", markSoft: "#dee7f6", ink: "#14212c", muted: "#5f6b77", grid: "#edf0f4", ref: "#6b7682", surface: "#fff" };
function readTokens(): Tokens {
  if (typeof window === "undefined") return FALLBACK;
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { mark: read("--purple-mid", FALLBACK.mark), markSoft: read("--purple-light", FALLBACK.markSoft), ink: read("--text", FALLBACK.ink), muted: read("--text-muted", FALLBACK.muted), grid: read("--bg", FALLBACK.grid), ref: read("--text-hint", FALLBACK.ref), surface: read("--white", FALLBACK.surface) };
}
/** Canvas colours only (the canvas is drawn in the browser); markup uses the CSS variables directly. */
function useTokens(): Tokens {
  const theme = useResolvedTheme();
  // Re-read when Light/Dark changes (readTokens reads the CSS variables of the current theme).
  return useMemo(() => (theme ? readTokens() : FALLBACK), [theme]);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-02" → "Feb ’26" — one month format for every chart. */
export const monthLabel = (key: string) => { const [year, month] = key.split("-"); return MONTHS[Number(month) - 1] ? `${MONTHS[Number(month) - 1]} ’${year.slice(2)}` : key; };
/** "2026-09-07" → "7 Sep". */
export const dayLabel = (iso: string) => { const [, month, dayOfMonth] = iso.split("-"); return MONTHS[Number(month) - 1] ? `${Number(dayOfMonth)} ${MONTHS[Number(month) - 1]}` : iso; };
const compact = (value: number) => (Math.abs(value) >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}M` : Math.abs(value) >= 1_000 ? `${+(value / 1_000).toFixed(1)}K` : `${+value.toFixed(1)}`);
const full = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 1 });

function axes(t: Tokens) {
  return {
    x: { grid: { display: false }, border: { color: t.grid }, ticks: { color: t.muted, font: { size: 12 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } },
    y: { beginAtZero: true, grid: { color: t.grid }, border: { display: false }, ticks: { color: t.muted, font: { size: 12 }, maxTicksLimit: 5, callback: (value: string | number) => compact(Number(value)) } },
  };
}
const tooltip = (t: Tokens) => ({ mode: "index" as const, intersect: false, backgroundColor: t.surface, titleColor: t.ink, bodyColor: t.ink, borderColor: t.grid, borderWidth: 1, padding: 10, boxPadding: 4, titleFont: { weight: "bold" as const }, usePointStyle: true });
const CHART_HEIGHT = 220;

/** Legend in text ink with line swatches (solid / dashed), above the plot. */
function LineLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
      {items.map((item) => <span className="inline-flex items-center gap-1.5" key={item.label}><svg aria-hidden="true" height="8" width="18"><line stroke={item.color} strokeDasharray={item.dashed ? "4 3" : undefined} strokeLinecap="round" strokeWidth="2" x1="1" x2="17" y1="4" y2="4" /></svg>{item.label}</span>)}
    </div>
  );
}

/** Followers over time: a level, so a line from zero — actual (solid), projection to the year end
 * (dashed, same hue, starting at the last actual month) and the year's target as a grey reference. */
export function FollowersChart({ months, actual, predicted, target }: { months: string[]; actual: Array<number | null>; predicted: Array<number | null>; target?: number | null }) {
  const t = useTokens();
  return (
    <div className="grid gap-2">
      <LineLegend items={[{ label: "Followers", color: "var(--purple-mid)" }, { label: "Projection", color: "var(--purple-mid)", dashed: true }, ...(target ? [{ label: `Target ${full(target)}`, color: "var(--text-hint)", dashed: true }] : [])]} />
      <div style={{ height: CHART_HEIGHT }}>
        <Chart
          type="line"
          data={{
            labels: months.map(monthLabel),
            datasets: [
              { label: "Followers", data: actual, borderColor: t.mark, backgroundColor: t.mark, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.25, spanGaps: false },
              { label: "Projection", data: predicted, borderColor: t.mark, backgroundColor: t.mark, borderDash: [5, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25, spanGaps: false },
              ...(target ? [{ label: "Target", data: months.map(() => target), borderColor: t.ref, backgroundColor: t.ref, borderDash: [3, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, tension: 0 }] : []),
            ],
          }}
          options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { ...tooltip(t), callbacks: { label: (item) => (item.raw === null || item.raw === undefined ? "" : ` ${item.dataset.label}: ${full(Number(item.raw))}`) } } }, scales: axes(t) }}
        />
      </div>
    </div>
  );
}

/** One measure over periods as bars from zero (Reach per month, Interactions per month, follows per day). */
export function SeriesBarChart({ labels, values, name, unit = "" }: { labels: string[]; values: number[]; name: string; unit?: string }) {
  const t = useTokens();
  return (
    <div style={{ height: CHART_HEIGHT }}>
      <Bar
        data={{ labels, datasets: [{ label: name, data: values, backgroundColor: t.mark, hoverBackgroundColor: t.ink, borderRadius: 4, borderSkipped: "start", maxBarThickness: 28 }] }}
        options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { ...tooltip(t), displayColors: false, callbacks: { label: (item) => `${name}: ${full(Number(item.raw))}${unit}` } } }, scales: axes(t) }}
      />
    </div>
  );
}

/** A count-per-period bar. Reproduces the legacy `chartMonthly` (12-month vacancies
 * opened) and also carries the email-blast "sent per day" series.
 *
 * `stepSize` defaults to 1 for small integer counts; pass 0 to let Chart.js choose,
 * which is what a series running into the hundreds needs. */
export function MonthlyOpenChart({ labels, counts, stepSize = 1 }: { labels: string[]; counts: number[]; stepSize?: number }) {
  const t = useTokens();
  return (
    <div style={{ height: "100%" }}>
      <Bar
        data={{ labels, datasets: [{ data: counts, backgroundColor: t.mark, borderRadius: 4, borderSkipped: false }] }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: tooltip(t) },
          scales: {
            y: { beginAtZero: true, ticks: { ...(stepSize ? { stepSize } : {}), color: t.muted, font: { size: 12 } }, grid: { color: t.grid }, border: { display: false } },
            x: { ticks: { color: t.muted, font: { size: 12 }, maxRotation: 0, autoSkip: true }, grid: { display: false }, border: { color: t.grid } },
          },
        }}
      />
    </div>
  );
}

/** Categorical share of a single dimension as ranked bars in one hue, each row carrying
 * its label, count and share — easier to compare than pie slices, and no colour key to
 * decode. Used by the Customer Knowledge panels.
 *
 * Pass the FULL distribution, not a pre-truncated one: the tail is folded here into a
 * single "Other" row so that row is honest about what it contains. */
export function DistributionPie({ rows, topN = 7 }: { rows: [string, number][]; topN?: number }) {
  if (!rows.length) return <p className="py-5 text-center text-[12px] text-muted-foreground">No data yet</p>;

  const sorted = [...rows].sort((a, b) => b[1] - a[1]);
  const segments = sorted.slice(0, topN).map(([label, value]) => ({ label, value, other: false }));
  const tail = sorted.slice(topN);
  const tailTotal = tail.reduce((sum, [, value]) => sum + value, 0);
  if (tailTotal) segments.push({ label: `Other (${tail.length})`, value: tailTotal, other: true });
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const max = Math.max(1, ...segments.map((segment) => segment.value));
  const percent = (value: number) => Math.round((value / total) * 100);

  return (
    <ul className="grid min-w-0 gap-2">
      {segments.map((segment) => (
        <li className="grid gap-1 text-[12px]" key={segment.label} title={`${segment.label}: ${segment.value} (${percent(segment.value)}%)`}>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate">{segment.label}</span>
            <span className="ml-auto shrink-0 font-semibold tabular-nums">{segment.value}</span>
            <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">{percent(segment.value)}%</span>
          </span>
          <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full rounded-full" style={{ width: `${Math.max(2, (segment.value / max) * 100)}%`, background: segment.other ? "var(--border-md)" : "var(--purple-mid)" }} /></span>
        </li>
      ))}
    </ul>
  );
}
