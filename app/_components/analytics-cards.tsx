"use client";

import type { CSSProperties } from "react";

// Ported from the legacy analytics panels (`donut`, `hbar`, `card` in index.html) so
// the CRM and Talent Pool summaries render exactly as the founder's version does.
// The donut is a hand-built SVG arc pair, not a chart library — that is why these
// panels never appeared in a search for Chart.js chart types.

export type Entry = [string, number];


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

const cardStyle: CSSProperties = { background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px", boxShadow: "var(--shadow)" };
const headStyle: CSSProperties = { fontSize: 14, fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--text)" };

export function AnalyticsCard({ title, icon, total, children }: { title: string; icon: string; total: number; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={headStyle}>
        <i className={`ti ${icon}`} style={{ color: "var(--purple-mid)" }} /> {title}
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>{total} {total === 1 ? "record" : "records"}</span>
      </div>
      {children}
    </div>
  );
}

/** Share of each value as ranked bars in one hue (the legacy multicolour donut, rebuilt
 * for the one-palette rule). Long tails fold into a single "Other" row. */
export function DonutBreakdown({ entries, total, maxSlices = 8 }: { entries: Entry[]; total: number; maxSlices?: number }) {
  const slices: Array<[string, number, boolean]> = entries.slice(0, maxSlices).map(([label, count]) => [label, count, false]);
  const otherCount = entries.slice(maxSlices).reduce((sum, entry) => sum + entry[1], 0);
  if (otherCount > 0) slices.push([`Other (${entries.length - maxSlices})`, otherCount, true]);
  if (!slices.length) return <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No data yet</p>;
  const max = Math.max(1, ...slices.map(([, count]) => count));
  return (
    <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
      {slices.map(([label, count, other]) => (
        <li key={label} style={{ display: "grid", gap: 4, fontSize: 12 }} title={`${label}: ${count} (${pct(count, total)}%)`}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{count}</span>
            <span style={{ width: 44, textAlign: "right", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{pct(count, total)}%</span>
          </span>
          <span aria-hidden="true" style={{ height: 6, borderRadius: 999, overflow: "hidden", background: "var(--surface-2)" }}><span style={{ display: "block", height: "100%", borderRadius: 999, width: `${Math.max(2, (count / max) * 100)}%`, background: other ? "var(--border-md)" : "var(--purple-mid)" }} /></span>
        </li>
      ))}
    </ul>
  );
}

export function BarBreakdown({ entries, total, maxBars = 10 }: { entries: Entry[]; total: number; maxBars?: number }) {
  const items = entries.slice(0, maxBars);
  if (!items.length) return <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No data yet</p>;
  // Bars are scaled against the largest value, while the label reports share of total.
  const maxVal = items[0]?.[1] || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map(([label, count]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text)", width: 140, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label}>{label}</div>
          <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 20, overflow: "hidden", height: 10 }}>
            <div style={{ height: "100%", background: "var(--purple-mid)", borderRadius: 20, width: `${((count / maxVal) * 100).toFixed(1)}%` }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", width: 76, textAlign: "right", flexShrink: 0 }}>{count} ({pct(count, total)}%)</div>
        </div>
      ))}
    </div>
  );
}

const exportButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", fontSize: 12, border: "0.5px solid var(--border-md)", borderRadius: "var(--radius)", background: "var(--white)", color: "var(--text)", cursor: "pointer" };
const countStyle: CSSProperties = { fontSize: 12, color: "var(--text-muted)" };

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
