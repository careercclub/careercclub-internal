"use client";

import { BarController, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from "chart.js";
import { Bar, Chart } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, Legend, Tooltip);


const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: "top" as const, labels: { font: { size: 11 }, boxWidth: 14 } }, tooltip: { mode: "index" as const, intersect: false } },
};

/** Reproduces the legacy `ig-chart-followers` Chart.js combo: actual followers bars, a dashed
 * prediction line, and an optional dashed target reference line — matching `igChartFollowers`. */
export function FollowersChart({ labels, actual, predicted, target }: { labels: string[]; actual: Array<number | null>; predicted: Array<number | null>; target?: number | null }) {
  return (
    <div style={{ height: 240 }}>
      <Chart
        type="bar"
        data={{
          labels,
          datasets: [
            { type: "bar" as const, label: "Followers", data: actual, backgroundColor: "rgba(21,84,192,0.8)", borderRadius: 5, order: 2 },
            { type: "line" as const, label: "Projection", data: predicted, borderColor: "#0b2f6e", borderDash: [5, 4], borderWidth: 1.5, pointRadius: 2, fill: false, tension: 0.3, spanGaps: false, order: 1 },
            ...(target ? [{ type: "line" as const, label: "Target", data: labels.map(() => target), borderColor: "#6b7280", borderDash: [6, 3], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0, order: 0 }] : []),
          ],
        }}
        options={{ ...baseOptions, scales: { y: { beginAtZero: false, ticks: { font: { size: 11 } }, grid: { color: "#f0f2ff" } }, x: { ticks: { font: { size: 10 } }, grid: { display: false } } } }}
      />
    </div>
  );
}

/** Reproduces the legacy `ig-chart-metrics` Chart.js bar chart (monthly Reach + Interactions). */
export function MetricsChart({ labels, reach, interactions }: { labels: string[]; reach: number[]; interactions: number[] }) {
  return (
    <div style={{ height: 200 }}>
      <Bar
        data={{ labels, datasets: [{ label: "Reach", data: reach, backgroundColor: "#1554c0", borderRadius: 4 }, { label: "Interactions", data: interactions, backgroundColor: "#9bb8ec", borderRadius: 4 }] }}
        options={{ ...baseOptions, scales: { y: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: "#f0f2ff" } }, x: { ticks: { font: { size: 10 } }, grid: { display: false } } } }}
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
  return (
    <div style={{ height: "100%" }}>
      <Bar
        data={{ labels, datasets: [{ data: counts, backgroundColor: "#1554c0", borderRadius: 6, borderSkipped: false }] }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { ...(stepSize ? { stepSize } : {}), font: { size: 11 } }, grid: { color: "#f0f2ff" } },
            x: { ticks: { font: { size: 11 } }, grid: { display: false } },
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
