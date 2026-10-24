"use client";

import { submitTo } from "./safe-action";

import { saveInstagramBaselineAction } from "@/app/actions/instagram-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { compact, day, followersSeries, num } from "@/lib/marketing/view";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { FollowersChart, MetricsChart } from "./charts";
import s from "./page-kit.module.css";
import { DateInput } from "./date-input";

// Instagram in the IJIS layout: one hero for the follower count and the yearly goal, a stat
// strip, three charts, then the weekly history. Import and Target/baseline are their own views.

type View = "overview" | "import" | "target";
const VIEWS: { key: View; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "ti-layout-dashboard" },
  { key: "import", label: "Import", icon: "ti-upload" },
  { key: "target", label: "Target & baseline", icon: "ti-target" },
];
const fmt = (value: number) => value.toLocaleString("en-US");
const PAGE = 6;

export function InstagramTools({ snapshots, targets, baseline, referenceDate, snapshotManagement, targetManagement }: { snapshots: ApiRecord[]; targets: ApiRecord[]; baseline: ApiRecord | null; referenceDate: string; snapshotManagement: ReactNode; targetManagement: ReactNode }) {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState(0);
  const [page, setPage] = useState(0);

  const a = useMemo(() => {
    const now = new Date(referenceDate);
    const sorted = followersSeries(snapshots, baseline);
    const latest = sorted.at(-1);
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30);
    const recent = sorted.filter((row) => day(row.week_start) >= cutoff.toISOString().slice(0, 10));
    const sum = (key: string) => recent.reduce((total, row) => total + num(row[key]), 0);
    const reach30 = sum("reach"); const interactions30 = sum("interactions"); const follows30 = sum("follows_gained");
    const last4 = [...sorted].reverse().slice(0, 4);
    const avgPerDay = last4.reduce((total, row) => total + num(row.follows_gained), 0) / Math.max(1, last4.length * 7);
    // Project from the verified baseline; without one, from the latest derived week.
    const anchorFollowers = num(baseline?.followers_total) || num(latest?.computedFollowers);
    const baselineDate = new Date(`${day(baseline?.baseline_date) || day(latest?.week_start) || referenceDate.slice(0, 10)}T00:00:00`);
    const yearEnd = new Date(baselineDate.getFullYear(), 11, 31);
    const predicted = Math.round(anchorFollowers + avgPerDay * Math.max(0, (yearEnd.getTime() - baselineDate.getTime()) / 86400000));
    const currentTarget = targets.find((item) => num(item.year) === now.getFullYear()) || null;
    const monthly = new Map<string, { followers: number; reach: number; interactions: number }>();
    sorted.forEach((row) => { const key = day(row.week_start).slice(0, 7); if (!key) return; const item = monthly.get(key) || { followers: 0, reach: 0, interactions: 0 }; item.followers = row.computedFollowers; item.reach += num(row.reach); item.interactions += num(row.interactions); monthly.set(key, item); });
    return { sorted, latest, reach30, interactions30, follows30, er30: reach30 ? interactions30 / reach30 * 100 : 0, avgPerDay, predicted, currentTarget, monthly: [...monthly.entries()].sort(([x], [y]) => x.localeCompare(y)) };
  }, [snapshots, targets, baseline, referenceDate]);

  // Followers series extended to the end of the year so the dashed projection can run forward.
  const followersChart = useMemo(() => {
    const monthMap = new Map(a.monthly);
    const baselineDate = new Date(`${day(baseline?.baseline_date) || day(a.latest?.week_start) || referenceDate.slice(0, 10)}T00:00:00Z`);
    const baselineFollowers = num(baseline?.followers_total) || num(a.latest?.computedFollowers);
    const currentYear = new Date(referenceDate).getFullYear();
    const actualKeys = a.monthly.map(([key]) => key);
    const lastActualKey = actualKeys.at(-1);
    const futureKeys: string[] = [];
    if (lastActualKey) {
      let [year, month] = lastActualKey.split("-").map(Number);
      while ((year < currentYear || (year === currentYear && month < 12)) && futureKeys.length < 12) {
        month += 1; if (month > 12) { month = 1; year += 1; }
        futureKeys.push(`${year}-${String(month).padStart(2, "0")}`);
      }
    }
    const keys = [...actualKeys.slice(-8), ...futureKeys].slice(-12);
    const projected = (key: string) => { const [year, month] = key.split("-").map(Number); const end = new Date(Date.UTC(year, month, 0)); return Math.round(baselineFollowers + a.avgPerDay * Math.round((end.getTime() - baselineDate.getTime()) / 86400000)); };
    return { labels: keys.map((key) => key.slice(2)), actual: keys.map((key) => monthMap.get(key)?.followers ?? null), predicted: keys.map((key) => (key === lastActualKey || futureKeys.includes(key)) ? projected(key) : null) };
  }, [a.monthly, a.avgPerDay, a.latest, baseline, referenceDate]);

  const history = [...a.sorted].reverse();
  const pages = Math.max(1, Math.ceil(history.length / PAGE)); const current = Math.min(page, pages - 1);
  const pageRows = history.slice(current * PAGE, current * PAGE + PAGE);
  const weekly = [...a.sorted].slice(-8).map((row) => ({ label: day(row.week_start).slice(5), value: num(row.follows_gained) / 7 }));
  const weeklyMax = Math.max(1, ...weekly.map((row) => row.value));
  const metricRows = a.monthly.slice(-12);

  const currentFollowers = num(baseline?.followers_total) || num(a.latest?.computedFollowers);
  // The headline reads the manually verified baseline, so say when it was set; weeks after it
  // are derived from gross follows (no unfollows), so a baseline far behind the data drifts.
  const updatedAt = num(baseline?.followers_total) ? day(baseline?.baseline_date) || day(baseline?.updated_at) : day(a.latest?.week_start);
  const latestWeek = day(a.latest?.week_start);
  const staleDays = updatedAt && latestWeek ? Math.round((new Date(latestWeek).getTime() - new Date(updatedAt).getTime()) / 86400000) : 0;
  const stale = staleDays > 21;
  const target = num(a.currentTarget?.target_followers);
  const progress = target ? Math.min(100, currentFollowers / target * 100) : 0;
  const year = new Date(referenceDate).getFullYear();

  async function importSnapshots(formData: FormData) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/instagram/import", { method: "POST", body: formData });
      const result = await response.json() as { imported?: number; files?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Import failed.");
      setMessage(`Imported ${result.imported || 0} weekly snapshot${result.imported === 1 ? "" : "s"} from ${result.files || 0} file${result.files === 1 ? "" : "s"}.`);
      setPicked(0); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); } finally { setBusy(false); }
  }

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Marketing</span>
          <h1>Instagram</h1>
          <p>{fmt(currentFollowers)} followers · {history.length} weekly snapshot{history.length === 1 ? "" : "s"}{latestWeek ? ` · latest week ${latestWeek}` : ""}</p>
        </div>
        {view === "import" ? null : <button className={s.ghost} onClick={() => setView("import")} type="button"><i className="ti ti-upload" aria-hidden="true" /> Import Meta CSV</button>}
      </header>

      <div aria-label="Instagram views" className={s.segmented} role="tablist">
        {VIEWS.map((item) => <button aria-selected={view === item.key} className={view === item.key ? s.segmentActive : s.segment} key={item.key} onClick={() => setView(item.key)} role="tab" type="button"><i className={`ti ${item.icon}`} aria-hidden="true" /> {item.label}</button>)}
      </div>

      {view === "overview" ? (
        <>
          <section aria-label="Followers" className={s.hero}>
            <div>
              <span>Followers</span>
              <b className={s.big}>{fmt(currentFollowers)}</b>
              <p>{updatedAt ? `As of ${updatedAt}` : "No baseline yet"} · +{fmt(a.follows30)} follows in the last 30 days</p>
              {stale ? <button className={s.stale} onClick={() => setView("target")} type="button"><i className="ti ti-alert-triangle" aria-hidden="true" /> Baseline is {staleDays} days behind — update it</button> : null}
            </div>
            <div className={s.goal}>
              <span>Goal {year}</span>
              {target ? (
                <>
                  <div className={s.goalRow}><b>{Math.round(progress)}%</b><span>{fmt(currentFollowers)} / {fmt(target)}</span></div>
                  <div aria-label={`Goal progress ${Math.round(progress)}%`} className={s.goalBar} role="img"><i style={{ width: `${progress}%` }} /></div>
                  <p>Projected by 31 Dec: {fmt(a.predicted)} ({a.predicted >= target ? "on track" : `${fmt(target - a.predicted)} short`})</p>
                </>
              ) : <p>No target for {year} yet. <button className={s.heroLink} onClick={() => setView("target")} type="button">Set a target</button></p>}
            </div>
          </section>

          <div className={s.stats}>
            <div className={s.stat}><span>Reach, 30 days</span><b>{compact(a.reach30)}</b></div>
            <div className={s.stat}><span>Interactions, 30 days</span><b>{compact(a.interactions30)}</b></div>
            <div className={s.stat}><span>Engagement rate</span><b>{a.er30.toFixed(2)}%</b><small>Interactions ÷ reach</small></div>
            <div className={s.stat}><span>Follows per day</span><b>{a.avgPerDay.toFixed(1)}</b><small>Last 4 weeks</small></div>
          </div>

          <div className={s.grid3}>
            <section className={s.card}>
              <div><h3>Followers</h3><p className={s.cardSub}>Actual vs projection{target ? " · target line" : ""}</p></div>
              <FollowersChart actual={followersChart.actual} labels={followersChart.labels} predicted={followersChart.predicted} target={target || null} />
            </section>
            <section className={s.card}>
              <div><h3>Follows per day</h3><p className={s.cardSub}>Last 8 weeks</p></div>
              {weekly.length ? (
                <div className={s.barChart}>
                  {weekly.map((row) => <div className={s.barCol} key={row.label}><span><i style={{ height: `${Math.max(3, row.value / weeklyMax * 100)}%` }} title={`${row.label}: ${row.value.toFixed(1)}/day`} /></span><small>{row.label}</small></div>)}
                </div>
              ) : <p className={s.empty}>No snapshots yet.</p>}
            </section>
            <section className={s.card}>
              <div><h3>Reach &amp; interactions</h3><p className={s.cardSub}>Per month</p></div>
              <MetricsChart interactions={metricRows.map(([, v]) => v.interactions)} labels={metricRows.map(([label]) => label.slice(2))} reach={metricRows.map(([, v]) => v.reach)} />
            </section>
          </div>

          <section aria-label="Snapshot history" className={s.card}>
            <div className={s.cardHead}><h2>Snapshot history</h2><span className={s.chipMuted}>{history.length} weeks</span></div>
            {history.length ? (
              <>
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead><tr><th>Week</th><th className={s.num}>Followers</th><th className={s.num}>Follows</th><th className={s.num}>Reach</th><th className={s.num}>Interactions</th><th className={s.num}>ER</th></tr></thead>
                    <tbody>{pageRows.map((row) => <tr key={String(row.id)}><td>{day(row.week_start)}</td><td className={s.num}>{fmt(row.computedFollowers)}</td><td className={s.num}>+{fmt(num(row.follows_gained))}</td><td className={s.num}>{fmt(num(row.reach))}</td><td className={s.num}>{fmt(num(row.interactions))}</td><td className={s.num}>{num(row.reach) ? (num(row.interactions) / num(row.reach) * 100).toFixed(2) : "0.00"}%</td></tr>)}</tbody>
                  </table>
                </div>
                {pages > 1 ? (
                  <div className={s.pager}>
                    <button aria-label="Previous page" className={s.iconButton} disabled={current <= 0} onClick={() => setPage(current - 1)} type="button"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
                    <span>Page {current + 1} of {pages}</span>
                    <button aria-label="Next page" className={s.iconButton} disabled={current >= pages - 1} onClick={() => setPage(current + 1)} type="button"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
                  </div>
                ) : null}
              </>
            ) : <p className={s.empty}>No snapshots yet. Import Meta Insights CSVs to start.</p>}
          </section>

          <details className={s.details}>
            <summary><i className="ti ti-settings" aria-hidden="true" /> Manage snapshots</summary>
            <div>{snapshotManagement}</div>
          </details>
        </>
      ) : null}

      {view === "import" ? (
        <section aria-label="Import Meta Insights" className={s.card} style={{ maxWidth: 640 }}>
          <div><h2>Import Meta Insights</h2><p className={s.cardSub}>Pick one or more original Meta CSV exports (Views, Reach, Content interactions, Link clicks, Profile visits, Follows) or a normalized CSV/XLSX. Daily rows are combined into Monday-based weeks.</p></div>
          <form action={importSnapshots} style={{ display: "grid", gap: 12 }}>
            <label className={s.drop}>
              <i className="ti ti-file-upload" aria-hidden="true" />
              <b>Choose CSV or XLSX files</b>
              <span>{picked ? <span className={s.files}>{picked} file{picked === 1 ? "" : "s"} selected</span> : "You can select several files at once"}</span>
              <input accept=".csv,.xlsx" aria-label="Meta Insights files" multiple name="files" onChange={(e) => setPicked(e.target.files?.length || 0)} required style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} type="file" />
            </label>
            <button className={s.primary} disabled={busy || !picked} type="submit">{busy ? "Importing…" : "Import Meta CSV"}</button>
          </form>
          {message ? <p className={s.message} role="status">{message}</p> : null}
        </section>
      ) : null}

      {view === "target" ? (
        <>
          <section aria-label="Baseline followers" className={s.card} style={{ maxWidth: 760 }}>
            <div><h2>Baseline followers</h2><p className={s.cardSub}>The one number checked against the account. Every week is rebuilt forward and back from it using weekly follows.</p></div>
            {stale ? <p className={s.danger}><i className="ti ti-alert-triangle" aria-hidden="true" /> Last set {updatedAt}, {staleDays} days before the latest snapshot.</p> : null}
            <form className={s.form2} onSubmit={submitTo(saveInstagramBaselineAction, { success: "Baseline saved.", failure: "Could not save the baseline." })}>
              <label className={s.field}><span>Total followers <b className={s.req}>*</b></span><input className={s.input} defaultValue={currentFollowers || ""} min="1" name="followers_total" required type="number" /></label>
              <label className={s.field}><span>As of date <b className={s.req}>*</b></span><DateInput className={s.input} defaultValue={day(baseline?.baseline_date) || referenceDate.slice(0, 10)} name="baseline_date" required  /></label>
              <div><button className={s.primary} type="submit">Save baseline</button></div>
            </form>
          </section>
          <section aria-label="Yearly targets" className={s.card}>
            <div><h2>Yearly targets</h2><p className={s.cardSub}>The goal on the overview reads this year&apos;s row.</p></div>
            {targetManagement}
          </section>
        </>
      ) : null}
    </div>
  );
}
