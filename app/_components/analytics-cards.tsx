"use client";

import type { CSSProperties } from "react";

// Ported from the legacy analytics panels (`donut`, `hbar`, `card` in index.html) so
// the CRM and Talent Pool summaries render exactly as the founder's version does.
// The donut is a hand-built SVG arc pair, not a chart library — that is why these
// panels never appeared in a search for Chart.js chart types.

export type Entry = [string, number];

// Legacy CRM palette. Talent Pool uses a slightly longer ramp; both are kept verbatim
// rather than merged, because the two pages diverge from the 6th slice onward.
export const ANALYTICS_COLORS = ["#0f52ba", "#a78bfa", "#818cf8", "#c4b5fd", "#ddd6fe", "#4f46e5", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"];
export const ANALYTICS_COLORS_TP = ["#0f52ba", "#a78bfa", "#818cf8", "#c4b5fd", "#ddd6fe", "#e8f0fc", "#4f46e5", "#7c3aed", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"];

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const pct = (count: number, total: number) => ((count / (total || 1)) * 100).toFixed(1);

/** Count occurrences, most frequent first. Blank values are ignored. */
export function freq(values: unknown[]): Entry[] {
  const counts = new Map<string, number>();
  values.forEach((value) => { const key = text(value); if (key) counts.set(key, (counts.get(key) || 0) + 1); });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Same, but one cell may list several values ("FMCG, Finance"). `upper` matches the
 * legacy CRM industry chart, which normalizes case; Talent Pool does not. */
export function freqMulti(values: unknown[], upper = false): Entry[] {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const raw = text(value);
    if (!raw) return;
    raw.split(/[,&]|\band\b/i).map((part) => { const trimmed = part.trim(); return upper ? trimmed.toUpperCase() : trimmed; }).filter(Boolean)
      .forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const cardStyle: CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 18px" };
const headStyle: CSSProperties = { fontSize: 12, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--text)" };

export function AnalyticsCard({ title, icon, total, children }: { title: string; icon: string; total: number; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={headStyle}>
        <i className={`ti ${icon}`} style={{ color: "#0f52ba" }} /> {title}
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 400, color: "var(--text-muted)" }}>{total} data</span>
      </div>
      {children}
    </div>
  );
}

export function DonutBreakdown({ entries, total, maxSlices = 8, colors = ANALYTICS_COLORS }: { entries: Entry[]; total: number; maxSlices?: number; colors?: string[] }) {
  const slices: Entry[] = entries.slice(0, maxSlices);
  const otherCount = entries.slice(maxSlices).reduce((sum, entry) => sum + entry[1], 0);
  if (otherCount > 0) slices.push(["Lainnya", otherCount]);
  if (!slices.length) return <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Belum ada data</p>;

  const cx = 80, cy = 80, r = 60, ri = 36;
  // Each slice derives its own start from the counts before it, rather than carrying a
  // running angle across the map — no mid-render mutation, and no drift accumulating
  // into the last slice. Quadratic, over at most nine slices.
  const arcs = slices.map(([label, count], index) => {
    const preceding = slices.slice(0, index).reduce((sum, entry) => sum + entry[1], 0);
    const startAngle = -Math.PI / 2 + (preceding / (total || 1)) * 2 * Math.PI;
    const angle = (count / (total || 1)) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const xi1 = cx + ri * Math.cos(startAngle), yi1 = cy + ri * Math.sin(startAngle);
    const xi2 = cx + ri * Math.cos(endAngle), yi2 = cy + ri * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { label, count, color: colors[index % colors.length], d: `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${ri},${ri} 0 ${large},0 ${xi1},${yi1} Z` };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <svg height="160" viewBox="0 0 160 160" width="160">
        {arcs.map((arc) => (
          <path d={arc.d} fill={arc.color} key={arc.label} stroke="var(--white)" strokeWidth="1.5">
            <title>{`${arc.label}: ${arc.count} (${pct(arc.count, total)}%)`}</title>
          </path>
        ))}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 100 }}>
        {arcs.map((arc) => (
          <div key={arc.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--text)" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: arc.color, flexShrink: 0 }} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }} title={arc.label}>{arc.label}</span>
            <span style={{ color: "var(--text-muted)", marginLeft: "auto", paddingLeft: 4 }}>{pct(arc.count, total)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarBreakdown({ entries, total, maxBars = 10 }: { entries: Entry[]; total: number; maxBars?: number }) {
  const items = entries.slice(0, maxBars);
  if (!items.length) return <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Belum ada data</p>;
  // Bars are scaled against the largest value, while the label reports share of total.
  const maxVal = items[0]?.[1] || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map(([label, count]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 10, color: "var(--text)", width: 130, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label}>{label}</div>
          <div style={{ flex: 1, background: "var(--bg)", borderRadius: 20, overflow: "hidden", height: 14 }}>
            <div style={{ height: "100%", background: "#0f52ba", borderRadius: 20, width: `${((count / maxVal) * 100).toFixed(1)}%` }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", width: 52, textAlign: "right", flexShrink: 0 }}>{count} ({pct(count, total)}%)</div>
        </div>
      ))}
    </div>
  );
}

const exportButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", fontSize: 12, border: "0.5px solid var(--border-md)", borderRadius: "var(--radius)", background: "var(--white)", color: "var(--text)", cursor: "pointer" };
const countStyle: CSSProperties = { fontSize: 11, color: "var(--text-muted)" };

/** `layout` matches the two legacy panels: CRM stacks the count under the title,
 * Talent Pool sets it inline beside the export button. */
export function AnalyticsHeader({ title, count, onExport, layout = "stacked" }: { title: string; count: string; onExport: () => void; layout?: "stacked" | "inline" }) {
  return (
    <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      {layout === "stacked" ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
          <div style={countStyle}>{count}</div>
        </div>
      ) : <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {layout === "inline" ? <div style={countStyle}>{count}</div> : null}
        <button onClick={onExport} style={exportButtonStyle} type="button">
          <i className="ti ti-download" style={{ fontSize: 12 }} /> Export JSON
        </button>
      </div>
    </div>
  );
}

export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const analyticsGrid = (columns: number): CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 12 });
