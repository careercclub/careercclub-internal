"use client";

import { ArcElement, BarController, BarElement, CategoryScale, Chart as ChartJS, DoughnutController, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from "chart.js";
import { Bar, Chart, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, ArcElement, DoughnutController, Legend, Tooltip);

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

/** Reproduces the legacy `chartMonthly` — 12-month vertical bar of vacancies opened per month. */
export function MonthlyOpenChart({ labels, counts }: { labels: string[]; counts: number[] }) {
  return (
    <div style={{ height: "100%" }}>
      <Bar
        data={{ labels, datasets: [{ data: counts, backgroundColor: "#0f52ba", borderRadius: 6, borderSkipped: false }] }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: "#f0f2ff" } },
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

/** Horizontal single-series distribution bar chart — replaces the plain CSS bar-div breakdowns
 * used across Competitor Intel and Customer Knowledge with a real Chart.js chart. */
export function DistributionChart({ rows, color = "#7c6ff7" }: { rows: [string, number][]; color?: string }) {
  const height = Math.max(90, rows.length * 26);
  if (!rows.length) return <p className="text-[11px] text-muted-foreground">No data.</p>;
  return (
    <div style={{ height }}>
      <Bar
        data={{ labels: rows.map(([label]) => label), datasets: [{ label: "Count", data: rows.map(([, value]) => value), backgroundColor: color, borderRadius: 4, barPercentage: 0.7 }] }}
        options={{
          indexAxis: "y" as const,
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { intersect: false } },
          scales: { x: { beginAtZero: true, ticks: { font: { size: 10 } }, grid: { color: "#f0f2ff" } }, y: { ticks: { font: { size: 10 } }, grid: { display: false } } },
        }}
      />
    </div>
  );
}
