"use client";

import { ClaudeChip, ClaudeMark } from "./claude-mark";
import type { SheetSyncState } from "@/lib/api/sheet-sync";
import { SheetSyncButton, SheetSyncDialog, syncedLine } from "./sheet-sync-control";
import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ApiRecord } from "@/lib/api/_crud";
import { distribution, filterPainPoints, labelsOf as labels, MONTH_OPTIONS, MONTH_VALUES, monthCounts, monthLabel, topKeywords, type PainFilter } from "@/lib/customer-knowledge/view";
import { settingsHref } from "@/lib/records/links";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { confirmAction, notify, notifyError } from "./app-dialog";
import { guard } from "./safe-action";
import { DistributionPie, MonthlyOpenChart } from "./charts";
import s from "./customer-knowledge-workspace.module.css";
import { Pagination, usePagination } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";
import { compareText } from "@/lib/text/sort";

// Customer Knowledge in the IJIS layout: a feed of what customers say, with the
// "what stands out" panel beside it (categories, keywords, platforms, months), and the
// Free Class survey results as their own view. Same data and actions as before.

type View = "pain" | "freeclass";

const MONTHS_SHORT = MONTH_VALUES;
const PLATFORM_ICONS: Record<string, string> = { tiktok: "ti-brand-tiktok", instagram: "ti-brand-instagram", youtube: "ti-brand-youtube", twitter: "ti-brand-x", x: "ti-brand-x", facebook: "ti-brand-facebook", threads: "ti-brand-threads", linkedin: "ti-brand-linkedin" };
const RATING_FIELDS = [
  ["materi_judul", "Content matches the webinar title/theme"],
  ["materi_kebutuhan", "Content matches my needs"],
  ["materi_mudah", "Content is easy to understand"],
  ["materi_jawab", "Content answers my questions"],
  ["nara_kuasai", "Speaker knows the material"],
  ["nara_jelas", "Speaker explains clearly"],
  ["kualitas_teknis", "Technical quality (audio, video, connection)"],
  ["waktu", "Timing is right and efficient"],
  ["moderator", "Moderator ran the session well"],
  ["info_webinar", "Webinar information is easy to find"],
  ["kepuasan", "Satisfied with the webinar"],
  ["minat", "Interested in joining CCC again"],
  ["rekomendasi", "Would recommend to friends"],
] as const;

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function meaningfulAnswer(value: unknown) { const trimmed = String(value || "").trim(); return trimmed.length >= 4 && !/^(sudah\s*(baik|oke)|tidak\s*ada|belum\s*ada|ga(k)?\s*ada|good|oke?|baik|cukup|bagus|mantap|keren|great|-)$/i.test(trimmed); }
function platformIcon(name: string) { return PLATFORM_ICONS[name.toLowerCase()] || "ti-hash"; }
const EMPTY: PainFilter = { query: "", platform: "", month: "", category: "", label: "" };

export function CustomerKnowledgeWorkspace({ rows, platforms, categories, freeClassRows, sheetSync = null }: { rows: ApiRecord[]; platforms: ApiRecord[]; categories: ApiRecord[]; freeClassRows: ApiRecord[]; sheetSync?: SheetSyncState | null }) {
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<View>("pain");
  const [modal, setModal] = useState<{ record: ApiRecord | null } | null>(null);
  const [filter, setFilter] = useState<PainFilter>(EMPTY);
  useRecordFocus((id) => {
    const record = rows.find((row) => String(row.id) === id);
    if (!record) return;
    setView("pain"); setFilter(EMPTY); setModal({ record });
    return true;
  });
  const allLabels = useMemo(() => [...new Set(rows.flatMap(labels))].sort(compareText), [rows]);
  const averageRating = useMemo(() => {
    const values = freeClassRows.flatMap((row) => RATING_FIELDS.map(([key]) => Number(row[key])).filter((value) => value >= 1 && value <= 5));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }, [freeClassRows]);

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Intelligence</span>
          <h1>Customer Knowledge</h1>
          <p>{rows.length} pain points · {freeClassRows.length} Free Class responses{averageRating ? ` · ${averageRating.toFixed(2)}/5 average` : ""}{syncedLine(sheetSync)}</p>
        </div>
        <div className={s.headActions}>
          <SheetSyncButton className={s.ghostButton} onClick={() => setSyncing(true)} sync={sheetSync} />
          <Link className={s.ghostButton} href={settingsHref("customer-knowledge")}><i className="ti ti-settings" aria-hidden="true" /> Platforms &amp; categories</Link>
          <Button onClick={() => setModal({ record: null })}><i className="ti ti-plus" aria-hidden="true" /> Add pain point</Button>
        </div>
      </header>
      {syncing ? (
        <SheetSyncDialog
          description="Comments, DMs and replies collected in a Google Sheet (by Claude through Composio, or by the team) come in here every hour."
          help="One tab with the columns Date, Platform, Category, Comment, Username, Source link, Labels, Notes (row 1). In the sheet: File → Share → Publish to web → pick that tab → Comma-separated values → copy the link."
          job="customer-knowledge" onClose={() => setSyncing(false)} placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&output=csv"
          note={<>The same comment on the same platform is added once. Platform and category must be one of these — Platforms: {platforms.map((p) => text(p.nama)).filter(Boolean).join(", ") || "none yet"}. Categories: {categories.map((c) => text(c.nama)).filter(Boolean).join(", ") || "none yet"}. Rows that do not fit are skipped and listed here.</>}
          stopMessage="New rows in the sheet will no longer come in by themselves. Pain points already here stay."
          sync={sheetSync} title="Sync the inbox sheet every hour"
        />
      ) : null}

      <div className={s.segmented} role="tablist" aria-label="Customer Knowledge view">
        <button aria-selected={view === "pain"} className={view === "pain" ? s.segmentActive : s.segment} onClick={() => setView("pain")} role="tab" type="button">Pain points <span>{rows.length}</span></button>
        <button aria-selected={view === "freeclass"} className={view === "freeclass" ? s.segmentActive : s.segment} onClick={() => setView("freeclass")} role="tab" type="button">Free Class feedback <span>{freeClassRows.length}</span></button>
      </div>

      {view === "pain" ? <PainPointsView filter={filter} onEdit={(record) => setModal({ record })} rows={rows} setFilter={setFilter} /> : null}
      {view === "freeclass" ? <FreeClassTab rows={freeClassRows} /> : null}

      {modal ? <PainPointModal allLabels={allLabels} categories={categories} onClose={() => setModal(null)} platforms={platforms} record={modal.record} /> : null}
    </div>
  );
}

/* ══════════════ PAIN POINTS: feed + "what stands out" ══════════════ */
function PainPointsView({ rows, filter, setFilter, onEdit }: { rows: ApiRecord[]; filter: PainFilter; setFilter: (next: PainFilter) => void; onEdit: (record: ApiRecord) => void }) {
  const [pending, start] = useTransition();
  const filtered = useMemo(() => filterPainPoints(rows, filter), [rows, filter]);
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);
  const set = (patch: PainFilter) => { setFilter({ ...filter, ...patch }); setPage(0); };
  const byCategory = useMemo(() => distribution(rows, "kategori"), [rows]);
  const byPlatform = useMemo(() => distribution(rows, "platform"), [rows]);
  const keywords = useMemo(() => topKeywords(rows), [rows]);
  const months = useMemo(() => monthCounts(rows), [rows]);
  const allLabels = useMemo(() => [...new Set(rows.flatMap(labels))].sort(compareText), [rows]);
  const filtersOn = Object.values(filter).some(Boolean);
  const maxCategory = byCategory[0]?.[1] || 1;

  async function remove(row: ApiRecord) {
    if (!(await confirmAction({ title: "Delete this pain point?", message: "This cannot be undone.", confirmLabel: "Delete pain point", danger: true }))) return;
    start(() => guard(async () => { await deleteManagedRecord("pain_points", String(row.id)); }, "Could not delete the pain point."));
  }

  return (
    <div className={s.board}>
      <section aria-label="Pain points" className={s.feed}>
        <div className={s.toolbar}>
          <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search pain points" onChange={(e) => set({ query: e.target.value })} placeholder="Search comments or usernames…" value={filter.query} /></label>
          <label className={s.filterPill}><span>Platform</span><select aria-label="Filter platform" onChange={(e) => set({ platform: e.target.value })} value={filter.platform}><option value="">All</option>{byPlatform.map(([v]) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className={s.filterPill}><span>Month</span><select aria-label="Filter month" onChange={(e) => set({ month: e.target.value })} value={filter.month}><option value="">All</option>{MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
          <label className={s.filterPill}><span>Category</span><select aria-label="Filter category" onChange={(e) => set({ category: e.target.value })} value={filter.category}><option value="">All</option>{byCategory.map(([v]) => <option key={v} value={v}>{v}</option>)}</select></label>
          {allLabels.length ? <label className={s.filterPill}><span>Label</span><select aria-label="Filter label" onChange={(e) => set({ label: e.target.value })} value={filter.label}><option value="">All</option>{allLabels.map((v) => <option key={v} value={v}>{v}</option>)}</select></label> : null}
          {filtersOn ? <button className={s.clear} onClick={() => set(EMPTY)} type="button">Clear filters</button> : null}
        </div>
        <p className={s.count}>{filtered.length === rows.length ? `${rows.length} pain points` : `${filtered.length} of ${rows.length} pain points`}</p>
        {pageItems.length ? (
          <ul className={s.quotes}>
            {pageItems.map((row) => {
              const platform = text(row.platform) || "Unknown"; const tags = labels(row);
              return (
                <li className={s.quote} data-record-id={String(row.id)} key={String(row.id)}>
                  <button className={s.quoteMain} data-record-open onClick={() => onEdit(row)} type="button">
                    <i className={`ti ti-quote ${s.quoteMark}`} aria-hidden="true" />
                    <span className={s.quoteText}>{text(row.komentar) || "No comment"}<ClaudeMark at={row.added_at} by={row.added_via} verb="Added" /></span>
                  </button>
                  <div className={s.quoteFoot}>
                    <span className={s.source}><i className={`ti ${platformIcon(platform)}`} aria-hidden="true" /> {platform}{text(row.username) ? ` · @${text(row.username).replace(/^@/, "")}` : ""} · {monthLabel(row.bulan) || "—"}</span>
                    <button className={filter.category === (text(row.kategori) || "Unknown") ? s.categoryOn : s.category} onClick={() => set({ category: filter.category === (text(row.kategori) || "Unknown") ? "" : text(row.kategori) || "Unknown" })} type="button">{text(row.kategori) || "Unknown"}</button>
                    {tags.length ? <span className={s.tags}>{tags.map((tag) => <span key={tag}>#{tag}</span>)}</span> : null}
                    <span className={s.quoteActions}>
                      <button aria-label="Edit pain point" className={s.iconButton} onClick={() => onEdit(row)} type="button"><i className="ti ti-pencil" aria-hidden="true" /></button>
                      <button aria-label="Delete pain point" className={s.iconDanger} disabled={pending} onClick={() => remove(row)} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className={s.empty}>{rows.length ? "No pain points match these filters." : "No pain points yet. Add the first one from a comment or a screenshot."}</p>}
        <Pagination onChange={setPage} page={page} totalPages={totalPages} />
      </section>

      <aside aria-label="What stands out" className={s.side}>
        <section className={s.panel} aria-labelledby="ck-top-categories">
          <h2 id="ck-top-categories">Top categories</h2>
          {byCategory.length ? (
            <ol className={s.ranking}>
              {byCategory.slice(0, 5).map(([name, count], index) => (
                <li key={name}>
                  <button aria-pressed={filter.category === name} className={filter.category === name ? s.rankOn : s.rank} onClick={() => set({ category: filter.category === name ? "" : name })} type="button">
                    <span className={s.rankNo}>{index + 1}</span>
                    <span className={s.rankText}><b>{name}</b><span className={s.rankBar}><i style={{ width: `${(count / maxCategory) * 100}%` }} /></span></span>
                    <span className={s.rankCount}>{count}<small>{rows.length ? ` · ${Math.round((count / rows.length) * 100)}%` : ""}</small></span>
                  </button>
                </li>
              ))}
            </ol>
          ) : <p className={s.emptySmall}>No data yet.</p>}
        </section>
        <section className={s.panel} aria-labelledby="ck-keywords">
          <h2 id="ck-keywords">Words people repeat</h2>
          {keywords.length ? (
            <div className={s.cloud}>
              {keywords.map(([word, count], index) => (
                <button className={filter.query === word ? s.wordOn : s.word} key={word} onClick={() => set({ query: filter.query === word ? "" : word })} style={{ fontSize: `${12 + Math.round(((keywords.length - index) / keywords.length) * 6)}px` }} title={`${count} comments`} type="button">{word}</button>
              ))}
            </div>
          ) : <p className={s.emptySmall}>No data yet.</p>}
        </section>
        <section className={s.panel} aria-labelledby="ck-platforms">
          <h2 id="ck-platforms">By platform</h2>
          {byPlatform.length ? (
            <ul className={s.platforms}>
              {byPlatform.map(([name, count]) => (
                <li key={name}><button aria-pressed={filter.platform === name} className={filter.platform === name ? s.platformOn : s.platform} onClick={() => set({ platform: filter.platform === name ? "" : name })} type="button"><i className={`ti ${platformIcon(name)}`} aria-hidden="true" /> <span>{name}</span><b>{count}</b></button></li>
              ))}
            </ul>
          ) : <p className={s.emptySmall}>No data yet.</p>}
        </section>
        <section className={s.panel} aria-labelledby="ck-months">
          <h2 id="ck-months">By month</h2>
          {months.some(Boolean) ? <div style={{ height: 160 }}><MonthlyOpenChart counts={months} labels={MONTH_OPTIONS.map((m) => m.label)} /></div> : <p className={s.emptySmall}>No data yet.</p>}
        </section>
      </aside>
    </div>
  );
}

/* ══════════════ ADD / EDIT MODAL ══════════════ */
async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
  return dataUrl.split(",")[1] || "";
}

function LabelPicker({ selected, allLabels, onChange }: { selected: string[]; allLabels: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const available = allLabels.filter((value) => !selected.includes(value));

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange([...selected, trimmed]);
  }
  function commitDraft() { add(draft); setDraft(""); setCreating(false); setOpen(false); }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-md)] bg-[var(--bg)] p-2">
        {selected.map((value) => { return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--purple-light)] px-2 py-0.5 text-xs font-medium text-[var(--purple-dark)]" key={value}>
            {value}
            <button aria-label={`Remove label ${value}`} onClick={() => onChange(selected.filter((item) => item !== value))} type="button"><i className="ti ti-x" style={{ fontSize: 12 }} /></button>
          </span>
        ); })}
        <button aria-expanded={open} className="text-[12px] text-muted-foreground" onClick={() => setOpen((value) => !value)} type="button">Add label <i className="ti ti-chevron-down" style={{ fontSize: 12 }} /></button>
      </div>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-[180px] w-full min-w-[200px] overflow-y-auto rounded-lg border border-border bg-[var(--white)] p-2 shadow-md">
          {available.map((value) => <button className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-[var(--bg)]" key={value} onClick={() => { add(value); setOpen(false); }} type="button">{value}</button>)}
          {!available.length && !creating ? <p className="px-2 py-1 text-xs text-muted-foreground">No other labels</p> : null}
          {creating ? (
            <div className="flex gap-1 p-1">
              <input autoFocus className="h-7 flex-1 rounded border border-border px-2 text-xs" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") commitDraft(); }} placeholder="New label name…" value={draft} />
              <button className="rounded bg-[var(--purple-mid)] px-2 text-xs text-[var(--on-accent)]" onClick={commitDraft} type="button">Add label</button>
            </div>
          ) : (
            <button className="mt-1 block w-full rounded px-2 py-1 text-left text-xs text-[var(--purple-mid)] hover:bg-[var(--bg)]" onClick={() => setCreating(true)} type="button">+ New label</button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PainPointModal({ record, platforms, categories, allLabels, onClose }: { record: ApiRecord | null; platforms: ApiRecord[]; categories: ApiRecord[]; allLabels: string[]; onClose: () => void }) {
  const platformNames = useMemo(() => platforms.map((row) => text(row.nama)).filter(Boolean), [platforms]);
  const categoryNames = useMemo(() => categories.map((row) => text(row.nama)).filter(Boolean), [categories]);
  const [komentar, setKomentar] = useState(text(record?.komentar));
  const [platform, setPlatform] = useState(text(record?.platform) || platformNames[0] || "");
  const [bulan, setBulan] = useState(text(record?.bulan) || MONTHS_SHORT[new Date().getMonth()]);
  const [kategori, setKategori] = useState(text(record?.kategori) || categoryNames[0] || "");
  const [selectedLabels, setSelectedLabels] = useState<string[]>(record ? labels(record) : []);
  const [pending, start] = useTransition();
  const [aiStatus, setAiStatus] = useState("Drop, paste or upload a screenshot and AI fills the form.");
  const [commentInvalid, setCommentInvalid] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  async function parseScreenshot(file: File) {
    if (!file.type.startsWith("image/")) { setAiStatus("Only image files are supported."); return; }
    setAiStatus("Reading the screenshot…");
    try {
      const response = await fetch("/api/ai/parse-screenshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: await fileToBase64(file), mediaType: file.type, categories: categoryNames }) });
      const payload = await response.json() as { komentar?: string; platform?: string; kategori?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not read the screenshot.");
      if (payload.komentar) setKomentar(payload.komentar);
      if (payload.platform) { const match = platformNames.find((value) => value.toLowerCase() === payload.platform!.toLowerCase()); if (match) setPlatform(match); }
      if (payload.kategori) { const match = categoryNames.find((value) => value.toLowerCase() === payload.kategori!.toLowerCase()); if (match) setKategori(match); }
      setAiStatus("Done. Check and complete the fields below.");
    } catch (error) { setAiStatus(error instanceof Error ? error.message : "Could not read the screenshot."); }
  }

  function save() {
    if (!komentar.trim()) { setCommentInvalid(true); commentRef.current?.focus(); notify("Comment is required.", "error"); return; }
    const formData = new FormData();
    formData.set("komentar", komentar.trim());
    formData.set("platform", platform);
    formData.set("bulan", bulan);
    formData.set("kategori", kategori);
    formData.set("username", text(record?.username));
    formData.set("source_url", text(record?.source_url));
    formData.set("notes", text(record?.notes));
    formData.set("labels", JSON.stringify(selectedLabels));
    start(async () => {
      try {
        if (record) await updateManagedRecord("pain_points", String(record.id), formData);
        else await createManagedRecord("pain_points", formData);
        onClose();
      } catch (error) { notifyError(error, "Could not save pain point."); }
    });
  }

  const inputClass = "min-h-[38px] w-full rounded-[10px] border border-[var(--border-md)] bg-[var(--white)] px-3 py-2 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-hint)] focus:border-[var(--purple-mid)] focus:ring-[3px] focus:ring-[var(--purple-light)]";
  const labelClass = "mb-1.5 block text-[13px] font-semibold leading-tight text-[var(--text)]";

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose(); }} open>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]" showCloseButton={false}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0"><DialogTitle>{record ? "Edit pain point" : "Add pain point"}</DialogTitle><DialogDescription className="text-xs">Fields marked * are required.</DialogDescription>{record?.added_via ? <div className="mt-2"><ClaudeChip at={record.added_at} by={record.added_via} verb="Added" /></div> : null}</div>
          <button aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-[var(--bg)] hover:text-foreground" onClick={onClose} type="button"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="flex flex-col gap-3.5 overflow-y-auto p-5">
          {!record ? (
            <div className="rounded-lg border border-dashed border-[var(--border-md)] p-3 text-center" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const image = Array.from(event.dataTransfer.files).find((file) => file.type.startsWith("image/")); if (image) void parseScreenshot(image); }} onPaste={(event) => { const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/")); if (image) { event.preventDefault(); void parseScreenshot(image); } }} tabIndex={0}>
              <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--purple-mid)]" onClick={() => inputRef.current?.click()} type="button"><i className="ti ti-camera" /> Upload or paste a screenshot (Ctrl+V)</button>
              <input accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseScreenshot(file); }} ref={inputRef} type="file" />
              <p className="mt-1 text-xs text-muted-foreground">{aiStatus}</p>
            </div>
          ) : null}
          <label className="block"><span className={labelClass}>Comment or discussion <span aria-hidden="true" className="text-[var(--red)]">*</span></span><textarea aria-invalid={commentInvalid || undefined} required className={commentInvalid ? `${inputClass} border-[var(--red)] ring-2 ring-[var(--red-bg)]` : inputClass} onChange={(event) => { setKomentar(event.target.value); if (commentInvalid) setCommentInvalid(false); }} placeholder="Paste a comment from TikTok, IG, X…" ref={commentRef} rows={3} value={komentar} /></label>
          <div className="grid grid-cols-3 gap-2.5">
            <label className="block"><span className={labelClass}>Platform <span aria-hidden="true" className="text-[var(--red)]">*</span></span><select className={inputClass} onChange={(event) => setPlatform(event.target.value)} value={platform}>{platformNames.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="block"><span className={labelClass}>Month <span aria-hidden="true" className="text-[var(--red)]">*</span></span><select className={inputClass} onChange={(event) => setBulan(event.target.value)} value={bulan}>{MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
            <label className="block"><span className={labelClass}>Category <span aria-hidden="true" className="text-[var(--red)]">*</span></span><select className={inputClass} onChange={(event) => setKategori(event.target.value)} value={kategori}>{categoryNames.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <div><span className={labelClass}>Labels</span><LabelPicker allLabels={allLabels} onChange={setSelectedLabels} selected={selectedLabels} /></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
          <Button disabled={pending} onClick={save} type="button">{pending ? "Saving…" : (record ? "Save pain point" : "Add pain point")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════ FREE CLASS FEEDBACK ══════════════ */
function FreeClassTab({ rows }: { rows: ApiRecord[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<"ditingkatkan" | "hal_baik" | "topik_keinginan">("ditingkatkan");
  const { pageItems, page, setPage, totalPages } = usePagination(rows, 15);

  const analytics = useMemo(() => {
    const ratings = RATING_FIELDS.map(([key, label]) => {
      const values = rows.map((row) => Number(row[key])).filter((value) => value >= 1 && value <= 5);
      const dist = [1, 2, 3, 4, 5].map((star) => values.filter((value) => Math.round(value) === star).length);
      return { key, label, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0, count: values.length, dist };
    }).filter((item) => item.count).sort((a, b) => a.average - b.average);
    const overall = ratings.length ? ratings.reduce((sum, item) => sum + item.average, 0) / ratings.length : 0;
    return { ratings, overall, series: distribution(rows, "seri"), universities: distribution(rows, "universitas"), cohorts: distribution(rows, "angkatan") };
  }, [rows]);

  async function importRows(formData: FormData) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/free-class/import", { method: "POST", body: formData });
      const result = await response.json() as { imported?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Import failed.");
      setMessage(`${result.imported || 0} responses saved.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); }
    finally { setBusy(false); }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `free-class-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!rows.length) {
    return (
      <section className={s.emptyCard} aria-label="Free Class feedback">
        <i className="ti ti-chart-dots" aria-hidden="true" />
        <div><b>No responses yet</b><span>Upload the CSV exported from Google Sheets, or import its published link.</span></div>
        <ImportPanel busy={busy} message={message} onImport={importRows} />
      </section>
    );
  }

  const openSets: Array<[typeof answers, string]> = [["ditingkatkan", "To improve"], ["hal_baik", "What went well"], ["topik_keinginan", "Topics wanted"]];
  const shown = rows.filter((row) => meaningfulAnswer(row[answers]));

  return (
    <section aria-label="Free Class feedback" className={s.freeClass}>
      <div className={s.toolbar}>
        <ImportPanel busy={busy} message={message} onImport={importRows} />
        <span className={s.spacer} />
        <button className={s.ghostButton} onClick={exportJson} type="button"><i className="ti ti-download" aria-hidden="true" /> Export JSON</button>
      </div>
      <div className={s.fcGrid}>
        <div className={s.scoreCard}>
          <span>Overall score</span>
          <b>{analytics.overall.toFixed(2)}<small> / 5</small></b>
          <div className={s.scoreBar}><i style={{ width: `${(analytics.overall / 5) * 100}%` }} /></div>
          <p>{rows.length} responses · {analytics.series.length} series</p>
        </div>
        <section className={s.panel} aria-labelledby="fc-ratings">
          <h2 id="fc-ratings">Rating per aspect <small>lowest first</small></h2>
          <ul className={s.ratings}>
            {analytics.ratings.map((item) => (
              <li key={item.key}>
                <span className={s.ratingLabel}>{item.label}{item.count < rows.length ? <small> n={item.count}</small> : null}</span>
                <span className={s.ratingBar} title={item.dist.map((count, index) => `${index + 1}★ ${count}`).join(" · ")}><i style={{ width: `${(item.average / 5) * 100}%` }} /></span>
                <b>{item.average.toFixed(2)}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className={s.distGrid}>
        <Distribution rows={analytics.series} title="Responses per series" />
        <Distribution rows={analytics.universities} title="Top universities" />
        <Distribution rows={analytics.cohorts} title="Class year" />
      </div>
      <section className={s.panel} aria-labelledby="fc-answers">
        <div className={s.panelHead}>
          <h2 id="fc-answers">In their words</h2>
          <div className={s.subTabs} role="tablist" aria-label="Open answers">
            {openSets.map(([id, label]) => <button aria-selected={answers === id} className={answers === id ? s.subTabOn : s.subTab} key={id} onClick={() => setAnswers(id)} role="tab" type="button">{label} <span>{rows.filter((row) => meaningfulAnswer(row[id])).length}</span></button>)}
          </div>
        </div>
        {shown.length ? (
          <ul className={s.answerGrid}>
            {shown.map((row) => (
              <li key={String(row.id)}><p>{text(row[answers])}</p><small>{text(row.nama) || text(row.email) || "Anonymous"}{text(row.seri) ? ` · ${text(row.seri)}` : ""}</small></li>
            ))}
          </ul>
        ) : <p className={s.emptySmall}>No answers for this question yet.</p>}
      </section>
      <details className={s.respondents}>
        <summary><i className="ti ti-users" aria-hidden="true" /> Respondents ({rows.length})</summary>
        <div className={s.tableWrap}>
          <table>
            <thead><tr><th>Email</th><th>Name</th><th>University</th><th>Class year</th><th>Series</th></tr></thead>
            <tbody>{pageItems.map((row) => <tr key={String(row.id)}><td>{text(row.email) || "—"}</td><td>{text(row.nama) || "—"}</td><td>{text(row.universitas) || "—"}</td><td>{text(row.angkatan) || "—"}</td><td>{text(row.seri) || "—"}</td></tr>)}</tbody>
          </table>
        </div>
        <Pagination onChange={setPage} page={page} totalPages={totalPages} />
      </details>
    </section>
  );
}

function ImportPanel({ busy, message, onImport }: { busy: boolean; message: string; onImport: (formData: FormData) => void }) {
  const [showUrl, setShowUrl] = useState(false);
  return (
    <div className={s.importRow}>
      <form action={onImport}>
        <label className={s.ghostButton}><i className="ti ti-upload" aria-hidden="true" /> Import CSV or Excel<input accept=".csv,.xlsx" className="sr-only" name="file" onChange={(event) => event.currentTarget.form?.requestSubmit()} type="file" /></label>
      </form>
      <button aria-expanded={showUrl} className={s.ghostButton} onClick={() => setShowUrl((value) => !value)} type="button"><i className="ti ti-link" aria-hidden="true" /> Import from link</button>
      {showUrl ? (
        <form action={onImport} className={s.importRow}>
          <label className={s.search}><span className="sr-only">Published sheet link</span><input name="url" placeholder="https://docs.google.com/.../pub?output=csv" required type="url" /></label>
          <Button disabled={busy} type="submit"><i className="ti ti-download" aria-hidden="true" /> Import responses</Button>
        </form>
      ) : null}
      {message ? <span className={s.message} role="status">{message}</span> : null}
    </div>
  );
}

function Distribution({ title, rows }: { title: string; rows: [string, number][] }) {
  return <section className={s.panel} aria-label={title}><h2>{title}</h2>{rows.length ? <DistributionPie rows={rows} /> : <p className={s.emptySmall}>No data yet.</p>}</section>;
}

