"use client";

import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { evaluateContentEvaluation, type ContentEvaluationResult } from "@/lib/analytics/content";
import type { ApiRecord } from "@/lib/api/_crud";
import { ACTION_VALUES, actionLabel, compact, day, inRange, num } from "@/lib/marketing/view";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import { confirmAction, notifyError } from "./app-dialog";
import { guard } from "./safe-action";
import c from "./content-evaluation.module.css";
import s from "./page-kit.module.css";
import { usePagination } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";

// Content Evaluation in the IJIS layout. Same records (content_evaluations), same scoring
// (evaluateContentEvaluation), same import endpoint; the stored "action" values stay
// Indonesian and only their labels are English.

type View = "overview" | "reel" | "feed" | "story-buyer";
type Scored = { row: ApiRecord; score: ContentEvaluationResult };
type SortMode = "combined" | "follows" | "link";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RANGES = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["0", "All time"], ["custom", "Custom"]] as const;
const FEED = ["Carousel", "Feed Photo"];
const GRADE: Record<ContentEvaluationResult["grade"], string> = { top: "Top Performer", good: "Performing Well", avg: "Average", low: "Needs Improvement" };

const pct = (value: number) => `${value.toFixed(1)}%`;
const isFeed = (row: ApiRecord) => FEED.includes(String(row.format));
function dateLabel(value: unknown) { const key = day(value); if (!key) return "—"; const [y, m, d] = key.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; }
function monthName(key: string) { const [y, m] = key.split("-").map(Number); return `${MONTHS[m - 1]} ${String(y).slice(2)}`; }
function gradeClass(grade: ContentEvaluationResult["grade"]) { return { top: c.gradeTop, good: c.gradeGood, avg: c.gradeAvg, low: c.gradeLow }[grade]; }
function sortItems(items: Scored[], mode: SortMode) {
  const value = (item: Scored) => mode === "follows" ? num(item.row.follows) : mode === "link" ? num(item.row.link_taps) : num(item.row.follows) + num(item.row.link_taps);
  return [...items].sort((a, b) => value(b) - value(a));
}

export function ContentEvaluationTools({ evaluations, buyers, buyerTotal }: { evaluations: ApiRecord[]; buyers: ApiRecord[]; /** All buyers across sources; `buyers` may hold only the Instagram Story ones. */ buyerTotal?: number }) {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [range, setRange] = useState("0");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<Scored | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ApiRecord | null | undefined>(undefined);
  const [message, setMessage] = useState("");

  const allScored = useMemo(() => evaluations.map((row) => ({ row, score: evaluateContentEvaluation(row) })), [evaluations]);
  useRecordFocus((id) => {
    const item = allScored.find(({ row }) => String(row.id) === id);
    if (!item) return;
    setSelected(item);
    return true;
  });
  const scored = useMemo(() => allScored.filter(({ row }) => inRange(day(row.tanggal), range, today, customStart, customEnd)), [allScored, range, today, customStart, customEnd]);
  const reels = scored.filter(({ row }) => row.format === "Reel");
  const feed = scored.filter(({ row }) => isFeed(row));
  const stories = scored.filter(({ row }) => row.format === "Story");
  const buyerByDate = useMemo(() => { const map = new Map<string, number>(); buyers.filter((row) => row.sumber === "Instagram Story").forEach((row) => { const key = day(row.tanggal); if (key) map.set(key, (map.get(key) || 0) + 1); }); return map; }, [buyers]);
  const average = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.score.total, 0) / scored.length) : 0;

  const views: { key: View; label: string; icon: string; count?: number }[] = [
    { key: "overview", label: "Overview", icon: "ti-layout-dashboard" },
    { key: "reel", label: "Reels", icon: "ti-movie", count: reels.length },
    { key: "feed", label: "Feed & Carousel", icon: "ti-carousel-horizontal", count: feed.length },
    { key: "story-buyer", label: "Story vs Buyer", icon: "ti-chart-dots", count: stories.length },
  ];

  async function saveEvaluation(formData: FormData) {
    if (editing?.id) await updateManagedRecord("content_evaluations", String(editing.id), formData);
    else await createManagedRecord("content_evaluations", formData);
    setEditing(undefined);
    router.refresh();
  }
  async function removeEvaluation() {
    if (!editing?.id || !(await confirmAction({ title: "Delete this evaluation?", message: "This cannot be undone.", confirmLabel: "Delete evaluation", danger: true }))) return;
    const id = String(editing.id);
    await guard(async () => {
      await deleteManagedRecord("content_evaluations", id);
      setEditing(undefined);
      setSelected(null);
      router.refresh();
    }, "Could not delete the evaluation.");
  }

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Marketing</span>
          <h1>Content Evaluation</h1>
          <p>{scored.length} post{scored.length === 1 ? "" : "s"} scored{range === "0" ? "" : " in this range"} · average score {average}/100</p>
        </div>
        <div className={s.headActions}>
          <button className={s.ghost} onClick={() => setImportOpen(true)} type="button"><i className="ti ti-file-import" aria-hidden="true" /> Import Meta CSV</button>
          <button className={s.primary} onClick={() => setEditing(null)} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add evaluation</button>
        </div>
      </header>

      <div className={s.toolbar}>
        <div aria-label="Content evaluation views" className={s.segmented} role="tablist">
          {views.map((item) => <button aria-selected={view === item.key} className={view === item.key ? s.segmentActive : s.segment} key={item.key} onClick={() => setView(item.key)} role="tab" type="button"><i className={`ti ${item.icon}`} aria-hidden="true" /> {item.label}{item.count !== undefined ? <span>{item.count}</span> : null}</button>)}
        </div>
        <span className={s.spacer} />
        <div className={`${s.pills} ${c.range}`} role="group" aria-label="Date range">
          {RANGES.map(([value, label]) => <button aria-pressed={range === value} className={range === value ? s.pillOn : s.pill} key={value} onClick={() => setRange(value)} type="button">{label}</button>)}
        </div>
        {range === "custom" ? (
          <div className={c.custom}>
            <label className={s.filterPill}><span>From</span><input aria-label="From date" onChange={(e) => setCustomStart(e.target.value)} type="date" value={customStart} /></label>
            <label className={s.filterPill}><span>To</span><input aria-label="To date" onChange={(e) => setCustomEnd(e.target.value)} type="date" value={customEnd} /></label>
          </div>
        ) : null}
      </div>
      {message ? <p className={s.message} role="status">{message}</p> : null}

      {view === "overview" ? <Overview allScored={allScored} average={average} buyerByDate={buyerByDate} feed={feed} reels={reels} scored={scored} select={setSelected} stories={stories} /> : null}
      {view === "reel" || view === "feed" ? <FormatView add={() => setEditing(null)} items={view === "reel" ? reels : feed} key={view} select={setSelected} view={view} /> : null}
      {view === "story-buyer" ? <StoryBuyer buyerByDate={buyerByDate} buyers={buyers} items={stories} total={buyerTotal ?? buyers.length} scored={scored} select={setSelected} /> : null}

      {importOpen ? <ImportDialog close={() => setImportOpen(false)} done={(text) => { setMessage(text); setImportOpen(false); router.refresh(); }} /> : null}
      {editing !== undefined ? <EvaluationEditor close={() => setEditing(undefined)} record={editing} remove={removeEvaluation} save={saveEvaluation} /> : null}
      {selected ? <EvaluationDetail close={() => setSelected(null)} edit={() => { setEditing(selected.row); setSelected(null); }} item={selected} /> : null}
    </div>
  );
}

function Overview({ allScored, scored, reels, feed, stories, average, buyerByDate, select }: { allScored: Scored[]; scored: Scored[]; reels: Scored[]; feed: Scored[]; stories: Scored[]; average: number; buyerByDate: Map<string, number>; select: (item: Scored) => void }) {
  const [sort, setSort] = useState<SortMode>("combined");
  const [storyMetric, setStoryMetric] = useState<"views" | "buyers">("views");
  const ranked = sortItems(scored, sort);
  const top = (items: Scored[]) => items.filter((item) => item.score.grade === "top").length;
  const months = useMemo(() => {
    const grouped = new Map<string, { top: number; follows: number; links: number }>();
    allScored.forEach(({ row, score }) => { const key = day(row.tanggal).slice(0, 7); if (!key) return; const item = grouped.get(key) || { top: 0, follows: 0, links: 0 }; if (score.grade === "top") item.top += 1; item.follows += num(row.follows); item.links += num(row.link_taps); grouped.set(key, item); });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [allScored]);
  const topStories = [...stories].sort((a, b) => storyMetric === "views" ? num(b.row.views || b.row.reach) - num(a.row.views || a.row.reach) : (buyerByDate.get(day(b.row.tanggal)) || 0) - (buyerByDate.get(day(a.row.tanggal)) || 0)).slice(0, 5);

  return (
    <>
      <div className={s.stats}>
        <div className={s.stat}><span>Posts evaluated</span><b>{scored.length}</b><small>In this range</small></div>
        <div className={s.stat}><span>Average score</span><b>{average}</b><small>Out of 100</small></div>
        <div className={s.stat}><span>Top Reels</span><b>{top(reels)}</b><small>Score 80+</small></div>
        <div className={s.stat}><span>Top Carousels</span><b>{top(feed)}</b><small>Score 80+</small></div>
        <div className={s.stat}><span>Top Stories</span><b>{top(stories)}</b><small>Score 80+</small></div>
      </div>

      <section aria-label="Top content" className={s.card}>
        <div className={s.cardHead}>
          <div><h2>Top content</h2><p className={s.cardSub}>Ranked by {sort === "follows" ? "follows" : sort === "link" ? "link taps" : "follows + link taps"}</p></div>
          <div className={s.pills} role="group" aria-label="Rank top content by">
            {([["combined", "Follows + link taps"], ["follows", "Follows"], ["link", "Link taps"]] as const).map(([value, label]) => <button aria-pressed={sort === value} className={sort === value ? s.pillOn : s.pill} key={value} onClick={() => setSort(value)} type="button">{label}</button>)}
          </div>
        </div>
        {ranked.length ? (
          <ol className={c.topGrid}>
            {ranked.slice(0, 6).map((item, index) => (
              <li key={String(item.row.id)}>
                <button className={c.topCard} data-record-id={String(item.row.id)} data-record-open onClick={() => select(item)} type="button">
                  <span className={index === 0 ? c.rankFirst : c.rank}>{index + 1}</span>
                  <span className={c.topBody}>
                    <b>{String(item.row.judul || "Untitled")}</b>
                    <span className={c.topTags}><span className={s.chipMuted}>{String(item.row.format || "Unknown")}</span><Score score={item.score} /></span>
                    <span className={c.topMetrics}><span><b>{compact(item.row.follows)}</b> follows</span><span><b>{compact(item.row.link_taps)}</b> link taps</span><span><b>{compact(item.row.reach || item.row.views)}</b> reach</span></span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : <p className={s.empty}>No content in this date range.</p>}
      </section>

      <div className={s.grid3}>
        <MonthBars rows={months.map(([key, v]) => ({ key, value: v.top }))} sub="Score 80+" title="Top performers per month" />
        <MonthBars rows={months.map(([key, v]) => ({ key, value: v.follows }))} sub="All formats" title="Follows per month" />
        <MonthBars rows={months.map(([key, v]) => ({ key, value: v.links }))} sub="All formats" title="Link taps per month" />
      </div>

      <PostingCalendar items={allScored} select={select} />

      <div className={s.grid3}>
        <Leaders items={sortItems(reels, "combined").slice(0, 5)} select={select} title="Top 5 Reels" />
        <Leaders items={sortItems(feed, "combined").slice(0, 5)} select={select} title="Top 5 Carousels" />
        <Leaders buyerByDate={buyerByDate} items={topStories} metric={storyMetric} select={select} setMetric={setStoryMetric} title="Top 5 Stories" />
      </div>
    </>
  );
}

function Score({ score, short = false }: { score: ContentEvaluationResult; short?: boolean }) {
  return <span className={`${c.score} ${gradeClass(score.grade)}`} title={GRADE[score.grade]}>{score.total}{short ? "" : "/100"}</span>;
}

function MonthBars({ title, sub, rows }: { title: string; sub: string; rows: Array<{ key: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className={s.card}>
      <div><h3>{title}</h3><p className={s.cardSub}>{sub}</p></div>
      {rows.length ? (
        <div className={s.barChart}>
          {rows.map((row) => <div className={s.barCol} key={row.key}><span className={c.barWithValue}><small>{compact(row.value)}</small><i style={{ height: `${Math.max(3, row.value / max * 100)}%` }} /></span><small>{monthName(row.key)}</small></div>)}
        </div>
      ) : <p className={s.empty}>No data yet.</p>}
    </section>
  );
}

function PostingCalendar({ items, select }: { items: Scored[]; select: (item: Scored) => void }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [open, setOpen] = useState(true);
  const lead = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7; // Monday first
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const posted = items.filter(({ row }) => row.format === "Reel" || isFeed(row));
  return (
    <section aria-label="Posting calendar" className={s.card}>
      <div className={s.cardHead}>
        <div><h2>Posting calendar</h2><p className={s.cardSub}>Reels and feed posts by publish date</p></div>
        <div className={c.legend}><span><i className={c.dotFeed} /> Feed</span><span><i className={c.dotReel} /> Reel</span><button className={s.ghost} onClick={() => setOpen(!open)} type="button">{open ? "Hide calendar" : "Show calendar"}</button></div>
      </div>
      {open ? (
        <>
          <div className={c.monthNav}>
            <button aria-label="Previous month" className={s.iconButton} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} type="button"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
            <b>{MONTHS[month.getMonth()]} {month.getFullYear()}</b>
            <button aria-label="Next month" className={s.iconButton} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} type="button"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
          </div>
          <div className={c.calendar}>
            {WEEKDAYS.map((label) => <b key={label}>{label}</b>)}
            {Array.from({ length: lead }, (_, i) => <span key={`blank-${i}`} />)}
            {Array.from({ length: total }, (_, i) => {
              const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
              const posts = posted.filter(({ row }) => day(row.tanggal) === date);
              return (
                <button aria-label={`${i + 1} ${MONTHS[month.getMonth()]}: ${posts.length} post${posts.length === 1 ? "" : "s"}`} className={posts.length ? c.dayOn : c.day} disabled={!posts.length} key={date} onClick={() => posts[0] && select(posts[0])} type="button">
                  <small>{i + 1}</small>
                  <span>{posts.slice(0, 3).map((post) => <i className={post.row.format === "Reel" ? c.dotReel : c.dotFeed} key={String(post.row.id)} />)}{posts.length > 3 ? <em>+{posts.length - 3}</em> : null}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}

function Leaders({ title, items, select, metric, setMetric, buyerByDate }: { title: string; items: Scored[]; select: (item: Scored) => void; metric?: "views" | "buyers"; setMetric?: (value: "views" | "buyers") => void; buyerByDate?: Map<string, number> }) {
  return (
    <section aria-label={title} className={s.card}>
      <div className={s.cardHead}>
        <h3>{title}</h3>
        {metric && setMetric ? <div className={s.pills} role="group" aria-label="Rank stories by">{(["views", "buyers"] as const).map((value) => <button aria-pressed={metric === value} className={metric === value ? s.pillOn : s.pill} key={value} onClick={() => setMetric(value)} type="button">{value === "views" ? "Views" : "Buyers"}</button>)}</div> : null}
      </div>
      {items.length ? (
        <ol className={c.leaders}>
          {items.map((item, index) => {
            const buyersOnDay = buyerByDate?.get(day(item.row.tanggal)) || 0;
            return (
              <li key={String(item.row.id)}>
                <button onClick={() => select(item)} type="button">
                  <span className={index === 0 ? c.rankFirst : c.rank}>{index + 1}</span>
                  <span className={c.leaderBody}><b>{String(item.row.judul || "Untitled")}</b><small>{metric === "views" ? `${compact(item.row.views || item.row.reach)} views · ${dateLabel(item.row.tanggal)}` : metric === "buyers" ? `${buyersOnDay} buyer${buyersOnDay === 1 ? "" : "s"} that day · ${dateLabel(item.row.tanggal)}` : `${compact(item.row.follows)} follows · ${compact(item.row.link_taps)} link taps`}</small></span>
                  <Score score={item.score} short />
                </button>
              </li>
            );
          })}
        </ol>
      ) : <p className={s.empty}>No data yet.</p>}
    </section>
  );
}

function FormatView({ view, items, select, add }: { view: "reel" | "feed"; items: Scored[]; select: (item: Scored) => void; add: () => void }) {
  const reel = view === "reel";
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("");
  const [action, setAction] = useState("");
  const shown = useMemo(() => {
    let list = items;
    if (query) list = list.filter(({ row }) => `${row.judul || ""} ${row.topik || ""}`.toLowerCase().includes(query.toLowerCase()));
    if (show === "top") list = list.filter(({ score }) => score.grade === "top");
    if (action) list = list.filter(({ row }) => row.action === action);
    if (show === "wtr") return list.filter(({ row }) => num(row.wtr) > 0).sort((a, b) => num(b.row.wtr) - num(a.row.wtr));
    if (show === "nfpct") return list.filter(({ row }) => num(row.nf_pct) > 0).sort((a, b) => num(b.row.nf_pct) - num(a.row.nf_pct));
    if (show === "follows") return [...list].sort((a, b) => num(b.row.follows) - num(a.row.follows));
    if (show === "link") return [...list].sort((a, b) => num(b.row.link_taps) - num(a.row.link_taps));
    return [...list].sort((a, b) => b.score.total - a.score.total);
  }, [items, query, show, action]);
  const { pageItems, page, setPage, totalPages } = usePagination(shown, 15);
  const reset = (fn: () => void) => { fn(); setPage(0); };

  return (
    <section aria-label={reel ? "Reels" : "Feed and carousel"} className={s.card}>
      <div className={s.toolbar}>
        <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search content" onChange={(e) => reset(() => setQuery(e.target.value))} placeholder="Search title or topic" value={query} /></label>
        <label className={s.filterPill}><span>Show</span><select aria-label="Show" onChange={(e) => reset(() => setShow(e.target.value))} value={show}><option value="">All, by score</option><option value="top">Top performers (80+)</option>{reel ? <><option value="wtr">Highest watch-through</option><option value="nfpct">Highest non-follower reach</option></> : <><option value="follows">Most follows</option><option value="link">Most link taps</option></>}</select></label>
        <label className={s.filterPill}><span>Next action</span><select aria-label="Filter next action" onChange={(e) => reset(() => setAction(e.target.value))} value={action}><option value="">Any</option>{ACTION_VALUES.filter((v) => v !== "Archive").map((v) => <option key={v} value={v}>{actionLabel(v)}</option>)}</select></label>
        <span className={s.spacer} />
        <button className={s.primary} onClick={add} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add {reel ? "Reel" : "feed post"}</button>
      </div>
      {shown.length ? (
        <>
          <div className={s.tableWrap}>
            <table className={`${s.table} ${c.rows}`}>
              <thead><tr><th>Content</th><th>Score</th><th className={s.num}>Reach</th>{reel ? <><th className={s.num}>WTR</th><th className={s.num}>Non-follower</th><th className={s.num}>Saves</th><th className={s.num}>Shares</th><th className={s.num}>Follows</th><th className={s.num}>Follow rate</th><th className={s.num}>Link taps</th></> : <><th className={s.num}>Saves</th><th className={s.num}>Save rate</th><th className={s.num}>Shares</th><th className={s.num}>Comments</th><th className={s.num}>Follows</th><th className={s.num}>Link taps</th><th className={s.num}>Non-follower</th></>}<th>Next action</th></tr></thead>
              <tbody>
                {pageItems.map((item) => {
                  const { row } = item;
                  const followRate = num(row.reach) ? num(row.follows) / num(row.reach) * 100 : 0;
                  return (
                    <tr data-record-id={String(row.id)} key={String(row.id)} onClick={() => select(item)}>
                      <td><button className={c.rowTitle} onClick={(e) => { e.stopPropagation(); select(item); }} type="button"><b>{String(row.judul || "Untitled")}</b><small>{dateLabel(row.tanggal)}{row.topik ? ` · ${String(row.topik)}` : ""}</small></button></td>
                      <td><Score score={item.score} short /></td>
                      <td className={s.num}><b>{compact(row.reach)}</b></td>
                      {reel ? <><td className={s.num}>{num(row.wtr) ? `${num(row.wtr)}%` : "—"}</td><td className={s.num}>{num(row.nf_pct)}%</td><td className={s.num}>{compact(row.saves)}</td><td className={s.num}>{compact(row.shares)}</td><td className={s.num}><b>{compact(row.follows)}</b></td><td className={s.num}>{followRate.toFixed(2)}%</td><td className={s.num}><b>{compact(row.link_taps)}</b></td></> : <><td className={s.num}>{compact(row.saves)}</td><td className={s.num}>{pct(item.score.rates.saveRate || 0)}</td><td className={s.num}>{compact(row.shares)}</td><td className={s.num}>{compact(row.comments)}</td><td className={s.num}><b>{compact(row.follows)}</b></td><td className={s.num}><b>{compact(row.link_taps)}</b></td><td className={s.num}>{num(row.nf_pct)}%</td></>}
                      <td>{row.action ? <span className={s.chip}>{actionLabel(row.action)}</span> : <span className={s.muted}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className={s.pager}>
              <button aria-label="Previous page" className={s.iconButton} disabled={page <= 0} onClick={() => setPage(page - 1)} type="button"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
              <span>Page {page + 1} of {totalPages}</span>
              <button aria-label="Next page" className={s.iconButton} disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} type="button"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
            </div>
          ) : null}
        </>
      ) : <p className={s.empty}>{items.length ? "Nothing matches these filters." : "No content in this date range."}</p>}
    </section>
  );
}

function StoryBuyer({ items, scored, buyers, buyerByDate, select, total }: { items: Scored[]; scored: Scored[]; buyers: ApiRecord[]; buyerByDate: Map<string, number>; select: (item: Scored) => void; total: number }) {
  const [sort, setSort] = useState<"recent" | "buyers">("recent");
  const storyBuyers = buyers.filter((row) => row.sumber === "Instagram Story" && scored.some(({ row: item }) => day(item.tanggal) === day(row.tanggal)));
  const dates = [...new Set([...items.map((item) => day(item.row.tanggal)), ...storyBuyers.map((row) => day(row.tanggal))].filter(Boolean))].sort((a, b) => sort === "buyers" ? (buyerByDate.get(b) || 0) - (buyerByDate.get(a) || 0) : b.localeCompare(a));
  return (
    <>
      <div className={s.stats}>
        <div className={s.stat}><span>All buyers</span><b>{total}</b><small>Every source</small></div>
        <div className={s.stat}><span>Buyers from IG Story</span><b>{storyBuyers.length}</b><small>Source: Instagram Story</small></div>
        <div className={s.stat}><span>Story share</span><b>{total ? pct(storyBuyers.length / total * 100) : "0.0%"}</b><small>IG Story ÷ all buyers</small></div>
      </div>
      <section aria-label="Stories and buyers by day" className={s.card}>
        <div className={s.cardHead}>
          <div><h2>Stories and buyers by day</h2><p className={s.cardSub}>Open a day to see the stories posted</p></div>
          <div className={s.pills} role="group" aria-label="Sort days">{([["recent", "Most recent"], ["buyers", "Most buyers"]] as const).map(([value, label]) => <button aria-pressed={sort === value} className={sort === value ? s.pillOn : s.pill} key={value} onClick={() => setSort(value)} type="button">{label}</button>)}</div>
        </div>
        {dates.length ? (
          <div className={c.days}>
            {dates.map((date) => {
              const posts = items.filter((item) => day(item.row.tanggal) === date);
              const count = buyerByDate.get(date) || 0;
              return (
                <details key={date}>
                  <summary><i className="ti ti-chevron-right" aria-hidden="true" /><b>{dateLabel(date)}</b><span className={s.muted}>{posts.length} stor{posts.length === 1 ? "y" : "ies"}</span><span className={s.spacer} /><span className={count ? s.chipStrong : s.chipMuted}>{count} buyer{count === 1 ? "" : "s"}</span></summary>
                  <ul>
                    {posts.length ? posts.map((item) => <li key={String(item.row.id)}><button onClick={() => select(item)} type="button"><i className="ti ti-photo" aria-hidden="true" /><span className={c.leaderBody}><b>{String(item.row.judul || "Untitled")}</b><small>{compact(item.row.views || item.row.reach)} views</small></span><Score score={item.score} short /></button></li>) : <li className={s.muted}>No stories on this date.</li>}
                  </ul>
                </details>
              );
            })}
          </div>
        ) : <p className={s.empty}>No stories or Instagram Story buyers yet.</p>}
      </section>
    </>
  );
}

function ImportDialog({ close, done }: { close: () => void; done: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/content-evaluation/import", { method: "POST", body: formData });
      const result = await response.json() as { inserted?: number; updated?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Import failed.");
      done(`Imported ${result.inserted || 0} new post${result.inserted === 1 ? "" : "s"}; updated ${result.updated || 0}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed."); } finally { setBusy(false); }
  }
  return (
    <Dialog onOpenChange={(open) => { if (!open) close(); }} open>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader><DialogTitle>Import Meta Business Suite</DialogTitle><DialogDescription>Posts are matched by Post ID, so re-importing updates instead of duplicating.</DialogDescription></DialogHeader>
        <form id="ce-import" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label className={s.drop}>
            <i className="ti ti-file-type-csv" aria-hidden="true" />
            <b>Choose a Meta CSV or XLSX <span className={s.req}>*</span></b>
            <span>{file ? <span className={s.files}>{file}</span> : "One export file"}</span>
            <input accept=".csv,.xlsx" aria-label="Meta export file" name="file" onChange={(e) => setFile(e.target.files?.[0]?.name || "")} required style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} type="file" />
          </label>
          {error ? <p className={s.danger} role="alert">{error}</p> : null}
        </form>
        <DialogFooter sticky><Button onClick={close} type="button" variant="ghost">Cancel</Button><Button disabled={busy || !file} form="ce-import" type="submit">{busy ? "Importing…" : "Import Meta CSV"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvaluationEditor({ record, save, remove, close }: { record: ApiRecord | null; save: (formData: FormData) => Promise<void>; remove: () => Promise<void>; close: () => void }) {
  const formId = useId();
  const [format, setFormat] = useState(String(record?.format || "Carousel"));
  const [pending, setPending] = useState(false);
  const value = (name: string) => record?.[name] === null || record?.[name] === undefined ? "" : String(record[name]);
  const numeric = (name: string, label: string) => <Field label={label} key={name}><input className={s.input} defaultValue={value(name)} min="0" name={name} step="any" type="number" /></Field>;
  // onSubmit rather than a form action, so a failed save keeps what was typed.
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const formData = new FormData(event.currentTarget); setPending(true); try { await save(formData); } catch (error) { notifyError(error, "Could not save the evaluation."); } finally { setPending(false); } }
  return (
    <Dialog onOpenChange={(open) => { if (!open) close(); }} open>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[820px]">
        <DialogHeader><DialogTitle>{record ? "Edit evaluation" : "Add evaluation"}</DialogTitle><DialogDescription>Fields marked * are required. Fill what you have — the score adapts to the metrics given.</DialogDescription></DialogHeader>
        <form className={c.editor} id={formId} onSubmit={submit}>
          <input name="account_id" type="hidden" value={value("account_id")} />
          <input name="account_username" type="hidden" value={value("account_username")} />
          <fieldset><legend>Content</legend>
            <div className={c.formGrid}>
              <Field label="Title" required><input className={s.input} defaultValue={value("judul")} name="judul" required /></Field>
              <Field label="Format"><select className={s.input} name="format" onChange={(e) => setFormat(e.target.value)} value={format}><option>Carousel</option><option>Feed Photo</option><option>Reel</option><option>Story</option></select></Field>
              <Field label="Publish date"><input className={s.input} defaultValue={day(record?.tanggal)} name="tanggal" type="date" /></Field>
              <Field label="Topic"><input className={s.input} defaultValue={value("topik")} name="topik" /></Field>
              <Field label="Post URL"><input className={s.input} defaultValue={value("url")} name="url" placeholder="https://" type="url" /></Field>
              <Field label="Post ID"><input className={s.input} defaultValue={value("post_id")} name="post_id" /></Field>
            </div>
            <Field label="Description"><textarea className={s.input} defaultValue={value("description")} name="description" rows={2} /></Field>
          </fieldset>
          <fieldset><legend>Reach</legend><div className={c.formGrid}>{numeric("followers", "Followers at posting")}{numeric("views", "Views")}{numeric("reach", "Reach")}{numeric("nf_pct", "Non-follower reach %")}{numeric("from_home", "From home")}{numeric("from_profile", "From profile")}{numeric("from_other", "From other")}{numeric("engaged", "Accounts engaged")}{numeric("profile_visits", "Profile visits")}{numeric("link_taps", "Link taps")}</div></fieldset>
          <fieldset><legend>Engagement</legend><div className={c.formGrid}>{numeric("likes", "Likes")}{numeric("comments", "Comments")}{numeric("saves", "Saves")}{numeric("shares", "Shares")}{numeric("follows", "Follows")}</div></fieldset>
          {format === "Reel" ? <fieldset><legend>Reel</legend><div className={c.formGrid}>{numeric("watchtime", "Average watch time (s)")}{numeric("wtr", "Watch-through rate %")}{numeric("duration", "Duration (s)")}{numeric("replays", "Replays")}{numeric("dropoff", "Drop-off second")}</div></fieldset> : null}
          {format === "Story" ? <fieldset><legend>Story</legend><div className={c.formGrid}>{numeric("taps_forward", "Taps forward")}{numeric("taps_back", "Taps back")}{numeric("exits", "Exits")}{numeric("replies", "Replies")}{numeric("stickers_interact", "Sticker interactions")}</div></fieldset> : null}
          <fieldset><legend>Review</legend>
            <div className={c.formGrid}>
              {numeric("hook_rating", "Hook rating (1–5)")}
              <Field label="CTA effectiveness"><select className={s.input} defaultValue={value("cta_eff")} name="cta_eff"><option value="">Not rated</option><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></select></Field>
              <Field label="Next action"><select className={s.input} defaultValue={value("action")} name="action"><option value="">None yet</option>{ACTION_VALUES.map((v) => <option key={v} value={v}>{actionLabel(v)}</option>)}</select></Field>
              <Field label="Thumbnail key or URL"><input className={s.input} defaultValue={value("thumbnail_url")} name="thumbnail_url" /></Field>
            </div>
            <div className={c.formGrid2}>
              <Field label="What worked"><textarea className={s.input} defaultValue={value("win")} name="win" rows={3} /></Field>
              <Field label="Needs improvement"><textarea className={s.input} defaultValue={value("improve")} name="improve" rows={3} /></Field>
            </div>
          </fieldset>
        </form>
        <DialogFooter sticky>
          {record ? <Button className="mr-auto" onClick={remove} type="button" variant="destructive"><i className="ti ti-trash" aria-hidden="true" /> Delete evaluation</Button> : null}
          <Button onClick={close} type="button" variant="ghost">Cancel</Button>
          <Button disabled={pending} form={formId} type="submit">{pending ? "Saving…" : "Save evaluation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className={s.field}><span>{label}{required ? <b className={s.req}> *</b> : null}</span>{children}</label>;
}

function EvaluationDetail({ item, close, edit }: { item: Scored; close: () => void; edit: () => void }) {
  const { row, score } = item;
  const story = row.format === "Story";
  const metrics: Array<[string, unknown]> = story
    ? [["Views", row.views || row.reach], ["Taps forward", row.taps_forward], ["Taps back", `${compact(row.taps_back)} (${pct(score.rates.tapsBackRate || 0)})`], ["Exits", `${compact(row.exits)} (${pct(score.rates.exitRate || 0)})`], ["Replies", row.replies], ["Link taps", row.link_taps]]
    : [["Views", row.views], ["Reach", row.reach], ["Non-follower reach", `${num(row.nf_pct)}%`], ["Likes / comments", `${compact(row.likes)} / ${compact(row.comments)}`], ["Saves", `${compact(row.saves)} (${pct(score.rates.saveRate || 0)})`], ["Shares", `${compact(row.shares)} (${pct(score.rates.shareRate || 0)})`], ["Follows", `${compact(row.follows)} (${pct(score.rates.followRate || 0)})`], ["Link taps", row.link_taps], ...(row.format === "Reel" ? [["Watch-through", `${num(row.wtr)}%`], ["Avg watch time", row.watchtime], ["Drop-off second", row.dropoff]] as Array<[string, unknown]> : [])];
  return (
    <Dialog onOpenChange={(open) => { if (!open) close(); }} open>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[860px]">
        <DialogHeader><DialogTitle>{String(row.judul || "Untitled")}</DialogTitle><DialogDescription>{String(row.format || "Unknown")} · {dateLabel(row.tanggal)}{row.topik ? ` · ${String(row.topik)}` : ""}</DialogDescription></DialogHeader>
        <div className={`${c.scoreHero} ${gradeClass(score.grade)}`}>
          <b>{score.total}</b>
          <div><strong>{GRADE[score.grade]}</strong><small>{score.partial ? "Preliminary — add the advanced metrics for a complete score." : "Complete adaptive score."}</small><span className={c.scoreBar}><i style={{ width: `${score.total}%` }} /></span></div>
          {row.action ? <span className={s.chip}>{actionLabel(row.action)}</span> : null}
        </div>
        <div className={c.detailGrid}>
          <section><h3>Metrics</h3><dl className={c.metricList}>{metrics.map(([label, v]) => <div key={label}><dt>{label}</dt><dd>{typeof v === "number" ? compact(v) : String(v || "—")}</dd></div>)}</dl></section>
          <section>
            <h3>Insights</h3>
            <ul className={c.insights}>{score.insights.map((insight, index) => <li className={insight.type === "positive" ? c.insightGood : insight.type === "warning" ? c.insightWarn : undefined} key={`${insight.text}-${index}`}><i className={`ti ti-${insight.type === "positive" ? "circle-check" : insight.type === "warning" ? "alert-triangle" : "info-circle"}`} aria-hidden="true" /><span>{insight.text}</span></li>)}</ul>
            {row.win ? <div className={c.note}><b>What worked</b><p>{String(row.win)}</p></div> : null}
            {row.improve ? <div className={c.note}><b>Needs improvement</b><p>{String(row.improve)}</p></div> : null}
          </section>
        </div>
        <DialogFooter sticky>
          {row.url ? <a className={`${s.ghost} mr-auto`} href={String(row.url)} rel="noreferrer" target="_blank"><i className="ti ti-brand-instagram" aria-hidden="true" /> Open post</a> : null}
          <Button onClick={close} type="button" variant="ghost">Close</Button>
          <Button onClick={edit} type="button"><i className="ti ti-edit" aria-hidden="true" /> Edit evaluation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
