"use client";

import { ArcElement, BarController, BarElement, CategoryScale, Chart as ChartJS, DoughnutController, Legend, LinearScale, LineController, LineElement, PieController, PointElement, Tooltip } from "chart.js";
import { Bar, Chart, Doughnut, Pie } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, ArcElement, DoughnutController, PieController, Legend, Tooltip);

// Categorical slots, assigned in fixed order and never cycled. Validated against the
// light chart surface: worst adjacent CVD ΔE 9.1, worst adjacent normal-vision ΔE
// 19.6. Three slots fall under 3:1 contrast, which is why every pie ships a legend
// carrying the label and the value — identity is never colour alone.
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
// "Lainnya" is a bucket, not an identity, so it takes a neutral rather than slot 9.
const OTHER_COLOR = "#888780";

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
            { type: "bar" as const, label: "Followers Aktual", data: actual, backgroundColor: "rgba(124,111,247,0.7)", borderRadius: 5, order: 2 },
            { type: "line" as const, label: "Prediksi", data: predicted, borderColor: "#0f52ba", borderDash: [5, 4], borderWidth: 1.5, pointRadius: 2, fill: false, tension: 0.3, spanGaps: false, order: 1 },
            ...(target ? [{ type: "line" as const, label: "Target", data: labels.map(() => target), borderColor: "#e24b4a", borderDash: [6, 3], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0, order: 0 }] : []),
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
        data={{ labels, datasets: [{ label: "Reach", data: reach, backgroundColor: "#0f52ba", borderRadius: 4 }, { label: "Interactions", data: interactions, backgroundColor: "#34d399", borderRadius: 4 }] }}
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
        data={{ labels, datasets: [{ data: counts, backgroundColor: "#0f52ba", borderRadius: 6, borderSkipped: false }] }}
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

/** Reproduces the legacy `chartIndustry` doughnut — legend rendered separately by the caller. */
export function IndustryDoughnutChart({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  return (
    <div style={{ height: "100%" }}>
      <Doughnut
        data={{ labels: segments.map((s) => s.label), datasets: [{ data: segments.map((s) => s.value), backgroundColor: segments.map((s) => s.color), borderWidth: 2, borderColor: "#fff" }] }}
        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: "60%" }}
      />
    </div>
  );
}

/** Categorical share of a single dimension, as a pie with a value-carrying legend.
 * Used by the Talent Pool, CRM and Customer Knowledge analytics grids.
 *
 * Pass the FULL distribution, not a pre-truncated one: the tail is folded here into a
 * single "Lainnya" slice so that slice is honest about what it contains. */
export function DistributionPie({ rows, topN = 7 }: { rows: [string, number][]; topN?: number }) {
  if (!rows.length) return <p className="py-5 text-center text-[11px] text-muted-foreground">Belum ada data</p>;

  const sorted = [...rows].sort((a, b) => b[1] - a[1]);
  const segments = sorted.slice(0, topN).map(([label, value], index) => ({ label, value, color: SERIES_COLORS[index] }));
  const tail = sorted.slice(topN);
  const tailTotal = tail.reduce((sum, [, value]) => sum + value, 0);
  if (tailTotal) segments.push({ label: `Lainnya (${tail.length})`, value: tailTotal, color: OTHER_COLOR });
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const percent = (value: number) => Math.round((value / total) * 100);

  return (
    <div className="flex items-center gap-3">
      <div style={{ height: 132, width: 132, flexShrink: 0 }}>
        <Pie
          data={{
            labels: segments.map((segment) => segment.label),
            datasets: [{
              data: segments.map((segment) => segment.value),
              backgroundColor: segments.map((segment) => segment.color),
              // 2px surface gap so adjacent slices stay separable.
              borderWidth: 2,
              borderColor: "#fff",
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (item) => ` ${item.label}: ${item.parsed} (${percent(Number(item.parsed))}%)` } },
            },
          }}
        />
      </div>
      <ul className="grid min-w-0 flex-1 gap-1">
        {segments.map((segment) => (
          <li className="flex items-center gap-1.5 text-[11px]" key={segment.label}>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ background: segment.color }} />
            <span className="truncate text-muted-foreground">{segment.label}</span>
            <span className="ml-auto shrink-0 tabular-nums">{segment.value}</span>
            <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{percent(segment.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

