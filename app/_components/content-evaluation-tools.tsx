"use client";

import { evaluateContentEvaluation, type ContentEvaluationResult } from "@/lib/analytics/content";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import styles from "../record-manager.module.css";

type Tab = "overview" | "reel" | "feed" | "story-buyer";
type Scored = { row: ApiRecord; score: ContentEvaluationResult };

function day(value: unknown) { return typeof value === "string" ? value.slice(0, 10) : ""; }
function number(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function compact(value: unknown) { return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(number(value)); }
function percent(value: number) { return `${value.toFixed(1)}%`; }
function monthKey(value: unknown) { return day(value).slice(0, 7); }
function gradeLabel(grade: ContentEvaluationResult["grade"]) { return { top: "Top Performer", good: "Performing Well", avg: "Average", low: "Needs Improvement" }[grade]; }

export function ContentEvaluationTools({ evaluations, buyers, management }: { evaluations: ApiRecord[]; buyers: ApiRecord[]; management: ReactNode }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState("30");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [action, setAction] = useState("");
  const [sort, setSort] = useState("combined");
  const [selected, setSelected] = useState<Scored | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const cutoff = useMemo(() => { if (range === "all") return ""; const date = new Date(); date.setDate(date.getDate() - Number(range)); return date.toISOString().slice(0, 10); }, [range]);
  const scored = useMemo(() => evaluations.filter((row) => !cutoff || day(row.tanggal) >= cutoff).map((row) => ({ row, score: evaluateContentEvaluation(row) })), [evaluations, cutoff]);
  const visible = useMemo(() => scored.filter(({ row, score }) => {
    const format = String(row.format || "");
    if (tab === "reel" && format !== "Reel") return false;
    if (tab === "feed" && !["Carousel", "Feed Photo"].includes(format)) return false;
    if (tab === "story-buyer" && format !== "Story") return false;
    if (query && !`${row.judul || ""} ${row.topik || ""}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (grade && score.grade !== grade) return false;
    if (action && row.action !== action) return false;
    return true;
  }).sort((a, b) => sort === "date" ? day(b.row.tanggal).localeCompare(day(a.row.tanggal)) : sort === "follows" ? number(b.row.follows) - number(a.row.follows) : sort === "link" ? number(b.row.link_taps) - number(a.row.link_taps) : (number(b.row.follows) + number(b.row.link_taps)) - (number(a.row.follows) + number(a.row.link_taps))), [scored, tab, query, grade, action, sort]);

  const average = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.score.total, 0) / scored.length) : 0;
  const months = useMemo(() => {
    const grouped = new Map<string, { top: number; follows: number; links: number }>();
    scored.forEach(({ row, score }) => { const key = monthKey(row.tanggal); if (!key) return; const item = grouped.get(key) || { top: 0, follows: 0, links: 0 }; if (score.grade === "top") item.top += 1; item.follows += number(row.follows); item.links += number(row.link_taps); grouped.set(key, item); });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  }, [scored]);
  const calendarDays = useMemo(() => { const start = new Date(calendarMonth); start.setDate(1 - start.getDay()); return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; }); }, [calendarMonth]);
  const storyBuyers = useMemo(() => buyers.filter((row) => row.sumber === "Instagram Story" && (!cutoff || day(row.tanggal) >= cutoff)), [buyers, cutoff]);

  async function importMeta(formData: FormData) {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/content-evaluation/import", { method: "POST", body: formData }); const result = await response.json() as { inserted?: number; updated?: number; error?: string }; if (!response.ok) throw new Error(result.error || "Import failed."); setMessage(`Imported ${result.inserted || 0} new post(s); updated ${result.updated || 0}.`); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); } finally { setBusy(false); }
  }

  return <div className={styles.evaluationWorkspace}>
    <div className={styles.workspaceHeader}><div><p>Content</p><h1>Content evaluation</h1><span>Review distribution, conversion, retention, and buyer response with the same adaptive scoring used in production.</span></div><details className={styles.createPanel}><summary><i className="ti ti-file-import" /> Import Meta CSV/XLSX</summary><form action={importMeta} className={styles.toolForm}><input accept=".csv,.xlsx" name="file" type="file" required /><button className={styles.primaryButton} disabled={busy}>Import</button></form></details></div>
    {message ? <p className={styles.formMessage}>{message}</p> : null}
    <nav className={styles.workspaceTabs}>{([['overview','Overview'],['reel','Reels'],['feed','Feed & Carousel'],['story-buyer','Story vs Buyer']] as const).map(([key, label]) => <button className={tab === key ? styles.workspaceTabActive : styles.workspaceTab} key={key} onClick={() => setTab(key)}>{label}</button>)}</nav>
    <div className={styles.filterBar}><span>Range</span>{[["7","7 days"],["30","30 days"],["90","90 days"],["all","All"]].map(([value,label]) => <button className={range === value ? styles.primaryButton : styles.secondaryButton} key={value} onClick={() => setRange(value)}>{label}</button>)}</div>
    {tab === "overview" ? <>
      <div className={styles.metricStrip}><div><strong>{scored.length}</strong><span>Total content</span></div><div><strong>{average}</strong><span>Average score</span></div><div><strong>{scored.filter((item) => item.row.format === "Reel" && item.score.grade === "top").length}</strong><span>Top reels</span></div><div><strong>{scored.filter((item) => ["Carousel","Feed Photo"].includes(String(item.row.format)) && item.score.grade === "top").length}</strong><span>Top feed</span></div><div><strong>{scored.filter((item) => item.row.format === "Story" && item.score.grade === "top").length}</strong><span>Top stories</span></div></div>
      <div className={styles.analyticsGrid}><Trend title="Top performers / month" rows={months.map(([label,value]) => ({ label, value: value.top }))} /><Trend title="Follows / month" rows={months.map(([label,value]) => ({ label, value: value.follows }))} /><Trend title="Link taps / month" rows={months.map(([label,value]) => ({ label, value: value.links }))} /></div>
      <div className={styles.sectionHeading}><h2>Top content</h2><div className={styles.filterBar}><button className={sort === "combined" ? styles.primaryButton : styles.secondaryButton} onClick={() => setSort("combined")}>Follows + links</button><button className={sort === "follows" ? styles.primaryButton : styles.secondaryButton} onClick={() => setSort("follows")}>Follows</button><button className={sort === "link" ? styles.primaryButton : styles.secondaryButton} onClick={() => setSort("link")}>Link taps</button></div></div>
      <ContentCards items={visible.slice(0, 6)} onSelect={setSelected} />
      <section className={styles.calendarPanel}><header><div><h2>Posting calendar</h2><span>{calendarMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</span></div><div><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><i className="ti ti-chevron-left" /></button><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><i className="ti ti-chevron-right" /></button></div></header><div className={styles.monthCalendar}>{calendarDays.map((date) => { const key = date.toISOString().slice(0, 10); const posts = scored.filter((item) => day(item.row.tanggal) === key); return <section className={date.getMonth() !== calendarMonth.getMonth() ? styles.calendarDayMuted : undefined} key={key}><header>{date.getDate()}</header>{posts.slice(0,3).map((item) => <button className={styles.calendarEvent} key={String(item.row.id)} onClick={() => setSelected(item)}>{String(item.row.format)}: {String(item.row.judul || "Untitled")}</button>)}{posts.length > 3 ? <small>+{posts.length - 3} more</small> : null}</section>; })}</div></section>
      <details className={styles.createPanel}><summary><i className="ti ti-settings" /> Add, edit, and top-up metrics</summary>{management}</details>
    </> : null}
    {tab === "reel" || tab === "feed" ? <><div className={styles.filterBar}><input placeholder="Search title or topic" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">All grades</option><option value="top">Top Performer</option><option value="good">Performing Well</option><option value="avg">Average</option><option value="low">Needs Improvement</option></select><select value={action} onChange={(event) => setAction(event.target.value)}><option value="">All actions</option><option>Boost ke Meta Ads</option><option>Jadiin template konten serupa</option><option>Repurpose jadi format lain</option><option>Archive</option></select><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="combined">Follows + links</option><option value="date">Newest</option><option value="follows">Follows</option><option value="link">Link taps</option></select></div><ContentTable items={visible} onSelect={setSelected} /></> : null}
    {tab === "story-buyer" ? <StoryBuyer items={visible} buyers={storyBuyers} totalBuyers={buyers.length} onSelect={setSelected} /> : null}
    {selected ? <EvaluationDetail item={selected} onClose={() => setSelected(null)} /> : null}
  </div>;
}

function Trend({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return <section><h3>{title}</h3>{rows.length ? rows.map((row) => <div className={styles.analyticsBar} key={row.label}><span>{row.label}</span><i style={{ width: `${Math.max(2, row.value / maximum * 100)}%` }} /><strong>{compact(row.value)}</strong></div>) : <p className={styles.formMessage}>No dated content in this range.</p>}</section>;
}

function ContentCards({ items, onSelect }: { items: Scored[]; onSelect: (item: Scored) => void }) {
  return <div className={styles.summaryGrid}>{items.map((item, index) => <button className={styles.evaluationCard} key={String(item.row.id)} onClick={() => onSelect(item)}><header><span>{index + 1}</span><strong>{String(item.row.judul || "Untitled")}</strong><ScoreBadge score={item.score} /></header><div><span className={styles.dataPill}>{String(item.row.format || "Unknown")}</span>{item.score.partial ? <span className={styles.partialBadge}>Preliminary</span> : null}</div><footer><span>{compact(item.row.follows)} follows</span><span>{compact(item.row.link_taps)} link taps</span><span>{compact(item.row.reach || item.row.views)} reach</span></footer></button>)}</div>;
}

function ContentTable({ items, onSelect }: { items: Scored[]; onSelect: (item: Scored) => void }) {
  return <div className={styles.dataPanel}><div className={styles.tableScroll}><table><thead><tr><th>Content</th><th>Score</th><th>Reach</th><th>Save rate</th><th>Follows</th><th>Link taps</th><th>NF reach / WTR</th><th>Action</th></tr></thead><tbody>{items.map((item) => <tr key={String(item.row.id)} onClick={() => onSelect(item)}><td><button className={styles.tableLink}><strong>{String(item.row.judul || "Untitled")}</strong><span>{day(item.row.tanggal)} - {String(item.row.format)}</span></button></td><td><ScoreBadge score={item.score} /></td><td>{compact(item.row.reach)}</td><td>{percent(item.score.rates.saveRate || 0)}</td><td>{compact(item.row.follows)}</td><td>{compact(item.row.link_taps)}</td><td>{item.row.format === "Reel" ? `${number(item.row.nf_pct)}% / ${number(item.row.wtr)}%` : `${number(item.row.nf_pct)}%`}</td><td>{String(item.row.action || "-")}</td></tr>)}</tbody></table></div></div>;
}

function StoryBuyer({ items, buyers, totalBuyers, onSelect }: { items: Scored[]; buyers: ApiRecord[]; totalBuyers: number; onSelect: (item: Scored) => void }) {
  const dates = [...new Set([...items.map((item) => day(item.row.tanggal)), ...buyers.map((row) => day(row.tanggal))].filter(Boolean))].sort().reverse();
  return <><div className={styles.metricStrip}><div><strong>{totalBuyers}</strong><span>Total buyers</span></div><div><strong>{buyers.length}</strong><span>IG Story buyers</span></div><div><strong>{totalBuyers ? percent(buyers.length / totalBuyers * 100) : "0.0%"}</strong><span>Source share</span></div><div><strong>{items.length}</strong><span>Stories reviewed</span></div><div><strong>{dates.filter((date) => items.some((item) => day(item.row.tanggal) === date) && buyers.some((row) => day(row.tanggal) === date)).length}</strong><span>Matched days</span></div></div><div className={styles.timelineList}>{dates.map((date) => { const posts = items.filter((item) => day(item.row.tanggal) === date); const count = buyers.filter((row) => day(row.tanggal) === date).length; return <div key={date}><strong>{date}</strong><span>{count} buyer(s)</span><span>{posts.length ? posts.map((item) => <button className={styles.tableLink} key={String(item.row.id)} onClick={() => onSelect(item)}><strong>{String(item.row.judul)}</strong><span>{item.score.total}/100</span></button>) : "No Story recorded"}</span></div>; })}</div></>;
}

function ScoreBadge({ score }: { score: ContentEvaluationResult }) { return <span className={`${styles.scoreBadge} ${styles[`score_${score.grade}`]}`}>{score.total}/100</span>; }

function EvaluationDetail({ item, onClose }: { item: Scored; onClose: () => void }) {
  const { row, score } = item;
  const story = row.format === "Story";
  const metrics = story ? [["Views", row.views || row.reach], ["Taps forward", row.taps_forward], ["Taps back", `${compact(row.taps_back)} (${percent(score.rates.tapsBackRate || 0)})`], ["Exits", `${compact(row.exits)} (${percent(score.rates.exitRate || 0)})`], ["Replies", `${compact(row.replies)} (${percent(score.rates.replyRate || 0)})`], ["Link taps", row.link_taps], ["Sticker interactions", row.stickers_interact]] : [["Views", row.views], ["Reach", row.reach], ["Non-follower reach", `${number(row.nf_pct)}%`], ["Likes / comments", `${compact(row.likes)} / ${compact(row.comments)}`], ["Saves", `${compact(row.saves)} (${percent(score.rates.saveRate || 0)})`], ["Shares", `${compact(row.shares)} (${percent(score.rates.shareRate || 0)})`], ["Follows", `${compact(row.follows)} (${percent(score.rates.followRate || 0)})`], ["Link taps", row.link_taps], ...(row.format === "Reel" ? [["WTR", `${number(row.wtr)}%`], ["Avg watch time", row.watchtime], ["Drop-off second", row.dropoff], ["Replays", row.replays]] : [])];
  return <div className={styles.detailOverlay} onMouseDown={onClose}><article className={styles.detailPanel} onMouseDown={(event) => event.stopPropagation()}><header><div><span>{String(row.format)} - {day(row.tanggal)}</span><h2>{String(row.judul || "Untitled")}</h2><p>{String(row.topik || "No topic")}</p></div><button onClick={onClose}><i className="ti ti-x" /></button></header><div className={styles.evaluationScoreHero}><div><strong>{score.total}</strong><span>{gradeLabel(score.grade)}</span>{score.partial ? <small>Preliminary score: complete the missing advanced metrics.</small> : <small>Complete adaptive score.</small>}</div><progress max="100" value={score.total} /></div><div className={styles.evaluationDetailGrid}><section><h3>Full metrics</h3>{metrics.map(([label,value]) => <div key={String(label)}><span>{label}</span><strong>{typeof value === "number" ? compact(value) : String(value || "-")}</strong></div>)}</section><section><h3>Automatic insights</h3>{score.insights.map((insight, index) => <div className={styles.insightRow} key={`${insight.text}-${index}`}><i data-type={insight.type} /><span>{insight.text}</span></div>)}{row.win ? <aside><strong>What worked</strong><p>{String(row.win)}</p></aside> : null}{row.improve ? <aside><strong>Needs improvement</strong><p>{String(row.improve)}</p></aside> : null}{row.url ? <a className={styles.secondaryButton} href={String(row.url)} rel="noreferrer" target="_blank"><i className="ti ti-brand-instagram" /> Open post</a> : null}</section></div></article></div>;
}
