"use client";

import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { evaluateContentEvaluation, type ContentEvaluationResult } from "@/lib/analytics/content";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import styles from "./content-evaluation.module.css";

type Tab = "overview" | "reel" | "feed" | "story-buyer";
type Scored = { row: ApiRecord; score: ContentEvaluationResult };
type SortMode = "combined" | "follows" | "link";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function day(value: unknown) { return typeof value === "string" ? value.slice(0, 10) : ""; }
function number(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function compact(value: unknown) { return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(number(value)); }
function percent(value: number) { return `${value.toFixed(1)}%`; }
function monthKey(value: unknown) { return day(value).slice(0, 7); }
function dateLabel(value: unknown) { const parsed = new Date(day(value)); return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"; }
function gradeLabel(grade: ContentEvaluationResult["grade"]) { return { top: "Top Performer", good: "Performing Well", avg: "Average", low: "Needs Improvement" }[grade]; }
function scoreClass(grade: ContentEvaluationResult["grade"]) { return { top: styles.scoreTop, good: styles.scoreGood, avg: styles.scoreAverage, low: styles.scoreLow }[grade]; }
function sortItems(items: Scored[], mode: SortMode) {
  return [...items].sort((a, b) => mode === "follows"
    ? number(b.row.follows) - number(a.row.follows)
    : mode === "link"
      ? number(b.row.link_taps) - number(a.row.link_taps)
      : number(b.row.follows) + number(b.row.link_taps) - number(a.row.follows) - number(a.row.link_taps));
}

export function ContentEvaluationTools({ evaluations, buyers }: { evaluations: ApiRecord[]; buyers: ApiRecord[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState("0");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [action, setAction] = useState("");
  const [sort, setSort] = useState<SortMode>("combined");
  const [selected, setSelected] = useState<Scored | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [calendarVisible, setCalendarVisible] = useState(true);
  const [storyMetric, setStoryMetric] = useState<"views" | "buyers">("views");
  const [storySort, setStorySort] = useState<"recent" | "buyers">("recent");
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ApiRecord | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const allScored = useMemo(() => evaluations.map((row) => ({ row, score: evaluateContentEvaluation(row) })), [evaluations]);
  const scored = useMemo(() => {
    if (range === "0") return allScored;
    if (range === "custom") return allScored.filter(({ row }) => (!customStart || day(row.tanggal) >= customStart) && (!customEnd || day(row.tanggal) <= customEnd));
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(range));
    const key = cutoff.toISOString().slice(0, 10);
    return allScored.filter(({ row }) => day(row.tanggal) >= key);
  }, [allScored, customEnd, customStart, range]);
  const formatItems = useMemo(() => {
    let items = scored.filter(({ row }) => tab === "reel" ? row.format === "Reel" : ["Carousel", "Feed Photo"].includes(String(row.format)));
    if (query) items = items.filter(({ row }) => `${row.judul || ""} ${row.topik || ""}`.toLowerCase().includes(query.toLowerCase()));
    if (grade === "top") items = items.filter(({ score }) => score.grade === "top");
    if (action) items = items.filter(({ row }) => row.action === action);
    if (grade === "wtr") return items.filter(({ row }) => number(row.wtr) > 0).sort((a, b) => number(b.row.wtr) - number(a.row.wtr));
    if (grade === "nfpct") return items.filter(({ row }) => number(row.nf_pct) > 0).sort((a, b) => number(b.row.nf_pct) - number(a.row.nf_pct));
    if (grade === "follows") return items.sort((a, b) => number(b.row.follows) - number(a.row.follows));
    if (grade === "link") return items.sort((a, b) => number(b.row.link_taps) - number(a.row.link_taps));
    return items.sort((a, b) => b.score.total - a.score.total);
  }, [action, grade, query, scored, tab]);
  const storyItems = useMemo(() => scored.filter(({ row }) => row.format === "Story"), [scored]);
  const storyBuyers = useMemo(() => buyers.filter((row) => row.sumber === "Instagram Story" && scored.some(({ row: item }) => day(item.tanggal) === day(row.tanggal))), [buyers, scored]);
  const buyerByDate = useMemo(() => { const map = new Map<string, number>(); buyers.filter((row) => row.sumber === "Instagram Story").forEach((row) => { const key = day(row.tanggal); if (key) map.set(key, (map.get(key) || 0) + 1); }); return map; }, [buyers]);
  const average = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.score.total, 0) / scored.length) : 0;
  const ranked = sortItems(scored, sort);
  const months = useMemo(() => {
    const grouped = new Map<string, { top: number; follows: number; links: number }>();
    allScored.forEach(({ row, score }) => { const key = monthKey(row.tanggal); if (!key) return; const item = grouped.get(key) || { top: 0, follows: 0, links: 0 }; if (score.grade === "top") item.top += 1; item.follows += number(row.follows); item.links += number(row.link_taps); grouped.set(key, item); });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [allScored]);

  async function importMeta(formData: FormData) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/content-evaluation/import", { method: "POST", body: formData });
      const result = await response.json() as { inserted?: number; updated?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Import failed.");
      setMessage(`Imported ${result.inserted || 0} new post(s); updated ${result.updated || 0}.`);
      setImportOpen(false); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); } finally { setBusy(false); }
  }

  async function saveEvaluation(formData: FormData) {
    if (editing?.id) await updateManagedRecord("content_evaluations", String(editing.id), formData);
    else await createManagedRecord("content_evaluations", formData);
    setEditing(undefined);
    router.refresh();
  }

  async function removeEvaluation() {
    if (!editing?.id || !window.confirm("Hapus evaluasi konten ini?")) return;
    await deleteManagedRecord("content_evaluations", String(editing.id));
    setEditing(undefined);
    setSelected(null);
    router.refresh();
  }

  return (
    <div className={styles.workspace}>
      <nav className={styles.tabs} aria-label="Content evaluation views">
        <button className={tab === "overview" ? styles.tabActive : styles.tab} onClick={() => setTab("overview")}><i className="ti ti-layout-dashboard" /> Overview</button>
        <button className={tab === "reel" ? styles.tabActive : styles.tab} onClick={() => setTab("reel")}><i className="ti ti-movie" /> Reels</button>
        <button className={tab === "feed" ? styles.tabActive : styles.tab} onClick={() => setTab("feed")}><i className="ti ti-carousel-horizontal" /> Feed &amp; Carousel</button>
        <button className={tab === "story-buyer" ? styles.tabActive : styles.tab} onClick={() => setTab("story-buyer")}><i className="ti ti-chart-dots" /> Story vs Buyer</button>
      </nav>

      <RangeStrip customEnd={customEnd} customStart={customStart} range={range} setCustomEnd={setCustomEnd} setCustomStart={setCustomStart} setRange={setRange} />
      {message ? <p className={styles.message}>{message}</p> : null}

      {tab === "overview" ? <Overview allScored={allScored} average={average} buyerByDate={buyerByDate} calendarMonth={calendarMonth} calendarVisible={calendarVisible} managementOpen={() => setEditing(null)} months={months} openImport={() => setImportOpen(true)} ranked={ranked} scored={scored} select={setSelected} setCalendarMonth={setCalendarMonth} setCalendarVisible={setCalendarVisible} setSort={setSort} setStoryMetric={setStoryMetric} sort={sort} storyItems={storyItems} storyMetric={storyMetric} /> : null}
      {tab === "reel" || tab === "feed" ? <FormatView action={action} grade={grade} items={formatItems} managementOpen={() => setEditing(null)} query={query} select={setSelected} setAction={setAction} setGrade={setGrade} setQuery={setQuery} tab={tab} /> : null}
      {tab === "story-buyer" ? <StoryBuyer buyerByDate={buyerByDate} buyers={storyBuyers} items={storyItems} select={setSelected} setSort={setStorySort} sort={storySort} totalBuyers={buyers.length} /> : null}

      {importOpen ? <Modal title="Import Meta Business Suite" close={() => setImportOpen(false)}><form action={importMeta} className={styles.importForm}><div className={styles.uploadArea}><i className="ti ti-file-type-csv" /><strong>Upload Meta CSV atau XLSX</strong><span>File akan dicocokkan berdasarkan Post ID.</span><input accept=".csv,.xlsx" name="file" required type="file" /></div><button className={styles.primaryButton} disabled={busy}>{busy ? "Mengimpor..." : "Import file"}</button></form></Modal> : null}
      {editing !== undefined ? <Modal wide title={editing ? "Edit Konten" : "Tambah Konten"} close={() => setEditing(undefined)}><EvaluationEditor record={editing} remove={removeEvaluation} save={saveEvaluation} /></Modal> : null}
      {selected ? <EvaluationDetail edit={() => { setEditing(selected.row); setSelected(null); }} item={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function RangeStrip({ range, setRange, customStart, customEnd, setCustomStart, setCustomEnd }: { range: string; setRange: (value: string) => void; customStart: string; customEnd: string; setCustomStart: (value: string) => void; setCustomEnd: (value: string) => void }) {
  return <div className={styles.dateStrip}><span>Range:</span>{[["7", "7 hari"], ["30", "30 hari"], ["90", "90 hari"], ["0", "Semua"], ["custom", "Custom"]].map(([value, label]) => <button className={range === value ? styles.dateActive : styles.dateButton} key={value} onClick={() => setRange(value)}>{label}</button>)}{range === "custom" ? <><input onChange={(event) => setCustomStart(event.target.value)} type="date" value={customStart} /><span>-</span><input onChange={(event) => setCustomEnd(event.target.value)} type="date" value={customEnd} /></> : null}</div>;
}

function Overview(props: { allScored: Scored[]; scored: Scored[]; ranked: Scored[]; average: number; months: Array<[string, { top: number; follows: number; links: number }]>; buyerByDate: Map<string, number>; storyItems: Scored[]; sort: SortMode; setSort: (value: SortMode) => void; select: (item: Scored) => void; calendarMonth: Date; setCalendarMonth: (value: Date) => void; calendarVisible: boolean; setCalendarVisible: (value: boolean) => void; storyMetric: "views" | "buyers"; setStoryMetric: (value: "views" | "buyers") => void; openImport: () => void; managementOpen: () => void }) {
  const { scored, ranked, average, months, buyerByDate, storyItems, sort, setSort, select, calendarMonth, setCalendarMonth, calendarVisible, setCalendarVisible, storyMetric, setStoryMetric, openImport, managementOpen } = props;
  const topReels = ranked.filter(({ row }) => row.format === "Reel").slice(0, 5);
  const topFeed = ranked.filter(({ row }) => ["Carousel", "Feed Photo"].includes(String(row.format))).slice(0, 5);
  const topStories = [...storyItems].sort((a, b) => storyMetric === "views" ? number(b.row.views || b.row.reach) - number(a.row.views || a.row.reach) : (buyerByDate.get(day(b.row.tanggal)) || 0) - (buyerByDate.get(day(a.row.tanggal)) || 0)).slice(0, 5);
  return <>
    <section className={styles.syncBanner}><i className="ti ti-brand-meta" /><div><strong>Import Meta Business Suite + Top-up Manual</strong><span>Upload CSV export dari Meta untuk bulk import. Metric advanced bisa di-top-up manual per konten.</span></div><button className={styles.secondaryButton} onClick={openImport}><i className="ti ti-file-import" /> Import Meta CSV</button><button className={styles.primaryButton} onClick={managementOpen}><i className="ti ti-plus" /> Tambah Manual</button></section>
    <div className={styles.statsFive}><Stat label="Total Konten" note="dievaluasi" value={scored.length} /><Stat accent label="Avg Score" note="dari 100" value={average} /><Stat accent label="Top Performer Reels" note="score >= 80" value={scored.filter((item) => item.row.format === "Reel" && item.score.grade === "top").length} /><Stat accent label="Top Performer Carousel" note="score >= 80" value={scored.filter((item) => ["Carousel", "Feed Photo"].includes(String(item.row.format)) && item.score.grade === "top").length} /><Stat accent label="Top Performer Story" note="score >= 80" value={scored.filter((item) => item.row.format === "Story" && item.score.grade === "top").length} /></div>
    <div className={styles.chartGrid}><BarChart icon="ti-chart-bar" rows={months.map(([label, value]) => ({ label, value: value.top }))} title="Top Performer / Bulan" /><BarChart icon="ti-users-plus" rows={months.map(([label, value]) => ({ label, value: value.follows }))} title="Total Follows / Bulan" /><BarChart icon="ti-link" rows={months.map(([label, value]) => ({ label, value: value.links }))} title="Total Link Taps / Bulan" /></div>
    <header className={styles.sectionHeader}><strong><i className="ti ti-trophy" /> Top 6 Konten - {sort === "follows" ? "Follows Terbanyak" : sort === "link" ? "Link Taps Terbanyak" : "Follows + Link Taps"}</strong><div><button className={sort === "combined" ? styles.smallActive : styles.smallButton} onClick={() => setSort("combined")}>Top Performer</button><button className={sort === "follows" ? styles.smallActive : styles.smallButton} onClick={() => setSort("follows")}><i className="ti ti-user-plus" /> Follows Terbanyak</button><button className={sort === "link" ? styles.smallActive : styles.smallButton} onClick={() => setSort("link")}><i className="ti ti-link" /> Link Taps Terbanyak</button></div></header>
    <div className={styles.topGrid}>{ranked.slice(0, 6).map((item, index) => <TopCard index={index} item={item} key={String(item.row.id)} select={select} />)}{!ranked.length ? <Empty text="Belum ada konten dalam range ini" /> : null}</div>
    <PostingCalendar items={props.allScored} month={calendarMonth} select={select} setMonth={setCalendarMonth} setVisible={setCalendarVisible} visible={calendarVisible} />
    <div className={styles.leaderGrid}><LeaderCard items={topReels} select={select} title="Top 5 Reels" /><LeaderCard items={topFeed} select={select} title="Top 5 Carousel" /><LeaderCard buyerByDate={buyerByDate} items={topStories} metric={storyMetric} select={select} setMetric={setStoryMetric} title="Top 5 Story" /></div>
  </>;
}

function Stat({ label, value, note, accent = false }: { label: string; value: ReactNode; note: string; accent?: boolean }) { return <article className={styles.stat}><span>{label}</span><strong className={accent ? styles.accent : undefined}>{value}</strong><small>{note}</small></article>; }

function BarChart({ title, icon, rows }: { title: string; icon: string; rows: Array<{ label: string; value: number }> }) {
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return <section className={styles.chartCard}><h3><i className={`ti ${icon}`} /> {title}</h3><div className={styles.chart}>{rows.length ? rows.map((row) => <div key={row.label}><span>{compact(row.value)}</span><i style={{ height: `${Math.max(3, row.value / maximum * 100)}%` }} /><small>{row.label.slice(5) || row.label}</small></div>) : <Empty text="Belum ada data" />}</div></section>;
}

function TopCard({ item, index, select }: { item: Scored; index: number; select: (item: Scored) => void }) {
  return <button className={styles.topCard} onClick={() => select(item)}><header><span className={index === 0 ? styles.rankFirst : styles.rank}>{index + 1}</span><strong>{String(item.row.judul || "Untitled")}</strong></header><div className={styles.tags}><span className={styles.formatTag}>{String(item.row.format || "Unknown")}</span><Score score={item.score} /></div><footer><Metric label="FOLLOWS" value={item.row.follows} /><Metric label="LINK TAPS" value={item.row.link_taps} /><Metric neutral label="REACH" value={item.row.reach || item.row.views} /></footer></button>;
}

function Metric({ label, value, neutral = false }: { label: string; value: unknown; neutral?: boolean }) { return <span className={neutral ? styles.metricNeutral : styles.metric}><strong>{compact(value)}</strong><small>{label}</small></span>; }
function Score({ score, short = false }: { score: ContentEvaluationResult; short?: boolean }) { return <span className={`${styles.score} ${scoreClass(score.grade)}`}>{score.total}{short ? "" : "/100"}</span>; }

function PostingCalendar({ items, month, setMonth, visible, setVisible, select }: { items: Scored[]; month: Date; setMonth: (value: Date) => void; visible: boolean; setVisible: (value: boolean) => void; select: (item: Scored) => void }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return <section className={styles.calendarSection}><header className={styles.sectionHeader}><strong><i className="ti ti-calendar" /> Kalender Posting</strong><div className={styles.legend}><span><i className={styles.carouselLegend} />Carousel</span><span><i className={styles.reelLegend} />Reels</span><button className={styles.smallButton} onClick={() => setVisible(!visible)}>{visible ? "Sembunyikan" : "Tampilkan"}</button></div></header>{visible ? <div className={styles.calendarCard}><header><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><i className="ti ti-chevron-left" /></button><strong>{month.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</strong><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><i className="ti ti-chevron-right" /></button></header><div className={styles.calendarGrid}>{DAYS.map((label) => <b key={label}>{label}</b>)}{Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: totalDays }, (_, index) => { const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`; const posts = items.filter(({ row }) => day(row.tanggal) === date && ["Reel", "Carousel", "Feed Photo"].includes(String(row.format))); const reels = posts.some(({ row }) => row.format === "Reel"); const feed = posts.some(({ row }) => row.format !== "Reel"); return <button className={reels && feed ? styles.mixedDay : reels ? styles.reelDay : feed ? styles.carouselDay : styles.calendarDay} key={date} onClick={() => posts[0] && select(posts[0])}><strong>{index + 1}</strong><span>{posts.slice(0, 3).map((post) => <i className={post.row.format === "Reel" ? styles.reelDot : styles.carouselDot} key={String(post.row.id)} />)}{posts.length > 3 ? <small>+{posts.length - 3}</small> : null}</span></button>; })}</div></div> : null}</section>;
}

function LeaderCard({ title, items, select, metric, setMetric, buyerByDate }: { title: string; items: Scored[]; select: (item: Scored) => void; metric?: "views" | "buyers"; setMetric?: (value: "views" | "buyers") => void; buyerByDate?: Map<string, number> }) {
  return <section className={styles.leaderCard}><header><strong>{title}</strong>{metric && setMetric ? <div><button className={metric === "views" ? styles.miniActive : styles.miniButton} onClick={() => setMetric("views")}><i className="ti ti-eye" /> Views</button><button className={metric === "buyers" ? styles.miniActive : styles.miniButton} onClick={() => setMetric("buyers")}><i className="ti ti-shopping-cart" /> Buyers</button></div> : null}</header><div>{items.length ? items.map((item, index) => <button key={String(item.row.id)} onClick={() => select(item)}><span className={index === 0 ? styles.rankFirst : styles.rank}>{index + 1}</span><p><strong>{String(item.row.judul || "Untitled")}</strong><small>{metric === "views" ? `${compact(item.row.views || item.row.reach)} views` : metric === "buyers" ? `${buyerByDate?.get(day(item.row.tanggal)) || 0} buyer` : `${compact(item.row.follows)} follows - ${compact(item.row.link_taps)} link taps`}</small></p>{metric ? <small>{dateLabel(item.row.tanggal)}</small> : <Score score={item.score} short />}</button>) : <Empty text="Belum ada data" />}</div></section>;
}

function FormatView({ tab, items, query, setQuery, grade, setGrade, action, setAction, select, managementOpen }: { tab: "reel" | "feed"; items: Scored[]; query: string; setQuery: (value: string) => void; grade: string; setGrade: (value: string) => void; action: string; setAction: (value: string) => void; select: (item: Scored) => void; managementOpen: () => void }) {
  const reel = tab === "reel";
  return <><header className={styles.formatToolbar}><div><input onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul konten..." value={query} /><select onChange={(event) => setGrade(event.target.value)} value={grade}><option value="">Semua Konten</option><option value="top">Top Performer (&gt;=80)</option>{reel ? <><option value="wtr">WTR Tertinggi</option><option value="nfpct">NF% Tertinggi</option></> : <><option value="follows">Follows Terbanyak</option><option value="link">Link Taps Terbanyak</option></>}</select><select onChange={(event) => setAction(event.target.value)} value={action}><option value="">Semua Action</option><option>Boost ke Meta Ads</option><option>Jadiin template konten serupa</option><option>Repurpose jadi format lain</option></select></div><button className={styles.primaryButton} onClick={managementOpen}><i className="ti ti-plus" /> Tambah {reel ? "Reels" : "Feed & Carousel"}</button></header><div className={styles.tableCard}>{items.length ? <div className={styles.tableScroll}><table><thead><tr><th>Konten</th><th>Score</th><th>Reach</th>{reel ? <><th>WTR</th><th>NF%</th><th>Saves</th><th>Shares</th><th>Follows</th><th>Follow Rate</th><th>Link Taps</th></> : <><th>Saves</th><th>Save Rate</th><th>Shares</th><th>Comments</th><th>Follows</th><th>Link Taps</th><th>NF%</th></>}<th>Action</th></tr></thead><tbody>{items.map((item) => { const followRate = number(item.row.reach) ? number(item.row.follows) / number(item.row.reach) * 100 : 0; return <tr key={String(item.row.id)} onClick={() => select(item)}><td><strong>{String(item.row.judul || "Untitled")}</strong><small>{dateLabel(item.row.tanggal)}</small></td><td><Score score={item.score} short /></td><td><strong>{compact(item.row.reach)}</strong></td>{reel ? <><td>{number(item.row.wtr) ? `${number(item.row.wtr)}%` : "-"}</td><td>{number(item.row.nf_pct)}%</td><td>{compact(item.row.saves)}</td><td>{compact(item.row.shares)}</td><td className={styles.accent}>{compact(item.row.follows)}</td><td>{followRate.toFixed(2)}%</td><td className={styles.accent}>{compact(item.row.link_taps)}</td></> : <><td>{compact(item.row.saves)}</td><td>{percent(item.score.rates.saveRate || 0)}</td><td>{compact(item.row.shares)}</td><td>{compact(item.row.comments)}</td><td className={styles.accent}>{compact(item.row.follows)}</td><td className={styles.accent}>{compact(item.row.link_taps)}</td><td>{number(item.row.nf_pct)}%</td></>}<td>{String(item.row.action || "-")}</td></tr>; })}</tbody></table></div> : <Empty text="Belum ada konten dalam range ini" />}</div></>;
}

function StoryBuyer({ items, buyers, totalBuyers, buyerByDate, select, sort, setSort }: { items: Scored[]; buyers: ApiRecord[]; totalBuyers: number; buyerByDate: Map<string, number>; select: (item: Scored) => void; sort: "recent" | "buyers"; setSort: (value: "recent" | "buyers") => void }) {
  const dates = [...new Set([...items.map((item) => day(item.row.tanggal)), ...buyers.map((row) => day(row.tanggal))].filter(Boolean))].sort((a, b) => sort === "buyers" ? (buyerByDate.get(b) || 0) - (buyerByDate.get(a) || 0) : b.localeCompare(a));
  return <><div className={styles.statsThree}><Stat label="Total Buyer" note="semua sumber" value={totalBuyers} /><Stat accent label="Buyer dari IG Story" note="sumber Instagram Story" value={buyers.length} /><Stat accent label="Conversion Rate" note="IG Story / Total" value={totalBuyers ? percent(buyers.length / totalBuyers * 100) : "0.0%"} /></div><header className={styles.storyHeader}><strong>Korelasi per Hari</strong><div><button className={sort === "recent" ? styles.smallActive : styles.smallButton} onClick={() => setSort("recent")}><i className="ti ti-clock" /> Terbaru</button><button className={sort === "buyers" ? styles.smallActive : styles.smallButton} onClick={() => setSort("buyers")}><i className="ti ti-arrow-down" /> Buyer Terbanyak</button></div></header><div className={styles.storyDays}>{dates.length ? dates.map((date) => { const posts = items.filter((item) => day(item.row.tanggal) === date); const count = buyerByDate.get(date) || 0; return <details key={date}><summary><span><i className="ti ti-chevron-right" /> {dateLabel(date)}</span><b className={count ? styles.buyerActive : styles.buyerEmpty}>{count} buyer</b></summary><div>{posts.length ? posts.map((item) => <button key={String(item.row.id)} onClick={() => select(item)}><i className="ti ti-photo" /><span><strong>{String(item.row.judul || "Untitled")}</strong><small>{compact(item.row.views || item.row.reach)} views</small></span><Score score={item.score} short /></button>) : <p>Tidak ada Story pada tanggal ini</p>}</div></details>; }) : <Empty text="Belum ada Story maupun Buyer dari Instagram Story" />}</div></>;
}

function EvaluationEditor({ record, save, remove }: { record: ApiRecord | null; save: (formData: FormData) => Promise<void>; remove: () => Promise<void> }) {
  const [format, setFormat] = useState(String(record?.format || "Carousel"));
  const input = (name: string) => record?.[name] === null || record?.[name] === undefined ? "" : String(record[name]);
  const numeric = (name: string, label: string) => <Field label={label}><input defaultValue={input(name)} min="0" name={name} step="any" type="number" /></Field>;
  return <form action={save} className={styles.editorForm}>
    <input name="account_id" type="hidden" value={input("account_id")} />
    <input name="account_username" type="hidden" value={input("account_username")} />
    <section><h3>Informasi konten</h3><div className={styles.formGrid}><Field label="Judul"><input defaultValue={input("judul")} name="judul" required /></Field><Field label="Post URL"><input defaultValue={input("url")} name="url" placeholder="https://..." /></Field><Field label="Format"><select name="format" onChange={(event) => setFormat(event.target.value)} value={format}><option>Carousel</option><option>Feed Photo</option><option>Reel</option><option>Story</option></select></Field><Field label="Tanggal publish"><input defaultValue={day(record?.tanggal)} name="tanggal" type="date" /></Field><Field label="Topik"><input defaultValue={input("topik")} name="topik" /></Field><Field label="Post ID"><input defaultValue={input("post_id")} name="post_id" /></Field></div><Field label="Description"><textarea defaultValue={input("description")} name="description" rows={2} /></Field></section>
    <section><h3>Organic performance</h3><div className={styles.formGrid}>{numeric("followers", "Followers saat posting")}{numeric("views", "Views")}{numeric("reach", "Reach")}{numeric("nf_pct", "Non-follower reach %")}{numeric("from_home", "From home")}{numeric("from_profile", "From profile")}{numeric("from_other", "From other")}{numeric("engaged", "Accounts engaged")}{numeric("profile_visits", "Profile visits")}{numeric("link_taps", "Link taps")}</div></section>
    <section><h3>Engagement</h3><div className={styles.formGrid}>{numeric("likes", "Likes")}{numeric("comments", "Comments")}{numeric("saves", "Saves")}{numeric("shares", "Shares")}{numeric("follows", "Follows")}</div></section>
    {format === "Reel" ? <section><h3>Reel metrics</h3><div className={styles.formGrid}>{numeric("watchtime", "Average watch time")}{numeric("wtr", "Watch-through rate %")}{numeric("duration", "Duration seconds")}{numeric("replays", "Replays")}{numeric("dropoff", "Drop-off second")}</div></section> : null}
    {format === "Story" ? <section><h3>Story metrics</h3><div className={styles.formGrid}>{numeric("taps_forward", "Taps forward")}{numeric("taps_back", "Taps back")}{numeric("exits", "Exits")}{numeric("replies", "Replies")}{numeric("stickers_interact", "Sticker interactions")}</div></section> : null}
    <section><h3>Creative review</h3><div className={styles.formGrid}>{numeric("hook_rating", "Hook rating (1-5)")}<Field label="CTA effectiveness"><select defaultValue={input("cta_eff")} name="cta_eff"><option value="">-</option><option value="high">high</option><option value="med">med</option><option value="low">low</option></select></Field><Field label="Next action"><select defaultValue={input("action")} name="action"><option value="">Pilih action...</option><option>Boost ke Meta Ads</option><option>Jadiin template konten serupa</option><option>Repurpose jadi format lain</option><option>Archive</option></select></Field><Field label="Thumbnail key / URL"><input defaultValue={input("thumbnail_url")} name="thumbnail_url" /></Field></div><div className={styles.formGrid}><Field label="What worked"><textarea defaultValue={input("win")} name="win" rows={3} /></Field><Field label="Needs improvement"><textarea defaultValue={input("improve")} name="improve" rows={3} /></Field></div></section>
    <footer className={styles.editorFooter}>{record ? <button className={styles.deleteButton} formAction={async () => { await remove(); }} formNoValidate type="submit"><i className="ti ti-trash" /> Hapus</button> : <span />}<div><button className={styles.secondaryButton} type="reset">Reset</button><button className={styles.primaryButton} type="submit"><i className="ti ti-device-floppy" /> Simpan</button></div></footer>
  </form>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className={styles.editorField}><span>{label}</span>{children}</label>; }

function EvaluationDetail({ item, onClose, edit }: { item: Scored; onClose: () => void; edit: () => void }) {
  const { row, score } = item;
  const story = row.format === "Story";
  const metrics = story ? [["Views", row.views || row.reach], ["Taps forward", row.taps_forward], ["Taps back", `${compact(row.taps_back)} (${percent(score.rates.tapsBackRate || 0)})`], ["Exits", `${compact(row.exits)} (${percent(score.rates.exitRate || 0)})`], ["Replies", row.replies], ["Link taps", row.link_taps]] : [["Views", row.views], ["Reach", row.reach], ["Non-follower reach", `${number(row.nf_pct)}%`], ["Likes / comments", `${compact(row.likes)} / ${compact(row.comments)}`], ["Saves", `${compact(row.saves)} (${percent(score.rates.saveRate || 0)})`], ["Shares", `${compact(row.shares)} (${percent(score.rates.shareRate || 0)})`], ["Follows", `${compact(row.follows)} (${percent(score.rates.followRate || 0)})`], ["Link taps", row.link_taps], ...(row.format === "Reel" ? [["WTR", `${number(row.wtr)}%`], ["Avg watch time", row.watchtime], ["Drop-off second", row.dropoff]] : [])];
  return <Modal wide title={String(row.judul || "Untitled")} close={onClose}><div className={styles.detailMeta}><span>{String(row.format)} - {dateLabel(row.tanggal)}</span><small>{String(row.topik || "No topic")}</small><button className={styles.secondaryButton} onClick={edit}><i className="ti ti-edit" /> Edit konten</button></div><div className={styles.scoreHero}><div><strong>{score.total}</strong><span>{gradeLabel(score.grade)}</span><small>{score.partial ? "Preliminary score - lengkapi advanced metrics." : "Complete adaptive score."}</small></div><progress max="100" value={score.total} /></div><div className={styles.detailGrid}><section><h3>Full metrics</h3>{metrics.map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{typeof value === "number" ? compact(value) : String(value || "-")}</strong></div>)}</section><section><h3>Automatic insights</h3>{score.insights.map((insight, index) => <div className={`${styles.insight} ${insight.type === "positive" ? styles.insightPositive : insight.type === "warning" ? styles.insightWarning : styles.insightNeutral}`} key={`${insight.text}-${index}`}><i className={`ti ti-${insight.type === "positive" ? "circle-check" : insight.type === "warning" ? "alert-triangle" : "info-circle"}`} /><span>{insight.text}</span></div>)}{row.win ? <aside><strong>What worked</strong><p>{String(row.win)}</p></aside> : null}{row.improve ? <aside><strong>Needs improvement</strong><p>{String(row.improve)}</p></aside> : null}{row.url ? <a className={styles.secondaryButton} href={String(row.url)} rel="noreferrer" target="_blank"><i className="ti ti-brand-instagram" /> Open post</a> : null}</section></div></Modal>;
}

function Modal({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) { return <div className={styles.overlay} onMouseDown={close}><section className={wide ? styles.modalWide : styles.modal} onMouseDown={(event) => event.stopPropagation()}><header><strong>{title}</strong><button onClick={close}><i className="ti ti-x" /></button></header><div className={styles.modalBody}>{children}</div></section></div>; }
function Empty({ text }: { text: string }) { return <div className={styles.empty}><i className="ti ti-chart-bar-off" /><span>{text}</span></div>; }
