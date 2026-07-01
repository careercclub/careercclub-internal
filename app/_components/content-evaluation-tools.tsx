"use client";

import { evaluateContentEvaluation, type ContentEvaluationResult } from "@/lib/analytics/content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { FilterBar, Pill, StatCard, StatsGrid, filterFieldClass } from "./ui-kit";

type Tab = "overview" | "reel" | "feed" | "story-buyer";
type Scored = { row: ApiRecord; score: ContentEvaluationResult };
const GRADE_TONE: Record<ContentEvaluationResult["grade"], "green" | "teal" | "amber" | "gray"> = { top: "green", good: "teal", avg: "amber", low: "gray" };

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
  // Calendar and monthly trends browse independently of the Range filter — a range that trims to
  // the last 30 days would otherwise hide months the calendar/trend charts are meant to page through.
  const allScored = useMemo(() => evaluations.map((row) => ({ row, score: evaluateContentEvaluation(row) })), [evaluations]);
  const scored = useMemo(() => (cutoff ? allScored.filter(({ row }) => day(row.tanggal) >= cutoff) : allScored), [allScored, cutoff]);
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
    allScored.forEach(({ row, score }) => { const key = monthKey(row.tanggal); if (!key) return; const item = grouped.get(key) || { top: 0, follows: 0, links: 0 }; if (score.grade === "top") item.top += 1; item.follows += number(row.follows); item.links += number(row.link_taps); grouped.set(key, item); });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  }, [allScored]);
  const calendarDays = useMemo(() => { const start = new Date(calendarMonth); start.setDate(1 - start.getDay()); return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; }); }, [calendarMonth]);
  const storyBuyers = useMemo(() => buyers.filter((row) => row.sumber === "Instagram Story" && (!cutoff || day(row.tanggal) >= cutoff)), [buyers, cutoff]);

  async function importMeta(formData: FormData) {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/content-evaluation/import", { method: "POST", body: formData }); const result = await response.json() as { inserted?: number; updated?: number; error?: string }; if (!response.ok) throw new Error(result.error || "Import failed."); setMessage(`Imported ${result.inserted || 0} new post(s); updated ${result.updated || 0}.`); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tabs onValueChange={(value) => setTab(value as Tab)} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reel">Reels</TabsTrigger>
            <TabsTrigger value="feed">Feed &amp; Carousel</TabsTrigger>
            <TabsTrigger value="story-buyer">Story vs Buyer</TabsTrigger>
          </TabsList>
        </Tabs>
        <details className="rounded-lg border border-border bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-[var(--purple-dark)]"><i className="ti ti-file-import" /> Import Meta CSV/XLSX</summary>
          <form action={importMeta} className="flex items-center gap-2 p-3">
            <input accept=".csv,.xlsx" className="text-xs" name="file" required type="file" />
            <Button disabled={busy} size="sm" type="submit">Import</Button>
          </form>
        </details>
      </div>
      {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}
      <FilterBar className="mb-0">
        <span className="text-[11px] font-semibold text-muted-foreground">Range</span>
        {[["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["all", "All"]].map(([value, label]) => <Button key={value} onClick={() => setRange(value)} size="sm" variant={range === value ? "default" : "outline"}>{label}</Button>)}
      </FilterBar>
      {tab === "overview" ? (
        <>
          <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
            <StatCard label="Total content" value={scored.length} />
            <StatCard label="Average score" value={average} />
            <StatCard label="Top reels" value={scored.filter((item) => item.row.format === "Reel" && item.score.grade === "top").length} />
            <StatCard label="Top feed" value={scored.filter((item) => ["Carousel", "Feed Photo"].includes(String(item.row.format)) && item.score.grade === "top").length} />
            <StatCard label="Top stories" value={scored.filter((item) => item.row.format === "Story" && item.score.grade === "top").length} />
          </StatsGrid>
          <div className="grid gap-3 md:grid-cols-3">
            <Trend rows={months.map(([label, value]) => ({ label, value: value.top }))} title="Top performers / month" />
            <Trend rows={months.map(([label, value]) => ({ label, value: value.follows }))} title="Follows / month" />
            <Trend rows={months.map(([label, value]) => ({ label, value: value.links }))} title="Link taps / month" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Top content</h2>
            <FilterBar className="mb-0">{[["combined", "Follows + links"], ["follows", "Follows"], ["link", "Link taps"]].map(([value, label]) => <Button key={value} onClick={() => setSort(value)} size="sm" variant={sort === value ? "default" : "outline"}>{label}</Button>)}</FilterBar>
          </div>
          <ContentCards items={visible.slice(0, 6)} onSelect={setSelected} />
          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <div><h2 className="text-sm font-bold">Posting calendar</h2><span className="text-[11px] text-muted-foreground">{calendarMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</span></div>
              <div className="flex gap-1.5">
                <Button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} size="icon-sm" variant="outline"><i className="ti ti-chevron-left" /></Button>
                <Button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} size="icon-sm" variant="outline"><i className="ti ti-chevron-right" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 overflow-x-auto">
              {calendarDays.map((date) => {
                const key = date.toISOString().slice(0, 10);
                const posts = allScored.filter((item) => day(item.row.tanggal) === key);
                return (
                  <section className={cn("min-h-[85px] rounded-md border border-border p-1", date.getMonth() !== calendarMonth.getMonth() && "bg-[var(--bg)] opacity-50")} key={key}>
                    <header className="mb-1 text-[9px] text-muted-foreground">{date.getDate()}</header>
                    {posts.slice(0, 3).map((item) => <button className="mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[8px] text-[#1d4ed8]" key={String(item.row.id)} onClick={() => setSelected(item)} style={{ background: "#dbeafe" }} type="button">{String(item.row.format)}: {String(item.row.judul || "Untitled")}</button>)}
                    {posts.length > 3 ? <small className="text-[8px] text-muted-foreground">+{posts.length - 3} more</small> : null}
                  </section>
                );
              })}
            </div>
          </Card>
          <details className="rounded-lg border border-border bg-white">
            <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-bold text-[var(--purple-dark)]"><i className="ti ti-settings" /> Add, edit, and top-up metrics</summary>
            <div className="p-3.5">{management}</div>
          </details>
        </>
      ) : null}
      {tab === "reel" || tab === "feed" ? (
        <>
          <FilterBar>
            <input className={cn(filterFieldClass, "max-w-none flex-1")} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or topic" value={query} />
            <select className={filterFieldClass} onChange={(event) => setGrade(event.target.value)} value={grade}><option value="">All grades</option><option value="top">Top Performer</option><option value="good">Performing Well</option><option value="avg">Average</option><option value="low">Needs Improvement</option></select>
            <select className={filterFieldClass} onChange={(event) => setAction(event.target.value)} value={action}><option value="">All actions</option><option>Boost ke Meta Ads</option><option>Jadiin template konten serupa</option><option>Repurpose jadi format lain</option><option>Archive</option></select>
            <select className={filterFieldClass} onChange={(event) => setSort(event.target.value)} value={sort}><option value="combined">Follows + links</option><option value="date">Newest</option><option value="follows">Follows</option><option value="link">Link taps</option></select>
          </FilterBar>
          <ContentTable items={visible} onSelect={setSelected} />
        </>
      ) : null}
      {tab === "story-buyer" ? <StoryBuyer buyers={storyBuyers} items={visible} onSelect={setSelected} totalBuyers={buyers.length} /> : null}
      {selected ? <EvaluationDetail item={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function Trend({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return (
    <Card className="gap-2 p-4">
      <h3 className="text-xs font-bold">{title}</h3>
      {rows.length ? rows.map((row) => <div className="grid grid-cols-[60px_minmax(0,1fr)_44px] items-center gap-2 text-[10px]" key={row.label}><span className="text-muted-foreground">{row.label}</span><i className="block h-2 min-w-[2px] rounded bg-[var(--purple-mid)]" style={{ width: `${Math.max(2, row.value / maximum * 100)}%` }} /><strong className="text-right">{compact(row.value)}</strong></div>) : <p className="text-[11px] text-muted-foreground">No dated content in this range.</p>}
    </Card>
  );
}

function ContentCards({ items, onSelect }: { items: Scored[]; onSelect: (item: Scored) => void }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <button className="grid gap-2 rounded-lg border border-border bg-white p-3 text-left" key={String(item.row.id)} onClick={() => onSelect(item)} type="button">
          <div className="flex items-start gap-2">
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[var(--purple-light)] text-[9px] font-bold text-[var(--purple-dark)]">{index + 1}</span>
            <strong className="line-clamp-2 flex-1 text-[11px] font-semibold">{String(item.row.judul || "Untitled")}</strong>
            <ScoreBadge score={item.score} />
          </div>
          <div className="flex flex-wrap gap-1"><Pill tone="purple">{String(item.row.format || "Unknown")}</Pill>{item.score.partial ? <Pill tone="amber">Preliminary</Pill> : null}</div>
          <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground"><span>{compact(item.row.follows)} follows</span><span>{compact(item.row.link_taps)} link taps</span><span>{compact(item.row.reach || item.row.views)} reach</span></div>
        </button>
      ))}
    </div>
  );
}

function ContentTable({ items, onSelect }: { items: Scored[]; onSelect: (item: Scored) => void }) {
  return (
    <Card className="p-0">
      <Table>
        <TableHeader><TableRow><TableHead>Content</TableHead><TableHead>Score</TableHead><TableHead>Reach</TableHead><TableHead>Save rate</TableHead><TableHead>Follows</TableHead><TableHead>Link taps</TableHead><TableHead>NF reach / WTR</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow className="cursor-pointer" key={String(item.row.id)} onClick={() => onSelect(item)}>
              <TableCell className="whitespace-normal"><strong className="block">{String(item.row.judul || "Untitled")}</strong><span className="text-muted-foreground">{day(item.row.tanggal)} &middot; {String(item.row.format)}</span></TableCell>
              <TableCell><ScoreBadge score={item.score} /></TableCell>
              <TableCell>{compact(item.row.reach)}</TableCell>
              <TableCell>{percent(item.score.rates.saveRate || 0)}</TableCell>
              <TableCell>{compact(item.row.follows)}</TableCell>
              <TableCell>{compact(item.row.link_taps)}</TableCell>
              <TableCell>{item.row.format === "Reel" ? `${number(item.row.nf_pct)}% / ${number(item.row.wtr)}%` : `${number(item.row.nf_pct)}%`}</TableCell>
              <TableCell className="whitespace-normal">{String(item.row.action || "-")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function StoryBuyer({ items, buyers, totalBuyers, onSelect }: { items: Scored[]; buyers: ApiRecord[]; totalBuyers: number; onSelect: (item: Scored) => void }) {
  const dates = [...new Set([...items.map((item) => day(item.row.tanggal)), ...buyers.map((row) => day(row.tanggal))].filter(Boolean))].sort().reverse();
  return (
    <>
      <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
        <StatCard label="Total buyers" value={totalBuyers} />
        <StatCard label="IG Story buyers" value={buyers.length} />
        <StatCard label="Source share" value={totalBuyers ? percent(buyers.length / totalBuyers * 100) : "0.0%"} />
        <StatCard label="Stories reviewed" value={items.length} />
        <StatCard label="Matched days" value={dates.filter((date) => items.some((item) => day(item.row.tanggal) === date) && buyers.some((row) => day(row.tanggal) === date)).length} />
      </StatsGrid>
      <div className="grid gap-2">
        {dates.map((date) => {
          const posts = items.filter((item) => day(item.row.tanggal) === date);
          const count = buyers.filter((row) => day(row.tanggal) === date).length;
          return (
            <Card className="grid grid-cols-[100px_1fr_1fr] items-center gap-2.5 p-3 text-[11px]" key={date}>
              <strong>{date}</strong>
              <span className="text-muted-foreground">{count} buyer(s)</span>
              <span className="flex flex-wrap gap-1.5">{posts.length ? posts.map((item) => <button className="text-left text-[var(--purple-mid)]" key={String(item.row.id)} onClick={() => onSelect(item)} type="button"><strong className="block">{String(item.row.judul)}</strong><span className="text-[10px]">{item.score.total}/100</span></button>) : "No Story recorded"}</span>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function ScoreBadge({ score }: { score: ContentEvaluationResult }) { return <Pill tone={GRADE_TONE[score.grade]}>{score.total}/100</Pill>; }

function EvaluationDetail({ item, onClose }: { item: Scored; onClose: () => void }) {
  const { row, score } = item;
  const story = row.format === "Story";
  const metrics = story ? [["Views", row.views || row.reach], ["Taps forward", row.taps_forward], ["Taps back", `${compact(row.taps_back)} (${percent(score.rates.tapsBackRate || 0)})`], ["Exits", `${compact(row.exits)} (${percent(score.rates.exitRate || 0)})`], ["Replies", `${compact(row.replies)} (${percent(score.rates.replyRate || 0)})`], ["Link taps", row.link_taps], ["Sticker interactions", row.stickers_interact]] : [["Views", row.views], ["Reach", row.reach], ["Non-follower reach", `${number(row.nf_pct)}%`], ["Likes / comments", `${compact(row.likes)} / ${compact(row.comments)}`], ["Saves", `${compact(row.saves)} (${percent(score.rates.saveRate || 0)})`], ["Shares", `${compact(row.shares)} (${percent(score.rates.shareRate || 0)})`], ["Follows", `${compact(row.follows)} (${percent(score.rates.followRate || 0)})`], ["Link taps", row.link_taps], ...(row.format === "Reel" ? [["WTR", `${number(row.wtr)}%`], ["Avg watch time", row.watchtime], ["Drop-off second", row.dropoff], ["Replays", row.replays]] : [])];
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-5" onMouseDown={onClose}>
      <Card className="w-full max-w-3xl gap-3 p-4.5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div><span className="text-[10px] text-muted-foreground">{String(row.format)} &middot; {day(row.tanggal)}</span><h2 className="text-lg font-bold">{String(row.judul || "Untitled")}</h2><p className="text-[11px] text-muted-foreground">{String(row.topik || "No topic")}</p></div>
          <button onClick={onClose} type="button"><i className="ti ti-x" /></button>
        </div>
        <div className="grid grid-cols-[auto_minmax(180px,1fr)] items-center gap-4 rounded-lg bg-[var(--bg)] p-3.5">
          <div><strong className="text-[34px] leading-none font-bold text-[var(--purple-dark)]">{score.total}</strong><div className="text-[11px] font-bold">{gradeLabel(score.grade)}</div>{score.partial ? <small className="text-[9px] text-muted-foreground">Preliminary score: complete the missing advanced metrics.</small> : <small className="text-[9px] text-muted-foreground">Complete adaptive score.</small>}</div>
          <progress className="w-full" max="100" value={score.total} />
        </div>
        <div className="grid gap-3.5 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-[10px] font-bold tracking-wide uppercase">Full metrics</h3>
            {metrics.map(([label, value]) => <div className="flex justify-between gap-2 border-b border-border py-1.5 text-[10px]" key={String(label)}><span className="text-muted-foreground">{label}</span><strong>{typeof value === "number" ? compact(value) : String(value || "-")}</strong></div>)}
          </section>
          <section>
            <h3 className="mb-2 text-[10px] font-bold tracking-wide uppercase">Automatic insights</h3>
            {score.insights.map((insight, index) => <div className="grid grid-cols-[7px_minmax(0,1fr)] items-start gap-2 border-b border-border py-1.5 text-[10px] text-muted-foreground" key={`${insight.text}-${index}`}><i className="mt-1 h-1.5 w-1.5 rounded-full" style={{ background: insight.type === "positive" ? "var(--green)" : insight.type === "warning" ? "var(--amber)" : "var(--text-hint)" }} /><span>{insight.text}</span></div>)}
            {row.win ? <aside className="mt-2 rounded-lg bg-[var(--bg)] p-2"><strong className="text-[9px] uppercase">What worked</strong><p className="mt-1 text-[10px] text-muted-foreground">{String(row.win)}</p></aside> : null}
            {row.improve ? <aside className="mt-2 rounded-lg bg-[var(--bg)] p-2"><strong className="text-[9px] uppercase">Needs improvement</strong><p className="mt-1 text-[10px] text-muted-foreground">{String(row.improve)}</p></aside> : null}
            {row.url ? <Button asChild className="mt-2" size="sm" variant="outline"><a href={String(row.url)} rel="noreferrer" target="_blank"><i className="ti ti-brand-instagram" /> Open post</a></Button> : null}
          </section>
        </div>
      </Card>
    </div>
  );
}
