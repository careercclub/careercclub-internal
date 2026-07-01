"use client";

import {
  addContentLinkAction,
  addStoryItemAction,
  createCarouselPlanAction,
  createCtaAction,
  createKolAction,
  createMtStoryAction,
  createStoryDateAction,
  deleteCarouselPlanAction,
  deleteContentLinkAction,
  deleteKolAction,
  deleteMtStoryAction,
  deleteStoryDateAction,
  deleteStoryItemAction,
  setCarouselDateAction,
  setCarouselLinkBriefAction,
  setCarouselStatusAction,
  setMtPostedAction,
  setStoryPlanStatusAction,
  updateCarouselPlanAction,
  updateKolAction,
  updateMtStoryAction,
  updateStoryItemAction,
  type CarouselPlanInput,
  type KolInput,
  type MtStoryInput,
} from "@/app/actions/content-planning-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import styles from "./content-planning.module.css";

/* ── Helpers ── */
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function localIso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function dateKey(value: unknown) { if (!value) return ""; return value instanceof Date ? localIso(value) : String(value).slice(0, 10); }
function fmtDt(value: unknown) { const key = dateKey(value); if (!key) return ""; const [y, m, d] = key.split("-").map(Number); return `${d} ${MONTHS_SHORT[m - 1]} ${y}`; }
function todayKey() { return localIso(new Date()); }

function startOfWeek(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function weekLabel(ws: Date) {
  const firstWeekStart = startOfWeek(localIso(new Date(ws.getFullYear(), ws.getMonth(), 1)));
  const weekNum = Math.floor((ws.getTime() - firstWeekStart.getTime()) / (7 * 86400000)) + 1;
  return `Minggu ${weekNum} ${MONTHS[ws.getMonth()]}`;
}
function weekRange(ws: Date) {
  const end = new Date(ws);
  end.setDate(end.getDate() + 6);
  return `${ws.getDate()} ${MONTHS_SHORT[ws.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
}
function initials(name: string) { return name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?"; }
function fmtFollowers(n: number) { if (!n) return ""; if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`; if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`; return String(n); }

const FUNNEL_COLORS: Record<string, { bg: string; fg: string }> = {
  TOFU: { bg: "#e8f0fc", fg: "#0f52ba" },
  MOFU: { bg: "#fef3c7", fg: "#854f0b" },
  BOFU: { bg: "#d1fae5", fg: "#3b6d11" },
};
const STATUS_BORDER: Record<string, string> = { Draft: "#888780", Done: "#3b6d11" };

type Tab = "carousel" | "story" | "kol" | "mt";

/* ── Shared UI ── */
function Modal({ size, title, onClose, children, footer }: { size?: "sm" | "md"; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const sizeClass = size === "sm" ? styles.modalSm : size === "md" ? styles.modalMd : "";
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${sizeClass}`} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{title}</div>
          <button className={`${styles.btn} ${styles.btnSm} ${styles.btnIcon}`} onClick={onClose} type="button" aria-label="Tutup"><i className="ti ti-x" /></button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer ? <div className={styles.modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}{optional ? <span className={styles.optional}> (opsional)</span> : null}</span>
      {children}
    </label>
  );
}

/* Circular avatar that resolves R2 object keys (or uses http URLs / initials). */
function Avatar({ url, name }: { url: string; name: string }) {
  const [src, setSrc] = useState(url.startsWith("http") ? url : "");
  useEffect(() => {
    if (!url || url.startsWith("http")) { setSrc(url.startsWith("http") ? url : ""); return; }
    const controller = new AbortController();
    fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "download", key: url }), signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("unavailable"))))
      .then((result: { url?: string }) => setSrc(result.url || ""))
      .catch(() => { if (!controller.signal.aborted) setSrc(""); });
    return () => controller.abort();
  }, [url]);
  if (src) return <div className={styles.avatar} role="img" aria-label={name} style={{ backgroundImage: `url("${src.replaceAll('"', "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" }} />;
  return <div className={styles.avatarFallback}>{initials(name)}</div>;
}

/* ── Custom date picker (matches legacy _cpBuildDatePicker) ── */
function DatePicker({ selected, statusMap, onPick, withCount }: { selected: string; statusMap: Record<string, string[]>; onPick: (date: string) => void; withCount?: boolean }) {
  const initial = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : todayKey();
  const [view, setView] = useState(() => { const [y, m] = initial.split("-").map(Number); return { y, m: m - 1 }; });
  const first = new Date(view.y, view.m, 1).getDay();
  const total = new Date(view.y, view.m + 1, 0).getDate();
  const today = todayKey();
  const cells: ReactNode[] = [];
  for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= total; d++) {
    const key = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const statuses = statusMap[key] || [];
    const draft = statuses.filter((s) => s !== "Done").length;
    const done = statuses.filter((s) => s === "Done").length;
    const count = statuses.length;
    const isSelected = key === selected;
    const isToday = key === today;
    const style: React.CSSProperties = { border: isToday && !isSelected ? "1.5px solid #0f52ba" : "none", fontWeight: isSelected || isToday ? 500 : 400 };
    let badge: ReactNode = null;
    let split = false;
    if (isSelected) { style.background = "#0f52ba"; style.color = "#fff"; }
    else if (withCount && count >= 3) { style.background = "#e6f1fb"; style.color = "#0c447c"; badge = <span style={{ position: "absolute", top: 1, right: 2, fontSize: 9, fontWeight: 600, color: "#0c447c" }}>{count}</span>; }
    else if (draft > 0 && done > 0) { style.color = "#444441"; split = true; }
    else if (draft > 0) { style.background = "#fcebeb"; style.color = "#791f1f"; }
    else if (done > 0) { style.background = "#eaf3de"; style.color = "#27500a"; }
    cells.push(
      <button key={key} type="button" className={styles.pickerDay} style={style} onClick={() => onPick(key)}>
        {split ? <span style={{ position: "absolute", inset: 0, borderRadius: 6, overflow: "hidden" }}><span style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", background: "#fcebeb" }} /><span style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "100%", background: "#eaf3de" }} /></span> : null}
        {badge}
        <span>{d}</span>
      </button>,
    );
  }
  return (
    <div className={styles.picker}>
      <div className={styles.pickerTop}>
        <button type="button" className={styles.pickerNavBtn} onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}><i className="ti ti-chevron-left" style={{ fontSize: 11 }} /></button>
        <span className={styles.pickerMonth}>{MONTHS[view.m]} {view.y}</span>
        <button type="button" className={styles.pickerNavBtn} onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}><i className="ti ti-chevron-right" style={{ fontSize: 11 }} /></button>
      </div>
      <div className={styles.pickerWeekdays}>{WEEKDAYS.map((d) => <div key={d} className={styles.pickerWeekday}>{d}</div>)}</div>
      <div className={styles.pickerGrid}>{cells}</div>
      <div className={styles.pickerLegend}>
        <div className={styles.pickerLegendItem}><span className={styles.pickerLegendSwatch} style={{ background: "#fcebeb", border: "0.5px solid #f09595" }} /> Draft</div>
        <div className={styles.pickerLegendItem}><span className={styles.pickerLegendSwatch} style={{ background: "#eaf3de", border: "0.5px solid #97c459" }} /> Done</div>
        {withCount ? <div className={styles.pickerLegendItem}><span className={styles.pickerLegendSwatch} style={{ background: "#e6f1fb", border: "0.5px solid #85b7eb" }} /> 3+</div> : null}
      </div>
    </div>
  );
}

/* ── Overview calendar (dots) ── */
function OverviewCalendar({ month, year, onNav, dotsForDay, onDayClick }: { month: number; year: number; onNav: (delta: number) => void; dotsForDay: (key: string) => string[]; onDayClick: (key: string, hasItems: boolean) => void }) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const today = todayKey();
  const cells: ReactNode[] = [];
  for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= total; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dots = dotsForDay(key);
    const isToday = key === today;
    cells.push(
      <div key={key} className={styles.calDay} onClick={() => onDayClick(key, dots.length > 0)}>
        {isToday ? <div className={styles.calToday}><span>{d}</span></div> : <div className={styles.calDayNum}>{d}</div>}
        <div className={styles.calDots}>{dots.map((color, i) => <span key={i} className={styles.calDot} style={{ background: color }} />)}</div>
      </div>,
    );
  }
  return (
    <div className={styles.calCard}>
      <div className={styles.calTopbar}>
        <button type="button" className={styles.calNavBtn} onClick={() => onNav(-1)}><i className="ti ti-chevron-left" style={{ fontSize: 12 }} /></button>
        <div className={styles.calMonth}>{MONTHS[month]} {year}</div>
        <button type="button" className={styles.calNavBtn} onClick={() => onNav(1)}><i className="ti ti-chevron-right" style={{ fontSize: 12 }} /></button>
      </div>
      <div className={styles.calGrid}>
        {WEEKDAYS.map((d) => <div key={d} className={styles.calWeekday}>{d}</div>)}
        {cells}
      </div>
      <div className={styles.calLegend}>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: "#c0392b" }} />Draft</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: "#3b6d11" }} />Done</span>
      </div>
    </div>
  );
}

/* ── Reusable links panel ── */
function LinksPanel({ kind, links }: { kind: "cp" | "sp"; links: ApiRecord[] }) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();

  function save() {
    if (!label.trim() || !url.trim()) return;
    start(async () => {
      await addContentLinkAction(kind, label, url);
      setLabel(""); setUrl(""); setAdding(false);
    });
  }

  return (
    <div className={styles.linksCard}>
      <div className={styles.linksHeader} onClick={() => setOpen((v) => !v)}>
        <i className="ti ti-link" />
        <span className={styles.linksTitle}>Links{links.length ? <span> ({links.length})</span> : null}</span>
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 13, color: "var(--text-muted)" }} />
      </div>
      {open ? (
        <>
          <div className={styles.chips}>
            {links.map((link) => {
              const href = text(link.url);
              const valid = /^https?:\/\//.test(href);
              return (
                <div key={text(link.id)} className={`${styles.chip} ${valid ? styles.clickable : ""}`} title={text(link.label)} onClick={() => valid && window.open(href, "_blank")}>
                  <i className="ti ti-external-link" />
                  <span>{text(link.label)}</span>
                  <button className={styles.chipDelete} type="button" onClick={(event) => { event.stopPropagation(); void deleteContentLinkAction(kind, text(link.id)); }}><i className="ti ti-x" style={{ fontSize: 10 }} /></button>
                </div>
              );
            })}
            <button className={styles.addChip} type="button" onClick={() => setAdding(true)}><i className="ti ti-plus" style={{ fontSize: 11 }} /><span>Tambah link</span></button>
          </div>
          {adding ? (
            <div className={styles.linkForm}>
              <div className={styles.linkFormField}><div className={styles.linkFormLabel}>Label</div><input className={styles.input} style={{ height: 32, fontSize: 12 }} placeholder="cth: Template Story" value={label} onChange={(event) => setLabel(event.target.value)} autoFocus /></div>
              <div className={`${styles.linkFormField} ${styles.wide}`}><div className={styles.linkFormLabel}>URL</div><input className={styles.input} style={{ height: 32, fontSize: 12 }} placeholder="https://..." value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); }} /></div>
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} style={{ height: 32 }} type="button" disabled={pending} onClick={save}>Simpan</button>
              <button className={`${styles.btn} ${styles.btnSm}`} style={{ height: 32 }} type="button" onClick={() => { setAdding(false); setLabel(""); setUrl(""); }}>Batal</button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ── AI input panel ── */
function AiPanel({ kind, onParsed }: { kind: "carousel" | "story"; onParsed: (data: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const placeholder = kind === "carousel" ? "carousel tips lolos MT FMCG buat Falah, posting 25 Juni, awareness" : "story 28 Juni: hook dulu, terus pain point, solusi CCA, tutup CTA daftar";
  const hintFields = kind === "carousel" ? "judul, tanggal posting, funnel, dan assignee" : "tanggal dan isi tiap slide";

  async function parse() {
    if (!value.trim()) { setError("Tulis dulu sebelum di-parse."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ai/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, text: value.trim() }) });
      const payload = await res.json() as { data?: Record<string, unknown>; error?: string };
      if (!res.ok || !payload.data) throw new Error(payload.error || "Gagal parse, coba lagi.");
      onParsed(payload.data);
      setValue("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal parse, coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.aiPanel}>
      <div className={styles.aiHeader} onClick={() => setOpen((v) => !v)}>
        <i className="ti ti-sparkles" />
        <span className={styles.aiHeaderLabel}>Input dengan AI</span>
        <i className={`ti ti-chevron-down ${styles.aiChevron}`} style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </div>
      {open ? (
        <div className={styles.aiCard}>
          <textarea className={styles.aiTextarea} rows={2} placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} />
          <div className={styles.aiActions}>
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} type="button" disabled={busy} onClick={parse}>
              <i className={busy ? "ti ti-loader-2" : "ti ti-sparkles"} style={{ fontSize: 11 }} /> {busy ? "Parsing..." : "Parse"}
            </button>
          </div>
          <div className={styles.aiHint}>Tulis bebas — AI akan ekstrak {hintFields} otomatis.{error ? <><br /><span style={{ color: "var(--red)" }}>{error}</span></> : null}</div>
        </div>
      ) : null}
    </div>
  );
}

export function ContentPlanningTools(props: ContentPlanningProps) {
  const [tab, setTab] = useState<Tab>("carousel");
  const tabs: Array<[Tab, string, string]> = [["carousel", "ti-layout-columns", "Carousel Plan"], ["story", "ti-layout-rows", "Story Plan"], ["kol", "ti-users", "KOL List"], ["mt", "ti-star", "MT Story"]];
  return (
    <div className={styles.root}>
      <div className={styles.tabRow}>
        {tabs.map(([key, icon, label]) => (
          <button key={key} type="button" className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`} onClick={() => setTab(key)}>
            <i className={`ti ${icon}`} /> {label}
          </button>
        ))}
      </div>
      <div className={styles.body}>
        <div className={styles.page}>
          {tab === "carousel" ? <CarouselTab carousels={props.carousels} ctas={props.ctas} links={props.carouselLinks} people={props.people} /> : null}
          {tab === "story" ? <StoryTab dates={props.dates} items={props.stories} links={props.storyLinks} /> : null}
          {tab === "kol" ? <KolTab kols={props.kols} /> : null}
          {tab === "mt" ? <MtTab stories={props.mtStories} /> : null}
        </div>
      </div>
    </div>
  );
}

type ContentPlanningProps = {
  dates: ApiRecord[];
  stories: ApiRecord[];
  storyLinks: ApiRecord[];
  carousels: ApiRecord[];
  carouselLinks: ApiRecord[];
  ctas: ApiRecord[];
  kols: ApiRecord[];
  mtStories: ApiRecord[];
  people: ApiRecord[];
};

/* ══════════════ CAROUSEL TAB ══════════════ */
type CarouselModalState = { plan: ApiRecord | null; preset: Partial<CarouselPlanInput> & { tanggal_posting?: string } };

function CarouselTab({ carousels, ctas, links, people }: { carousels: ApiRecord[]; ctas: ApiRecord[]; links: ApiRecord[]; people: ApiRecord[] }) {
  const now = new Date();
  const [cal, setCal] = useState({ m: now.getMonth(), y: now.getFullYear() });
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [initCollapse, setInitCollapse] = useState(false);
  const [modal, setModal] = useState<CarouselModalState | null>(null);
  const [dateModal, setDateModal] = useState<ApiRecord | null>(null);
  const [pending, start] = useTransition();

  const statusMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    carousels.forEach((plan) => { const key = dateKey(plan.tanggal_posting); if (!key) return; (map[key] ||= []).push(text(plan.status) || "Draft"); });
    return map;
  }, [carousels]);

  const groups = useMemo(() => {
    const byWeek: Record<string, { ws: Date; plans: ApiRecord[] }> = {};
    carousels.forEach((plan) => {
      const key = dateKey(plan.tanggal_posting) || todayKey();
      const ws = startOfWeek(key);
      const wk = localIso(ws);
      (byWeek[wk] ||= { ws, plans: [] }).plans.push(plan);
    });
    return Object.keys(byWeek).sort().map((wk) => ({ wk, ...byWeek[wk] }));
  }, [carousels]);

  const currentWeek = localIso(startOfWeek(todayKey()));
  const collapsedSet = useMemo(() => {
    if (initCollapse) return collapsed;
    return new Set(groups.map((g) => g.wk).filter((wk) => wk !== currentWeek));
  }, [initCollapse, collapsed, groups, currentWeek]);

  function toggleWeek(wk: string) {
    const next = new Set(collapsedSet);
    if (next.has(wk)) next.delete(wk); else next.add(wk);
    setCollapsed(next); setInitCollapse(true);
  }

  return (
    <>
      <AiPanel kind="carousel" onParsed={(data) => setModal({ plan: null, preset: { judul: text(data.judul), tanggal_posting: dateKey(data.tanggal_posting), funnel: text(data.funnel) || "TOFU", cta: text(data.cta) || null, status: text(data.status) === "Done" ? "Done" : "Draft" } })} />
      <LinksPanel kind="cp" links={links} />

      <div className={styles.sectionBlock}>
        <div className={styles.sectionLabel}><i className="ti ti-calendar" /> Kalender Carousel</div>
        <OverviewCalendar
          month={cal.m} year={cal.y}
          onNav={(delta) => setCal((c) => { const m = c.m + delta; if (m > 11) return { m: 0, y: c.y + 1 }; if (m < 0) return { m: 11, y: c.y - 1 }; return { m, y: c.y }; })}
          dotsForDay={(key) => (statusMap[key] || []).slice(0, 3).map((s) => (s === "Done" ? "#3b6d11" : "#c0392b"))}
          onDayClick={(key, has) => { if (!has) setModal({ plan: null, preset: { tanggal_posting: key } }); }}
        />
      </div>

      <div className={styles.sectionRow}>
        <div className={styles.sectionLabel} style={{ marginBottom: 0 }}><i className="ti ti-layout-columns" /> Carousel Plans</div>
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} type="button" onClick={() => setModal({ plan: null, preset: {} })}><i className="ti ti-plus" /> Tambah Plan</button>
      </div>

      {!carousels.length ? (
        <div className={styles.empty}><i className="ti ti-layout-columns" />Belum ada carousel plan. Klik &quot;+ Tambah Plan&quot; untuk mulai.</div>
      ) : groups.map(({ wk, ws, plans }) => {
        const isCollapsed = collapsedSet.has(wk);
        const done = plans.filter((p) => text(p.status) === "Done").length;
        const draft = plans.length - done;
        return (
          <div key={wk} className={styles.weekGroup}>
            <div className={styles.weekHeader} onClick={() => toggleWeek(wk)}>
              <i className={`ti ti-chevron-${isCollapsed ? "right" : "down"}`} />
              <span className={styles.weekLabel}>{weekLabel(ws)}</span>
              <span className={styles.weekRange}>{weekRange(ws)}</span>
              <span className={styles.weekSpacer} />
              {isCollapsed ? (
                <span className={styles.weekBadges}>
                  {draft > 0 ? <span className={`${styles.badge} ${styles.badgeDraft}`}>{draft} draft</span> : null}
                  {done > 0 ? <span className={`${styles.badge} ${styles.badgeDone}`}>{done} done</span> : null}
                </span>
              ) : null}
            </div>
            {!isCollapsed ? plans.map((plan) => {
              const funnel = text(plan.funnel) || "TOFU";
              const status = text(plan.status) || "Draft";
              const isDone = status === "Done";
              const fc = FUNNEL_COLORS[funnel] || { bg: "var(--bg)", fg: "#6b7280" };
              const assignee = people.find((p) => String(p.id) === text(plan.assignee_id));
              const brief = text(plan.link_brief);
              return (
                <div key={text(plan.id)} className={styles.itemCard} style={{ borderLeftColor: STATUS_BORDER[status] || "#888780" }}>
                  <div className={styles.itemCardInner}>
                    <div className={styles.itemHead}>
                      <input type="checkbox" className={styles.checkbox} checked={isDone} disabled={pending} onChange={(event) => start(() => { void setCarouselStatusAction(text(plan.id), event.target.checked ? "Done" : "Draft"); })} />
                      <div className={styles.itemGrow}>
                        <div className={styles.titleRow}>
                          <span className={`${styles.itemTitle} ${isDone ? styles.itemTitleDone : ""}`}>{text(plan.judul) || "Tanpa judul"}</span>
                          <span className={styles.pill} style={{ background: fc.bg, color: fc.fg }}>{funnel}</span>
                          {plan.cta ? <span className={styles.ctaPill}>{text(plan.cta)}</span> : null}
                        </div>
                        <div className={styles.metaRow}>
                          <div className={styles.metaLeft}>
                            <button type="button" className={styles.dateTrigger} onClick={() => setDateModal(plan)}><i className="ti ti-calendar" /> {fmtDt(plan.tanggal_posting) || "—"} <i className="ti ti-pencil" style={{ fontSize: 10, opacity: 0.4 }} /></button>
                            <span className={styles.dot}>·</span>
                            <LinkBriefCell plan={plan} brief={brief} />
                          </div>
                          {assignee ? <span className={styles.assignee}><i className="ti ti-user" style={{ fontSize: 10 }} /> {text(assignee.nama)}</span> : null}
                        </div>
                      </div>
                      <button type="button" className={styles.editBtn} onClick={() => setModal({ plan, preset: {} })}><i className="ti ti-edit" style={{ fontSize: 13 }} /></button>
                    </div>
                  </div>
                </div>
              );
            }) : null}
          </div>
        );
      })}

      {modal ? <CarouselModal state={modal} ctas={ctas} people={people} statusMap={statusMap} onClose={() => setModal(null)} /> : null}
      {dateModal ? (
        <Modal size="sm" title="Ubah Tanggal Posting" onClose={() => setDateModal(null)}>
          <DatePicker selected={dateKey(dateModal.tanggal_posting) || todayKey()} statusMap={statusMap} withCount onPick={(key) => start(() => { void setCarouselDateAction(text(dateModal.id), key); setDateModal(null); })} />
        </Modal>
      ) : null}
    </>
  );
}

function LinkBriefCell({ plan, brief }: { plan: ApiRecord; brief: string }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(brief);
  const [pending, start] = useTransition();
  useEffect(() => setUrl(brief), [brief]);

  if (editing) {
    return (
      <span className={styles.inlineLinkRow}>
        <i className="ti ti-link" style={{ fontSize: 13, color: "var(--text-muted)" }} />
        <input className={styles.inlineLinkInput} type="url" placeholder="https://..." value={url} autoFocus onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") start(() => { void setCarouselLinkBriefAction(text(plan.id), url || null); setEditing(false); }); if (event.key === "Escape") setEditing(false); }} />
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending} onClick={() => start(() => { void setCarouselLinkBriefAction(text(plan.id), url || null); setEditing(false); })}>Simpan</button>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => { setEditing(false); setUrl(brief); }}>Batal</button>
      </span>
    );
  }
  if (brief) {
    return (
      <>
        <a className={styles.linkBrief} href={brief} target="_blank" rel="noopener noreferrer"><i className="ti ti-link" /> Link Brief <i className="ti ti-external-link" style={{ fontSize: 10, opacity: 0.7 }} /></a>
        <button type="button" className={styles.iconBtn} onClick={() => setEditing(true)}><i className="ti ti-pencil" style={{ fontSize: 10 }} /></button>
      </>
    );
  }
  return <button type="button" className={styles.linkBriefAdd} onClick={() => setEditing(true)}><i className="ti ti-plus" style={{ fontSize: 11 }} /> Tambah link brief</button>;
}

function CarouselModal({ state, ctas, people, statusMap, onClose }: { state: CarouselModalState; ctas: ApiRecord[]; people: ApiRecord[]; statusMap: Record<string, string[]>; onClose: () => void }) {
  const plan = state.plan;
  const [judul, setJudul] = useState(text(plan?.judul) || text(state.preset.judul));
  const [tanggal, setTanggal] = useState(dateKey(plan?.tanggal_posting) || state.preset.tanggal_posting || todayKey());
  const [funnel, setFunnel] = useState(text(plan?.funnel) || state.preset.funnel || "TOFU");
  const [cta, setCta] = useState(text(plan?.cta) || text(state.preset.cta));
  const [assignee, setAssignee] = useState(text(plan?.assignee_id));
  const [status, setStatus] = useState(text(plan?.status) || state.preset.status || "Draft");
  const [linkBrief, setLinkBrief] = useState(text(plan?.link_brief));
  const [pending, start] = useTransition();

  function save() {
    if (!judul.trim()) return;
    const input: CarouselPlanInput = { judul, tanggal_posting: tanggal, funnel, cta: cta || null, assignee_id: assignee || null, status, link_brief: linkBrief || null };
    start(async () => {
      if (plan) await updateCarouselPlanAction(text(plan.id), input);
      else await createCarouselPlanAction(input);
      onClose();
    });
  }
  function remove() {
    if (!plan || !window.confirm("Hapus carousel plan ini? Data akan dihapus permanen.")) return;
    start(async () => { await deleteCarouselPlanAction(text(plan.id)); onClose(); });
  }
  function addCta() {
    const label = window.prompt("Nama CTA baru:");
    if (!label || !label.trim()) return;
    start(async () => { const row = await createCtaAction(label); setCta(row.label); });
  }

  return (
    <Modal
      title={`${plan ? "Edit" : "Tambah"} Carousel Plan`}
      onClose={onClose}
      footer={
        <>
          {plan ? <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger} ${styles.footerSpacer}`} onClick={remove}><i className="ti ti-trash" /> Hapus</button> : null}
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onClose}>Batal</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending || !judul.trim()} onClick={save}><i className="ti ti-check" /> Simpan</button>
        </>
      }
    >
      <Field label="Judul *"><input className={styles.input} placeholder="Judul konten carousel..." value={judul} autoFocus onChange={(event) => setJudul(event.target.value)} /></Field>
      <Field label="Tanggal Posting"><DatePicker selected={tanggal} statusMap={statusMap} withCount onPick={setTanggal} /></Field>
      <Field label="Funnel">
        <select className={styles.select} value={funnel} onChange={(event) => setFunnel(event.target.value)}>{["TOFU", "MOFU", "BOFU"].map((f) => <option key={f} value={f}>{f}</option>)}</select>
      </Field>
      <Field label="CTA">
        <div className={styles.inputRow}>
          <select className={styles.select} value={cta} onChange={(event) => setCta(event.target.value)}>
            <option value="">— Pilih CTA —</option>
            {ctas.map((option) => <option key={text(option.id)} value={text(option.label)}>{text(option.label)}</option>)}
            {cta && !ctas.some((option) => text(option.label) === cta) ? <option value={cta}>{cta}</option> : null}
          </select>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} style={{ whiteSpace: "nowrap" }} onClick={addCta}>+ CTA Baru</button>
        </div>
      </Field>
      <Field label="Assignee">
        <select className={styles.select} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
          <option value="">— Pilih —</option>
          {people.map((person) => <option key={text(person.id)} value={text(person.id)}>{text(person.nama)}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)}>{["Draft", "Done"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </Field>
      <Field label="Link Brief" optional>
        <div className={styles.inputRow}>
          <i className="ti ti-link" />
          <input className={styles.input} placeholder="https://docs.google.com/..." value={linkBrief} onChange={(event) => setLinkBrief(event.target.value)} />
        </div>
      </Field>
    </Modal>
  );
}

/* ══════════════ STORY TAB ══════════════ */
function StoryTab({ dates, items, links }: { dates: ApiRecord[]; items: ApiRecord[]; links: ApiRecord[] }) {
  const now = new Date();
  const [cal, setCal] = useState({ m: now.getMonth(), y: now.getFullYear() });
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [initCollapse, setInitCollapse] = useState(false);
  const [addModal, setAddModal] = useState<{ preDate?: string; items: string[] } | null>(null);
  const [pending, start] = useTransition();

  const itemsByDate = useMemo(() => {
    const map: Record<string, ApiRecord[]> = {};
    items.forEach((item) => { (map[text(item.date_id)] ||= []).push(item); });
    Object.values(map).forEach((list) => list.sort((a, b) => Number(a.urutan || 0) - Number(b.urutan || 0)));
    return map;
  }, [items]);

  const statusMap = useMemo(() => {
    const map: Record<string, string> = {};
    dates.forEach((date) => { const key = dateKey(date.tanggal); if (key) map[key] = text(date.status) || "Draft"; });
    return map;
  }, [dates]);

  const groups = useMemo(() => {
    const byWeek: Record<string, { ws: Date; rows: ApiRecord[] }> = {};
    dates.forEach((date) => { const key = dateKey(date.tanggal) || todayKey(); const ws = startOfWeek(key); (byWeek[localIso(ws)] ||= { ws, rows: [] }).rows.push(date); });
    return Object.keys(byWeek).sort().map((wk) => ({ wk, ...byWeek[wk] }));
  }, [dates]);

  const currentWeek = localIso(startOfWeek(todayKey()));
  const collapsedSet = useMemo(() => (initCollapse ? collapsed : new Set(groups.map((g) => g.wk).filter((wk) => wk !== currentWeek))), [initCollapse, collapsed, groups, currentWeek]);
  function toggleWeek(wk: string) { const next = new Set(collapsedSet); if (next.has(wk)) next.delete(wk); else next.add(wk); setCollapsed(next); setInitCollapse(true); }

  return (
    <>
      <AiPanel kind="story" onParsed={(data) => setAddModal({ preDate: dateKey(data.tanggal) || undefined, items: Array.isArray(data.items) ? (data.items as Array<{ isi?: string }>).map((it) => text(it.isi)).filter(Boolean) : [] })} />
      <LinksPanel kind="sp" links={links} />

      <div className={styles.sectionBlock}>
        <div className={styles.sectionLabel}><i className="ti ti-calendar" /> Kalender Story</div>
        <OverviewCalendar
          month={cal.m} year={cal.y}
          onNav={(delta) => setCal((c) => { const m = c.m + delta; if (m > 11) return { m: 0, y: c.y + 1 }; if (m < 0) return { m: 11, y: c.y - 1 }; return { m, y: c.y }; })}
          dotsForDay={(key) => { const st = statusMap[key]; if (!st) return []; const count = Math.min((itemsByDate[dateIdForKey(dates, key)] || []).length || 1, 3); return Array.from({ length: count }, () => (st === "Done" ? "#3b6d11" : "#c0392b")); }}
          onDayClick={(key, has) => { if (!has) setAddModal({ preDate: key, items: [] }); }}
        />
      </div>

      <div className={styles.sectionRow}>
        <div className={styles.sectionLabel} style={{ marginBottom: 0 }}><i className="ti ti-layout-rows" /> Jadwal Posting</div>
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} type="button" onClick={() => setAddModal({ items: [] })}><i className="ti ti-plus" /> Tambah Tanggal</button>
      </div>

      {!dates.length ? (
        <div className={styles.empty}><i className="ti ti-calendar-off" />Belum ada jadwal. Klik &quot;+ Tambah Tanggal&quot; untuk mulai.</div>
      ) : groups.map(({ wk, ws, rows }) => {
        const isCollapsed = collapsedSet.has(wk);
        const done = rows.filter((d) => text(d.status) === "Done").length;
        const draft = rows.length - done;
        return (
          <div key={wk} className={styles.weekGroup}>
            <div className={styles.weekHeader} onClick={() => toggleWeek(wk)}>
              <i className={`ti ti-chevron-${isCollapsed ? "right" : "down"}`} />
              <span className={styles.weekLabel}>{weekLabel(ws)}</span>
              <span className={styles.weekRange}>{weekRange(ws)}</span>
              <span className={styles.weekSpacer} />
              {isCollapsed ? (
                <span className={styles.weekBadges}>
                  {draft > 0 ? <span className={`${styles.badge} ${styles.badgeDraft}`}>{draft} draft</span> : null}
                  {done > 0 ? <span className={`${styles.badge} ${styles.badgeDone}`}>{done} done</span> : null}
                </span>
              ) : null}
            </div>
            {!isCollapsed ? rows.map((date) => <StoryDateCard key={text(date.id)} date={date} items={itemsByDate[text(date.id)] || []} pending={pending} start={start} />) : null}
          </div>
        );
      })}

      {addModal ? <StoryDateModal preDate={addModal.preDate} presetItems={addModal.items} onClose={() => setAddModal(null)} /> : null}
    </>
  );
}

function dateIdForKey(dates: ApiRecord[], key: string) { const found = dates.find((d) => dateKey(d.tanggal) === key); return found ? text(found.id) : ""; }

function StoryDateCard({ date, items, pending, start }: { date: ApiRecord; items: ApiRecord[]; pending: boolean; start: (cb: () => void) => void }) {
  const [open, setOpen] = useState(true);
  const isDone = text(date.status) === "Done";
  return (
    <div className={styles.itemCard} style={{ borderLeftColor: isDone ? "#3b6d11" : "#888780" }}>
      <div className={styles.itemCardInner} style={{ cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <div className={styles.itemHead}>
          <input type="checkbox" className={styles.checkbox} checked={isDone} disabled={pending} onClick={(event) => event.stopPropagation()} onChange={(event) => start(() => { void setStoryPlanStatusAction(text(date.id), event.target.checked ? "Done" : "Draft"); })} />
          <div className={styles.itemGrow}>
            <div className={styles.titleRow} style={{ marginBottom: 2 }}>
              <span className={`${styles.itemTitle} ${isDone ? styles.itemTitleDone : ""}`}>{fmtDt(date.tanggal)}</span>
            </div>
            <div className={styles.subMeta}><i className="ti ti-file-text" /><span>{items.length} story direncanakan</span>{isDone ? <span style={{ fontSize: 11, color: "#3b6d11", fontWeight: 500 }}> · Selesai diposting</span> : null}</div>
          </div>
          <span className={styles.pill} style={{ background: "#e8f0fc", color: "#185fa5", fontWeight: 500 }}>{items.length} story</span>
          <button type="button" className={styles.editBtn} onClick={(event) => { event.stopPropagation(); if (window.confirm("Hapus jadwal ini? Semua story dalam jadwal ini akan ikut terhapus.")) start(() => { void deleteStoryDateAction(text(date.id)); }); }}><i className="ti ti-trash" style={{ fontSize: 13 }} /></button>
          <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }} />
        </div>
      </div>
      {open ? (
        <div className={styles.storyBody}>
          {items.length ? items.map((item, index) => <StoryItemRow key={text(item.id)} item={item} index={index} start={start} />) : <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Belum ada story. Klik &quot;+ Tambah story&quot;.</div>}
          <button type="button" className={styles.linkTextBtn} onClick={() => start(() => { void addStoryItemAction(text(date.id)); })}><i className="ti ti-plus" style={{ fontSize: 11 }} /> Tambah story</button>
        </div>
      ) : null}
    </div>
  );
}

function StoryItemRow({ item, index, start }: { item: ApiRecord; index: number; start: (cb: () => void) => void }) {
  const [value, setValue] = useState(text(item.isi));
  useEffect(() => setValue(text(item.isi)), [item.isi]);
  return (
    <div className={styles.storyItemRow}>
      <span className={styles.storyItemNum}>{index + 1}</span>
      <input className={styles.storyItemInput} value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => { if (value !== text(item.isi)) start(() => { void updateStoryItemAction(text(item.id), value); }); }} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }} />
      <button type="button" className={styles.chipDelete} style={{ padding: 4 }} onClick={() => { if (window.confirm("Hapus story ini?")) start(() => { void deleteStoryItemAction(text(item.id)); }); }}><i className="ti ti-trash" style={{ fontSize: 12 }} /></button>
    </div>
  );
}

function StoryDateModal({ preDate, presetItems, onClose }: { preDate?: string; presetItems: string[]; onClose: () => void }) {
  const [tanggal, setTanggal] = useState(preDate || todayKey());
  const [stories, setStories] = useState<string[]>(() => { const base = presetItems.length ? presetItems : []; return [...base, ...Array(Math.max(3 - base.length, 0)).fill("")]; });
  const [pending, start] = useTransition();

  function save() {
    const filled = stories.map((s) => s.trim()).filter(Boolean);
    if (!filled.length) return;
    start(async () => { await createStoryDateAction({ tanggal, items: filled }); onClose(); });
  }

  return (
    <Modal size="md" title="Tambah Tanggal" onClose={onClose}
      footer={<>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onClose}>Batal</button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending || !stories.some((s) => s.trim())} onClick={save}><i className="ti ti-check" /> Simpan</button>
      </>}
    >
      <Field label="Tanggal *"><DatePicker selected={tanggal} statusMap={{}} onPick={setTanggal} /></Field>
      {stories.map((value, index) => (
        <Field key={index} label={`Story ${index + 1}`} optional={index > 0}>
          <input className={styles.input} placeholder={`Konteks / judul / objective story ${index + 1}...`} value={value} onChange={(event) => setStories((list) => list.map((item, i) => (i === index ? event.target.value : item)))} />
        </Field>
      ))}
      <button type="button" className={styles.linkTextBtn} onClick={() => setStories((list) => [...list, ""])}><i className="ti ti-plus" style={{ fontSize: 11 }} /> Tambah Story</button>
    </Modal>
  );
}

/* ══════════════ KOL TAB ══════════════ */
function KolTab({ kols }: { kols: ApiRecord[] }) {
  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState("all");
  const [modal, setModal] = useState<{ kol: ApiRecord | null } | null>(null);
  const [pending, start] = useTransition();

  const niches = useMemo(() => [...new Set(kols.map((k) => text(k.niche)).filter(Boolean))], [kols]);
  const filtered = kols.filter((k) => {
    const q = search.toLowerCase();
    if (q && !text(k.nama).toLowerCase().includes(q) && !text(k.username).toLowerCase().includes(q)) return false;
    if (niche !== "all" && text(k.niche) !== niche) return false;
    return true;
  });

  return (
    <>
      <div className={styles.filterBar}>
        <input className={styles.filterInput} placeholder="Cari nama / username..." value={search} onChange={(event) => setSearch(event.target.value)} />
        {[["all", "Semua"], ...niches.map((n) => [n, n] as [string, string])].map(([value, label]) => (
          <button key={value} type="button" className={`${styles.filterPill} ${niche === value ? styles.filterPillActive : ""}`} onClick={() => setNiche(value)}>{label}</button>
        ))}
        <span className={styles.filterSpacer} />
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} type="button" onClick={() => setModal({ kol: null })}><i className="ti ti-plus" /> Tambah KOL</button>
      </div>
      {!filtered.length ? (
        <div className={styles.empty}><i className="ti ti-users-group" />Belum ada KOL</div>
      ) : (
        <div className={styles.grid3}>
          {filtered.map((k) => {
            const photo = text(k.foto_url);
            const platform = text(k.platform);
            const username = text(k.username);
            const followers = Number(k.followers || 0);
            const link = username ? (platform === "TikTok" ? `https://tiktok.com/@${username}` : platform === "Instagram" ? `https://instagram.com/${username}` : "") : "";
            return (
              <div key={text(k.id)} className={styles.personCard}>
                <div className={styles.personTop}>
                  <div className={styles.personHead}>
                    <Avatar url={photo} name={text(k.nama)} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className={styles.personName}>{text(k.nama) || "—"}</div>
                      {k.niche ? <span className={styles.nichePill}>{text(k.niche)}</span> : null}
                    </div>
                  </div>
                  {platform || username ? (
                    <div className={styles.personTags} style={{ marginBottom: 8 }}>
                      {link ? <a className={styles.tagPill} href={link} target="_blank" rel="noopener noreferrer">{platform || "Profil"}{followers ? ` · ${fmtFollowers(followers)}` : ""}</a> : <span className={styles.tagPill}>{platform || username}{followers ? ` · ${fmtFollowers(followers)}` : ""}</span>}
                    </div>
                  ) : null}
                  {k.contact ? <div className={styles.rateBox}>Kontak: {text(k.contact)}</div> : null}
                  {k.notes ? <div className={styles.personDesc}>{text(k.notes)}</div> : null}
                </div>
                <div className={styles.cardFooter}>
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} style={{ padding: "4px 8px" }} onClick={() => setModal({ kol: k })}><i className="ti ti-edit" style={{ fontSize: 12 }} /></button>
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} style={{ padding: "4px 8px", color: "var(--red)" }} disabled={pending} onClick={() => { if (window.confirm("Hapus KOL ini?")) start(() => { void deleteKolAction(text(k.id)); }); }}><i className="ti ti-trash" style={{ fontSize: 12 }} /></button>
                  {k.rate_card_url ? <a className={`${styles.btn} ${styles.btnSm} ${styles.cardFooterSpacer}`} href={text(k.rate_card_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}><i className="ti ti-file" style={{ fontSize: 11 }} /> Rate Card</a> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal ? <KolModal kol={modal.kol} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function KolModal({ kol, onClose }: { kol: ApiRecord | null; onClose: () => void }) {
  const [form, setForm] = useState<KolInput>({
    nama: text(kol?.nama), username: text(kol?.username), platform: text(kol?.platform) || "Instagram", niche: text(kol?.niche),
    followers: Number(kol?.followers || 0), contact: text(kol?.contact), rate_card_url: text(kol?.rate_card_url), notes: text(kol?.notes), foto_url: text(kol?.foto_url),
  });
  const [pending, start] = useTransition();
  const set = (patch: Partial<KolInput>) => setForm((f) => ({ ...f, ...patch }));

  function save() {
    if (!form.nama?.trim()) return;
    start(async () => { if (kol) await updateKolAction(text(kol.id), form); else await createKolAction(form); onClose(); });
  }

  return (
    <Modal title={`${kol ? "Edit" : "Tambah"} KOL`} onClose={onClose}
      footer={<>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onClose}>Batal</button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending || !form.nama?.trim()} onClick={save}><i className="ti ti-check" /> Simpan</button>
      </>}
    >
      <Field label="Nama *"><input className={styles.input} value={text(form.nama)} autoFocus onChange={(event) => set({ nama: event.target.value })} /></Field>
      <Field label="Niche"><input className={styles.input} value={text(form.niche)} onChange={(event) => set({ niche: event.target.value })} placeholder="cth: Career / Finance" /></Field>
      <Field label="Platform">
        <select className={styles.select} value={text(form.platform)} onChange={(event) => set({ platform: event.target.value })}>{["Instagram", "TikTok", "YouTube", "LinkedIn", "Other"].map((p) => <option key={p} value={p}>{p}</option>)}</select>
      </Field>
      <Field label="Username"><input className={styles.input} value={text(form.username)} onChange={(event) => set({ username: event.target.value })} placeholder="tanpa @" /></Field>
      <Field label="Followers"><input className={styles.input} type="number" value={String(form.followers ?? 0)} onChange={(event) => set({ followers: Number(event.target.value) })} /></Field>
      <Field label="Kontak"><input className={styles.input} value={text(form.contact)} onChange={(event) => set({ contact: event.target.value })} placeholder="WA / email" /></Field>
      <Field label="Rate card URL" optional><input className={styles.input} value={text(form.rate_card_url)} onChange={(event) => set({ rate_card_url: event.target.value })} placeholder="https://..." /></Field>
      <Field label="Foto URL" optional><input className={styles.input} value={text(form.foto_url)} onChange={(event) => set({ foto_url: event.target.value })} placeholder="https://..." /></Field>
      <Field label="Catatan" optional><textarea className={styles.textarea} value={text(form.notes)} onChange={(event) => set({ notes: event.target.value })} /></Field>
    </Modal>
  );
}

/* ══════════════ MT STORY TAB ══════════════ */
function MtTab({ stories }: { stories: ApiRecord[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "posted" | "unposted">("all");
  const [modal, setModal] = useState<{ story: ApiRecord | null } | null>(null);
  const [pending, start] = useTransition();

  const filtered = stories.filter((s) => {
    if (filter === "posted" && !s.is_posted) return false;
    if (filter === "unposted" && s.is_posted) return false;
    const q = search.toLowerCase();
    if (q && !text(s.nama).toLowerCase().includes(q) && !text(s.perusahaan).toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
      <div className={styles.filterBar}>
        <input className={styles.filterInput} placeholder="Cari nama / perusahaan..." value={search} onChange={(event) => setSearch(event.target.value)} />
        {([["all", "Semua"], ["posted", "Sudah diposting"], ["unposted", "Belum diposting"]] as const).map(([value, label]) => (
          <button key={value} type="button" className={`${styles.filterPill} ${filter === value ? styles.filterPillActive : ""}`} onClick={() => setFilter(value)}>{label}</button>
        ))}
        <span className={styles.filterSpacer} />
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} type="button" onClick={() => setModal({ story: null })}><i className="ti ti-plus" /> Tambah</button>
      </div>
      {!filtered.length ? (
        <div className={styles.empty}><i className="ti ti-user-off" />Belum ada data</div>
      ) : (
        <div className={styles.grid3}>
          {filtered.map((s) => {
            const photo = text(s.foto_url);
            const posted = Boolean(s.is_posted);
            const tags: ReactNode[] = [];
            if (s.ig_url) tags.push(<a key="ig" className={styles.tagPill} href={text(s.ig_url)} target="_blank" rel="noopener noreferrer">IG</a>);
            if (s.linkedin_url) tags.push(<a key="li" className={styles.tagPill} href={text(s.linkedin_url)} target="_blank" rel="noopener noreferrer">LinkedIn</a>);
            if (s.brief_url) tags.push(<a key="br" className={styles.tagPill} href={text(s.brief_url)} target="_blank" rel="noopener noreferrer">Brief</a>);
            return (
              <div key={text(s.id)} className={`${styles.personCard} ${posted ? styles.personCardPosted : ""}`}>
                <div className={styles.personTop}>
                  <div className={styles.personHead}>
                    <Avatar url={photo} name={text(s.nama)} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className={styles.personName}>{text(s.nama) || "—"}</div>
                      <div className={styles.personSub}>{[text(s.perusahaan), text(s.batch)].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <span className={posted ? styles.statusPillPosted : styles.statusPillPending}>{posted ? "Sudah diposting" : "Belum diposting"}</span>
                  </div>
                  {s.deskripsi ? <div className={styles.personDesc}>{text(s.deskripsi)}</div> : null}
                  {tags.length ? <div className={styles.personTags}>{tags}</div> : null}
                </div>
                <div className={styles.cardFooter}>
                  {s.wa ? <a className={`${styles.btn} ${styles.btnSm}`} style={{ padding: "4px 8px", borderColor: "var(--green)", color: "var(--green)" }} href={`https://wa.me/${text(s.wa).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"><i className="ti ti-brand-whatsapp" style={{ fontSize: 12 }} /></a> : null}
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} style={{ padding: "4px 8px" }} onClick={() => setModal({ story: s })}><i className="ti ti-edit" style={{ fontSize: 12 }} /></button>
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} style={{ padding: "4px 8px", color: "var(--red)" }} disabled={pending} onClick={() => { if (window.confirm("Hapus MT Story ini?")) start(() => { void deleteMtStoryAction(text(s.id)); }); }}><i className="ti ti-trash" style={{ fontSize: 12 }} /></button>
                  {posted ? <span className={styles.cardFooterSpacer} style={{ fontSize: 11, color: "var(--text-hint)" }}>✓ Posted</span> : <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm} ${styles.cardFooterSpacer}`} style={{ fontSize: 11 }} disabled={pending} onClick={() => start(() => { void setMtPostedAction(text(s.id), true); })}>Tandai Posted</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal ? <MtModal story={modal.story} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function MtModal({ story, onClose }: { story: ApiRecord | null; onClose: () => void }) {
  const [form, setForm] = useState<MtStoryInput>({
    nama: text(story?.nama), perusahaan: text(story?.perusahaan), batch: text(story?.batch), wa: text(story?.wa), deskripsi: text(story?.deskripsi),
    ig_url: text(story?.ig_url), linkedin_url: text(story?.linkedin_url), brief_url: text(story?.brief_url), foto_url: text(story?.foto_url), is_posted: Boolean(story?.is_posted),
  });
  const [pending, start] = useTransition();
  const set = (patch: Partial<MtStoryInput>) => setForm((f) => ({ ...f, ...patch }));

  function save() {
    if (!form.nama?.trim()) return;
    start(async () => { if (story) await updateMtStoryAction(text(story.id), form); else await createMtStoryAction(form); onClose(); });
  }

  return (
    <Modal title={`${story ? "Edit" : "Tambah"} MT Story`} onClose={onClose}
      footer={<>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onClose}>Batal</button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending || !form.nama?.trim()} onClick={save}><i className="ti ti-check" /> Simpan</button>
      </>}
    >
      <Field label="Nama *"><input className={styles.input} value={text(form.nama)} autoFocus onChange={(event) => set({ nama: event.target.value })} /></Field>
      <Field label="Perusahaan"><input className={styles.input} value={text(form.perusahaan)} onChange={(event) => set({ perusahaan: event.target.value })} /></Field>
      <Field label="Batch"><input className={styles.input} value={text(form.batch)} onChange={(event) => set({ batch: event.target.value })} /></Field>
      <Field label="WhatsApp"><input className={styles.input} value={text(form.wa)} onChange={(event) => set({ wa: event.target.value })} placeholder="62..." /></Field>
      <Field label="Deskripsi" optional><textarea className={styles.textarea} value={text(form.deskripsi)} onChange={(event) => set({ deskripsi: event.target.value })} /></Field>
      <Field label="Instagram URL" optional><input className={styles.input} value={text(form.ig_url)} onChange={(event) => set({ ig_url: event.target.value })} placeholder="https://..." /></Field>
      <Field label="LinkedIn URL" optional><input className={styles.input} value={text(form.linkedin_url)} onChange={(event) => set({ linkedin_url: event.target.value })} placeholder="https://..." /></Field>
      <Field label="Brief URL" optional><input className={styles.input} value={text(form.brief_url)} onChange={(event) => set({ brief_url: event.target.value })} placeholder="https://..." /></Field>
      <Field label="Foto URL" optional><input className={styles.input} value={text(form.foto_url)} onChange={(event) => set({ foto_url: event.target.value })} placeholder="https://..." /></Field>
      <label className={styles.inputRow} style={{ gap: 8, cursor: "pointer" }}><input type="checkbox" checked={Boolean(form.is_posted)} onChange={(event) => set({ is_posted: event.target.checked })} /> <span style={{ fontSize: 13 }}>Sudah diposting</span></label>
    </Modal>
  );
}
