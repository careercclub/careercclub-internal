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
  setCarouselLinkReferensiAction,
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
import { byDay, dayKey, fmtFollowers, groupByWeek, iso, monthCells, MONTHS, shortDay, weekdayDay, weekStart, WEEKDAYS } from "@/lib/content-planning/view";
import { useEffect, useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { askText, confirmAction } from "./app-dialog";
import s from "./content-planning.module.css";
import { useRecordFocus } from "./use-record-focus";
import { useModal } from "./use-modal";

// Content Planning in the IJIS layout: each plan type gets a planner — a month calendar that
// shows what is planned on each day, next to a week-by-week agenda. KOL and MT Story are
// people directories. Same data and actions as before.

type View = "carousel" | "story" | "kol" | "mt";

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function todayKey() { return iso(new Date()); }
function initials(name: string) { return name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?"; }

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

export function ContentPlanningTools(props: ContentPlanningProps) {
  const [view, setView] = useState<View>("carousel");
  const [adding, setAdding] = useState<View | null>(null);
  useRecordFocus((id) => { if (props.dates.some((date) => text(date.id) === id)) setView("story"); });
  const thisMonth = todayKey().slice(0, 7);
  const monthCarousels = props.carousels.filter((plan) => dayKey(plan.tanggal_posting).startsWith(thisMonth));
  const views: Array<[View, string, number]> = [["carousel", "Carousels", props.carousels.length], ["story", "Stories", props.dates.length], ["kol", "KOL list", props.kols.length], ["mt", "MT Story", props.mtStories.length]];
  const addLabel: Record<View, string> = { carousel: "Add carousel plan", story: "Add story date", kol: "Add KOL", mt: "Add MT story" };
  const drafts = props.carousels.filter((plan) => text(plan.status) !== "Done").length + props.dates.filter((date) => text(date.status) !== "Done").length;

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Marketing</span>
          <h1>Content Planning</h1>
          <p>{monthCarousels.length} carousel{monthCarousels.length === 1 ? "" : "s"} this month · {props.dates.length} story dates · {drafts} still in draft</p>
        </div>
        <button className={s.primary} onClick={() => setAdding(view)} type="button"><i className="ti ti-plus" aria-hidden="true" /> {addLabel[view]}</button>
      </header>

      <div className={s.segmented} role="tablist" aria-label="Content Planning view">
        {views.map(([id, label, count]) => <button aria-selected={view === id} className={view === id ? s.segmentActive : s.segment} key={id} onClick={() => setView(id)} role="tab" type="button">{label} <span>{count}</span></button>)}
      </div>

      {view === "carousel" ? <CarouselView adding={adding === "carousel"} carousels={props.carousels} ctas={props.ctas} links={props.carouselLinks} onAdded={() => setAdding(null)} people={props.people} /> : null}
      {view === "story" ? <StoryView adding={adding === "story"} dates={props.dates} items={props.stories} links={props.storyLinks} onAdded={() => setAdding(null)} /> : null}
      {view === "kol" ? <KolView adding={adding === "kol"} kols={props.kols} onAdded={() => setAdding(null)} /> : null}
      {view === "mt" ? <MtView adding={adding === "mt"} onAdded={() => setAdding(null)} stories={props.mtStories} /> : null}
    </div>
  );
}

/* ── Shared UI ── */
function Modal({ size, title, onClose, children, footer }: { size?: "sm" | "md"; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { dialogProps, titleId } = useModal(onClose);
  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={size === "sm" ? s.modalSm : size === "md" ? s.modalMd : s.modal} onClick={(event) => event.stopPropagation()} {...dialogProps}>
        <div className={s.modalHeader}>
          <div className={s.modalTitle} id={titleId}>{title}</div>
          <button aria-label="Close" className={s.iconButton} onClick={onClose} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        <div className={s.modalBody}>{children}</div>
        {footer ? <div className={s.modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, optional, required, children }: { label: string; optional?: boolean; required?: boolean; children: ReactNode }) {
  return (
    <label className={s.field}>
      <span className={s.fieldLabel}>{label}{required ? <span aria-hidden="true" className={s.req}> *</span> : null}{optional ? <span className={s.optional}> (optional)</span> : null}</span>
      {children}
    </label>
  );
}

/** Required text input: marked red and focused when saved empty. */
function useRequired() {
  const id = useId();
  const [invalid, setInvalid] = useState(false);
  return { id, invalid, clear: () => setInvalid(false), check: (value: string) => { if (value.trim()) return true; setInvalid(true); document.getElementById(id)?.focus(); return false; } };
}

/* Circular avatar that resolves stored object keys (or uses http URLs / initials). */
function Avatar({ url, name, large }: { url: string; name: string; large?: boolean }) {
  const [resolved, setResolved] = useState<{ key: string; src: string } | null>(null);
  useEffect(() => {
    if (!url || url.startsWith("http")) return;
    const controller = new AbortController();
    fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "download", key: url }), signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("unavailable"))))
      .then((result: { url?: string }) => setResolved({ key: url, src: result.url || "" }))
      .catch(() => { if (!controller.signal.aborted) setResolved({ key: url, src: "" }); });
    return () => controller.abort();
  }, [url]);
  const src = url.startsWith("http") ? url : resolved?.key === url ? resolved.src : "";
  const className = large ? s.avatarLg : s.avatar;
  if (src) return <span className={className} role="img" aria-label={name} style={{ backgroundImage: `url("${src.replaceAll('"', "%22")}")` }} />;
  return <span className={className} aria-hidden="true">{initials(name)}</span>;
}

/* ── Date picker (Monday-first) with what is already planned on each day ── */
function DatePicker({ selected, planned, onPick }: { selected: string; planned: Record<string, string[]>; onPick: (date: string) => void }) {
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : todayKey();
  const [cursor, setCursor] = useState(() => ({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 }));
  const today = todayKey();
  const move = (delta: number) => setCursor((c) => { const m = c.m + delta; return m > 11 ? { y: c.y + 1, m: 0 } : m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; });
  return (
    <div className={s.picker}>
      <div className={s.pickerTop}>
        <button aria-label="Previous month" className={s.iconButton} onClick={() => move(-1)} type="button"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
        <b>{MONTHS[cursor.m]} {cursor.y}</b>
        <button aria-label="Next month" className={s.iconButton} onClick={() => move(1)} type="button"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
      </div>
      <div className={s.pickerGrid}>
        {WEEKDAYS.map((d) => <span className={s.pickerWeekday} key={d}>{d.slice(0, 2)}</span>)}
        {monthCells(cursor.y, cursor.m).map((key, index) => {
          if (!key) return <span key={`e${index}`} />;
          const statuses = planned[key] || [];
          const allDone = statuses.length > 0 && statuses.every((st) => st === "Done");
          const cls = key === selected ? s.dayPicked : statuses.length ? (allDone ? s.dayDone : s.dayPlanned) : s.day;
          return (
            <button aria-label={`${weekdayDay(key)}${statuses.length ? `, ${statuses.length} planned` : ""}`} aria-pressed={key === selected} className={`${cls} ${key === today ? s.dayToday : ""}`} key={key} onClick={() => onPick(key)} type="button">
              {Number(key.slice(8))}{statuses.length > 1 ? <small>{statuses.length}</small> : null}
            </button>
          );
        })}
      </div>
      <div className={s.legend}><span><i className={s.swatchPlanned} /> Draft planned</span><span><i className={s.swatchDone} /> All done</span></div>
    </div>
  );
}

/* ── Planner calendar: titles inside the days ── */
type CalendarItem = { id: string; title: string; done: boolean };
function PlannerCalendar({ label, itemsFor, onItem, onEmptyDay }: { label: string; itemsFor: (day: string) => CalendarItem[]; onItem: (id: string) => void; onEmptyDay: (day: string) => void }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const today = todayKey();
  const move = (delta: number) => setCursor((c) => { const m = c.m + delta; return m > 11 ? { y: c.y + 1, m: 0 } : m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; });
  return (
    <section aria-label={label} className={s.calendar}>
      <div className={s.calendarTop}>
        <h2>{MONTHS[cursor.m]} {cursor.y}</h2>
        <div className={s.calendarNav}>
          <button aria-label="Previous month" className={s.iconButton} onClick={() => move(-1)} type="button"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
          <button className={s.todayButton} onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })} type="button">Today</button>
          <button aria-label="Next month" className={s.iconButton} onClick={() => move(1)} type="button"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
        </div>
      </div>
      <div className={s.calendarGrid}>
        {WEEKDAYS.map((d) => <span className={s.weekday} key={d}>{d}</span>)}
        {monthCells(cursor.y, cursor.m).map((key, index) => {
          if (!key) return <span className={s.cellBlank} key={`e${index}`} />;
          const items = itemsFor(key);
          return (
            <div className={key === today ? s.cellToday : s.cell} key={key}>
              <button aria-label={`Plan on ${weekdayDay(key)}`} className={s.cellAdd} onClick={() => onEmptyDay(key)} type="button"><span>{Number(key.slice(8))}</span><i className="ti ti-plus" aria-hidden="true" /></button>
              <div className={s.cellItems}>
                {items.slice(0, 2).map((item) => <button className={item.done ? s.chipDone : s.chipPlanned} key={item.id} onClick={() => onItem(item.id)} title={item.title} type="button">{item.done ? <i className="ti ti-check" aria-hidden="true" /> : null}{item.title}</button>)}
                {items.length > 2 ? <button className={s.chipMore} onClick={() => onItem(items[2].id)} type="button">+{items.length - 2} more</button> : null}
              </div>
              {items.length ? <span className={items.every((item) => item.done) ? s.dotDone : s.dotPlanned} aria-hidden="true" /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Week agenda shell ── */
function WeekGroup({ label, range, count, done, open, onToggle, children }: { label: string; range: string; count: number; done: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className={s.week}>
      <button aria-expanded={open} className={s.weekHead} onClick={onToggle} type="button">
        <i className={`ti ti-chevron-${open ? "down" : "right"}`} aria-hidden="true" />
        <b>{label}</b><span>{range}</span>
        <span className={s.weekCount}>{done}/{count} done</span>
      </button>
      {open ? <div className={s.weekBody}>{children}</div> : null}
    </section>
  );
}

function useWeekToggles(weeks: string[]) {
  const current = weekStart(todayKey());
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  // Default: this week and later are open, past weeks folded.
  const isOpen = (wk: string) => overrides[wk] ?? wk >= current;
  return { isOpen, toggle: (wk: string) => setOverrides((o) => ({ ...o, [wk]: !isOpen(wk) })), open: (wk: string) => setOverrides((o) => ({ ...o, [wk]: true })), weeks };
}

/* ── Links + AI bar ── */
function LinksBar({ kind, links }: { kind: "cp" | "sp"; links: ApiRecord[] }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState(""); const [url, setUrl] = useState("");
  const [pending, start] = useTransition();
  const req = useRequired();
  function save() {
    if (!label.trim()) { req.check(""); return; }
    if (!url.trim()) return;
    start(async () => { await addContentLinkAction(kind, label, url); setLabel(""); setUrl(""); setAdding(false); });
  }
  return (
    <div className={s.links} aria-label="Links" role="group">
      <span className={s.linksLabel}><i className="ti ti-link" aria-hidden="true" /> Links</span>
      {links.map((link) => {
        const href = text(link.url); const valid = /^https?:\/\//.test(href);
        return (
          <span className={s.linkChip} key={text(link.id)}>
            {valid ? <a href={href} rel="noopener noreferrer" target="_blank">{text(link.label)}</a> : <span>{text(link.label)}</span>}
            <button aria-label={`Remove link ${text(link.label)}`} onClick={async () => { if (await confirmAction({ title: `Remove link "${text(link.label)}"?`, confirmLabel: "Remove link", danger: true })) void deleteContentLinkAction(kind, text(link.id)); }} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
          </span>
        );
      })}
      {adding ? (
        <span className={s.linkForm}>
          <input aria-invalid={req.invalid || undefined} aria-label="Link label" className={req.invalid ? s.inputInvalid : s.input} onChange={(event) => { setLabel(event.target.value); req.clear(); }} placeholder="Label, e.g. Story template" id={req.id} value={label} />
          <input aria-label="Link URL" className={s.input} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); }} placeholder="https://…" type="url" value={url} />
          <button className={s.primarySm} disabled={pending} onClick={save} type="button">Save link</button>
          <button className={s.ghostSm} onClick={() => { setAdding(false); setLabel(""); setUrl(""); }} type="button">Cancel</button>
        </span>
      ) : <button className={s.addChip} onClick={() => setAdding(true)} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add link</button>}
    </div>
  );
}

function AiBar({ kind, onParsed }: { kind: "carousel" | "story"; onParsed: (data: Record<string, unknown>) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const placeholder = kind === "carousel" ? "Describe it, e.g. carousel tips lolos MT FMCG for Falah, post 25 June, awareness" : "Describe it, e.g. story 28 June: hook, then pain point, CCA solution, close with sign-up CTA";
  async function parse() {
    if (!value.trim()) { setError("Write a short description first."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ai/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, text: value.trim() }) });
      const payload = await res.json() as { data?: Record<string, unknown>; error?: string };
      if (!res.ok || !payload.data) throw new Error(payload.error || "Could not read that text. Try again.");
      onParsed(payload.data); setValue("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not read that text. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className={s.ai}>
      <i className="ti ti-sparkles" aria-hidden="true" />
      <input aria-label={`Describe a ${kind === "carousel" ? "carousel plan" : "story date"} for AI`} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void parse(); }} placeholder={placeholder} value={value} />
      <button className={s.primarySm} disabled={busy} onClick={parse} type="button">{busy ? "Reading…" : "Fill form with AI"}</button>
      {error ? <span className={s.aiError} role="status">{error}</span> : null}
    </div>
  );
}

/* ══════════════ CAROUSELS ══════════════ */
type CarouselModalState = { plan: ApiRecord | null; preset: Partial<CarouselPlanInput> & { tanggal_posting?: string } };

function CarouselView({ carousels, ctas, links, people, adding, onAdded }: { carousels: ApiRecord[]; ctas: ApiRecord[]; links: ApiRecord[]; people: ApiRecord[]; adding: boolean; onAdded: () => void }) {
  const [modal, setModal] = useState<CarouselModalState | null>(null);
  const [dateModal, setDateModal] = useState<ApiRecord | null>(null);
  const [pending, start] = useTransition();
  const today = todayKey();
  const perDay = useMemo(() => byDay(carousels, "tanggal_posting"), [carousels]);
  const planned = useMemo(() => Object.fromEntries(Object.entries(perDay).map(([key, rows]) => [key, rows.map((row) => text(row.status) || "Draft")])), [perDay]);
  const weeks = useMemo(() => groupByWeek(carousels, "tanggal_posting", today), [carousels, today]);
  const toggles = useWeekToggles(weeks.map((w) => w.start));
  const shownModal = modal || (adding ? { plan: null, preset: {} } : null);
  const close = () => { setModal(null); onAdded(); };

  return (
    <>
      <div className={s.tools}><AiBar kind="carousel" onParsed={(data) => setModal({ plan: null, preset: { judul: text(data.judul), tanggal_posting: dayKey(data.tanggal_posting), funnel: text(data.funnel) || "TOFU", cta: text(data.cta) || null, status: text(data.status) === "Done" ? "Done" : "Draft" } })} /><LinksBar kind="cp" links={links} /></div>
      <div className={s.planner}>
        <PlannerCalendar
          itemsFor={(day) => (perDay[day] || []).map((plan) => ({ id: text(plan.id), title: text(plan.judul) || "Untitled", done: text(plan.status) === "Done" }))}
          label="Carousel calendar"
          onEmptyDay={(day) => setModal({ plan: null, preset: { tanggal_posting: day } })}
          onItem={(id) => { const plan = carousels.find((row) => text(row.id) === id); if (plan) setModal({ plan, preset: {} }); }}
        />
        <section aria-label="Carousel agenda" className={s.agenda}>
          {!carousels.length ? <p className={s.empty}>No carousel plans yet. Pick a day on the calendar or use “Add carousel plan”.</p> : weeks.map((week) => (
            <WeekGroup count={week.items.length} done={week.done} key={week.start} label={week.label} onToggle={() => toggles.toggle(week.start)} open={toggles.isOpen(week.start)} range={week.range}>
              <ul className={s.rows}>
                {week.items.map((plan) => {
                  const done = text(plan.status) === "Done";
                  const assignee = people.find((p) => String(p.id) === text(plan.assignee_id));
                  const title = text(plan.judul) || "Untitled";
                  return (
                    <li className={done ? s.rowDone : s.row} key={text(plan.id)}>
                      <button aria-label={done ? `Mark as draft: ${title}` : `Mark done: ${title}`} aria-pressed={done} className={done ? s.checkOn : s.check} disabled={pending} onClick={() => start(() => { void setCarouselStatusAction(text(plan.id), done ? "Draft" : "Done"); })} type="button"><i className="ti ti-check" aria-hidden="true" /></button>
                      <div className={s.rowMain}>
                        <button className={s.rowTitle} onClick={() => setModal({ plan, preset: {} })} type="button">{title}</button>
                        <span className={s.rowMeta}>
                          <button className={s.dateButton} onClick={() => setDateModal(plan)} type="button"><i className="ti ti-calendar" aria-hidden="true" /> {dayKey(plan.tanggal_posting) ? weekdayDay(dayKey(plan.tanggal_posting)) : "No date"}</button>
                          <span>{text(plan.funnel) || "TOFU"}</span>
                          {plan.cta ? <span>CTA: {text(plan.cta)}</span> : null}
                        </span>
                        <span className={s.rowLinks}><CarouselLinkCell kind="brief" plan={plan} /><CarouselLinkCell kind="referensi" plan={plan} /></span>
                      </div>
                      {assignee ? <span className={s.person} title={text(assignee.nama)}>{initials(text(assignee.nama))}</span> : <span className={s.personEmpty} title="No assignee">?</span>}
                      <button aria-label={`Edit ${title}`} className={s.iconButton} onClick={() => setModal({ plan, preset: {} })} type="button"><i className="ti ti-pencil" aria-hidden="true" /></button>
                    </li>
                  );
                })}
              </ul>
            </WeekGroup>
          ))}
        </section>
      </div>
      {shownModal ? <CarouselModal ctas={ctas} onClose={close} people={people} planned={planned} state={shownModal} /> : null}
      {dateModal ? (
        <Modal onClose={() => setDateModal(null)} size="sm" title="Change posting date">
          <DatePicker onPick={(key) => start(() => { void setCarouselDateAction(text(dateModal.id), key); setDateModal(null); })} planned={planned} selected={dayKey(dateModal.tanggal_posting) || todayKey()} />
        </Modal>
      ) : null}
    </>
  );
}

// A carousel plan carries two reference URLs — the brief and a visual reference — with the same inline edit.
const CAROUSEL_LINK_KINDS = {
  brief: { field: "link_brief", icon: "ti-file-text", label: "Brief", addLabel: "Add brief link", save: setCarouselLinkBriefAction },
  referensi: { field: "link_referensi", icon: "ti-photo", label: "Reference", addLabel: "Add reference link", save: setCarouselLinkReferensiAction },
} as const;

function CarouselLinkCell({ plan, kind }: { plan: ApiRecord; kind: keyof typeof CAROUSEL_LINK_KINDS }) {
  const { field, icon, label, addLabel, save } = CAROUSEL_LINK_KINDS[kind];
  const current = text(plan[field]);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(current);
  const [pending, start] = useTransition();
  const commit = () => start(() => { void save(text(plan.id), url || null); setEditing(false); });
  const edit = () => { setUrl(current); setEditing(true); };

  if (editing) {
    return (
      <span className={s.inlineLink}>
        <input aria-label={`${label} link`} autoFocus className={s.input} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") commit(); if (event.key === "Escape") setEditing(false); }} placeholder="https://…" type="url" value={url} />
        <button className={s.primarySm} disabled={pending} onClick={commit} type="button">Save link</button>
        <button className={s.ghostSm} onClick={() => setEditing(false)} type="button">Cancel</button>
      </span>
    );
  }
  if (current) {
    return (
      <span className={s.refLink}>
        <a href={current} rel="noopener noreferrer" target="_blank"><i className={`ti ${icon}`} aria-hidden="true" /> {label}</a>
        <button aria-label={`Change ${label.toLowerCase()} link`} onClick={edit} type="button"><i className="ti ti-pencil" aria-hidden="true" /></button>
      </span>
    );
  }
  return <button className={s.refAdd} onClick={edit} type="button"><i className="ti ti-plus" aria-hidden="true" /> {addLabel}</button>;
}

function CarouselModal({ state, ctas, people, planned, onClose }: { state: CarouselModalState; ctas: ApiRecord[]; people: ApiRecord[]; planned: Record<string, string[]>; onClose: () => void }) {
  const plan = state.plan;
  const [judul, setJudul] = useState(text(plan?.judul) || text(state.preset.judul));
  const [tanggal, setTanggal] = useState(dayKey(plan?.tanggal_posting) || state.preset.tanggal_posting || todayKey());
  const [funnel, setFunnel] = useState(text(plan?.funnel) || state.preset.funnel || "TOFU");
  const [cta, setCta] = useState(text(plan?.cta) || text(state.preset.cta));
  const [assignee, setAssignee] = useState(text(plan?.assignee_id));
  const [status, setStatus] = useState(text(plan?.status) || state.preset.status || "Draft");
  const [linkBrief, setLinkBrief] = useState(text(plan?.link_brief));
  const [linkReferensi, setLinkReferensi] = useState(text(plan?.link_referensi));
  const [pending, start] = useTransition();
  const req = useRequired();

  function save() {
    if (!req.check(judul)) return;
    const input: CarouselPlanInput = { judul, tanggal_posting: tanggal, funnel, cta: cta || null, assignee_id: assignee || null, status, link_brief: linkBrief || null, link_referensi: linkReferensi || null };
    start(async () => { if (plan) await updateCarouselPlanAction(text(plan.id), input); else await createCarouselPlanAction(input); onClose(); });
  }
  async function remove() {
    if (!plan || !(await confirmAction({ title: "Delete this carousel plan?", message: "This cannot be undone.", confirmLabel: "Delete carousel plan", danger: true }))) return;
    start(async () => { await deleteCarouselPlanAction(text(plan.id)); onClose(); });
  }
  async function addCta() {
    const label = await askText({ title: "Add CTA", label: "CTA text", submitLabel: "Add CTA", placeholder: "e.g. Register now" });
    if (!label) return;
    start(async () => { const row = await createCtaAction(label); setCta(row.label); });
  }

  return (
    <Modal onClose={onClose} title={`${plan ? "Edit" : "Add"} carousel plan`}
      footer={<>
        {plan ? <button className={s.dangerSm} onClick={remove} type="button"><i className="ti ti-trash" aria-hidden="true" /> Delete carousel plan</button> : null}
        <span className={s.spacer} />
        <button className={s.ghostSm} onClick={onClose} type="button">Cancel</button>
        <button className={s.primarySm} disabled={pending} onClick={save} type="button"><i className="ti ti-check" aria-hidden="true" /> Save carousel plan</button>
      </>}
    >
      <Field label="Title" required><input aria-invalid={req.invalid || undefined} autoFocus className={req.invalid ? s.inputInvalid : s.input} onChange={(event) => { setJudul(event.target.value); req.clear(); }} placeholder="Carousel content title…" id={req.id} value={judul} /></Field>
      <div className={s.formSplit}>
        <Field label="Posting date"><DatePicker onPick={setTanggal} planned={planned} selected={tanggal} /></Field>
        <div className={s.formStack}>
          <Field label="Status"><select className={s.input} onChange={(event) => setStatus(event.target.value)} value={status}>{["Draft", "Done"].map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>
          <Field label="Funnel"><select className={s.input} onChange={(event) => setFunnel(event.target.value)} value={funnel}>{["TOFU", "MOFU", "BOFU"].map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>
          <Field label="CTA">
            <span className={s.inputRow}>
              <select className={s.input} onChange={(event) => setCta(event.target.value)} value={cta}>
                <option value="">Select CTA</option>
                {ctas.map((option) => <option key={text(option.id)} value={text(option.label)}>{text(option.label)}</option>)}
                {cta && !ctas.some((option) => text(option.label) === cta) ? <option value={cta}>{cta}</option> : null}
              </select>
              <button className={s.ghostSm} onClick={addCta} type="button">New CTA</button>
            </span>
          </Field>
          <Field label="Assignee"><select className={s.input} onChange={(event) => setAssignee(event.target.value)} value={assignee}><option value="">No assignee</option>{people.map((person) => <option key={text(person.id)} value={text(person.id)}>{text(person.nama)}</option>)}</select></Field>
        </div>
      </div>
      <Field label="Brief link" optional><input className={s.input} onChange={(event) => setLinkBrief(event.target.value)} placeholder="https://docs.google.com/…" value={linkBrief} /></Field>
      <Field label="Reference link" optional><input className={s.input} onChange={(event) => setLinkReferensi(event.target.value)} placeholder="https://…" value={linkReferensi} /></Field>
    </Modal>
  );
}

/* ══════════════ STORIES ══════════════ */
function StoryView({ dates, items, links, adding, onAdded }: { dates: ApiRecord[]; items: ApiRecord[]; links: ApiRecord[]; adding: boolean; onAdded: () => void }) {
  const [addModal, setAddModal] = useState<{ preDate?: string; items: string[] } | null>(null);
  const [pending, start] = useTransition();
  const today = todayKey();
  const itemsByDate = useMemo(() => {
    const map: Record<string, ApiRecord[]> = {};
    items.forEach((item) => { (map[text(item.date_id)] ||= []).push(item); });
    Object.values(map).forEach((list) => list.sort((a, b) => Number(a.urutan || 0) - Number(b.urutan || 0)));
    return map;
  }, [items]);
  const perDay = useMemo(() => byDay(dates, "tanggal"), [dates]);
  const planned = useMemo(() => Object.fromEntries(Object.entries(perDay).map(([key, rows]) => [key, rows.map((row) => text(row.status) || "Draft")])), [perDay]);
  const weeks = useMemo(() => groupByWeek(dates, "tanggal", today), [dates, today]);
  const toggles = useWeekToggles(weeks.map((w) => w.start));
  // Search result opened: open the week that holds the date so its card can be shown.
  useRecordFocus((id) => { const week = weeks.find((w) => w.items.some((date) => text(date.id) === id)); if (week) toggles.open(week.start); });
  const shownModal = addModal || (adding ? { items: [] } : null);
  const close = () => { setAddModal(null); onAdded(); };
  const scrollTo = (id: string) => { const week = weeks.find((w) => w.items.some((date) => text(date.id) === id)); if (week) toggles.open(week.start); requestAnimationFrame(() => document.querySelector(`[data-record-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })); };

  return (
    <>
      <div className={s.tools}><AiBar kind="story" onParsed={(data) => setAddModal({ preDate: dayKey(data.tanggal) || undefined, items: Array.isArray(data.items) ? (data.items as Array<{ isi?: string }>).map((it) => text(it.isi)).filter(Boolean) : [] })} /><LinksBar kind="sp" links={links} /></div>
      <div className={s.planner}>
        <PlannerCalendar
          itemsFor={(day) => (perDay[day] || []).map((date) => ({ id: text(date.id), title: (() => { const n = (itemsByDate[text(date.id)] || []).length; return `${n} ${n === 1 ? "story" : "stories"}`; })(), done: text(date.status) === "Done" }))}
          label="Story calendar"
          onEmptyDay={(day) => { const existing = perDay[day]?.[0]; if (existing) scrollTo(text(existing.id)); else setAddModal({ preDate: day, items: [] }); }}
          onItem={scrollTo}
        />
        <section aria-label="Story agenda" className={s.agenda}>
          {!dates.length ? <p className={s.empty}>No story dates yet. Pick a day on the calendar or use “Add story date”.</p> : weeks.map((week) => (
            <WeekGroup count={week.items.length} done={week.done} key={week.start} label={week.label} onToggle={() => toggles.toggle(week.start)} open={toggles.isOpen(week.start)} range={week.range}>
              {week.items.map((date) => <StoryDateCard date={date} items={itemsByDate[text(date.id)] || []} key={text(date.id)} pending={pending} start={start} />)}
            </WeekGroup>
          ))}
        </section>
      </div>
      {shownModal ? <StoryDateModal onClose={close} planned={planned} preDate={shownModal.preDate} presetItems={shownModal.items} /> : null}
    </>
  );
}

function StoryDateCard({ date, items, pending, start }: { date: ApiRecord; items: ApiRecord[]; pending: boolean; start: (cb: () => void) => void }) {
  const done = text(date.status) === "Done";
  const label = dayKey(date.tanggal) ? weekdayDay(dayKey(date.tanggal)) : "No date";
  return (
    <article className={done ? s.storyDone : s.story} data-record-id={text(date.id)}>
      <header className={s.storyHead}>
        <button aria-label={done ? `Mark as draft: ${label}` : `Mark posted: ${label}`} aria-pressed={done} className={done ? s.checkOn : s.check} disabled={pending} onClick={() => start(() => { void setStoryPlanStatusAction(text(date.id), done ? "Draft" : "Done"); })} type="button"><i className="ti ti-check" aria-hidden="true" /></button>
        <div className={s.storyTitle}><b>{label}</b><small>{items.length} stor{items.length === 1 ? "y" : "ies"}{done ? " · posted" : ""}</small></div>
        <button aria-label="Delete story date" className={s.iconButton} onClick={async () => { if (await confirmAction({ title: "Delete this story date?", message: "All story slides on this date are deleted too. This cannot be undone.", confirmLabel: "Delete story date", danger: true })) start(() => { void deleteStoryDateAction(text(date.id)); }); }} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
      </header>
      <ol className={s.slides}>
        {items.map((item, index) => <StoryItemRow index={index} item={item} key={`${text(item.id)}:${text(item.isi)}`} start={start} />)}
      </ol>
      <button className={s.addSlide} onClick={() => start(() => { void addStoryItemAction(text(date.id)); })} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add story</button>
    </article>
  );
}

function StoryItemRow({ item, index, start }: { item: ApiRecord; index: number; start: (cb: () => void) => void }) {
  return (
    <li className={s.slide}>
      <span className={s.slideNo}>{index + 1}</span>
      <input aria-label={`Story ${index + 1}`} className={s.slideInput} defaultValue={text(item.isi)} onBlur={(event) => { if (event.target.value !== text(item.isi)) { const value = event.target.value; start(() => { void updateStoryItemAction(text(item.id), value); }); } }} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }} placeholder="What this story says…" />
      <button aria-label="Delete story slide" className={s.iconButton} onClick={async () => { if (await confirmAction({ title: "Delete this story slide?", confirmLabel: "Delete story slide", danger: true })) start(() => { void deleteStoryItemAction(text(item.id)); }); }} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
    </li>
  );
}

function StoryDateModal({ preDate, presetItems, planned, onClose }: { preDate?: string; presetItems: string[]; planned: Record<string, string[]>; onClose: () => void }) {
  const [tanggal, setTanggal] = useState(preDate || todayKey());
  const [stories, setStories] = useState<string[]>(() => [...presetItems, ...Array(Math.max(3 - presetItems.length, 0)).fill("")]);
  const [pending, start] = useTransition();
  const req = useRequired();
  function save() {
    const filled = stories.map((v) => v.trim()).filter(Boolean);
    if (!filled.length) { req.check(""); return; }
    start(async () => { await createStoryDateAction({ tanggal, items: filled }); onClose(); });
  }
  return (
    <Modal onClose={onClose} size="md" title="Add story date"
      footer={<>
        <span className={s.spacer} />
        <button className={s.ghostSm} onClick={onClose} type="button">Cancel</button>
        <button className={s.primarySm} disabled={pending} onClick={save} type="button"><i className="ti ti-check" aria-hidden="true" /> Save story date</button>
      </>}
    >
      <div className={s.formSplit}>
        <Field label="Date" required><DatePicker onPick={setTanggal} planned={planned} selected={tanggal} /></Field>
        <div className={s.formStack}>
          <p className={s.hint}>{shortDay(tanggal)} · at least one story</p>
          {stories.map((value, index) => (
            <Field key={index} label={`Story ${index + 1}`} optional={index > 0} required={index === 0}>
              <input aria-invalid={(index === 0 && req.invalid) || undefined} className={index === 0 && req.invalid ? s.inputInvalid : s.input} onChange={(event) => { setStories((list) => list.map((item, i) => (i === index ? event.target.value : item))); if (index === 0) req.clear(); }} placeholder={`Context, title or goal of story ${index + 1}…`} id={index === 0 ? req.id : undefined} value={value} />
            </Field>
          ))}
          <button className={s.addSlide} onClick={() => setStories((list) => [...list, ""])} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add story</button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════ KOL LIST ══════════════ */
// A KOL can hold Instagram, TikTok and LinkedIn at once. link_ig / link_tiktok are legacy profile-URL overrides.
function kolPlatforms(kol: ApiRecord) {
  const igLink = text(kol.link_ig) || (text(kol.username_ig) ? `https://instagram.com/${text(kol.username_ig)}` : "");
  const ttLink = text(kol.link_tiktok) || (text(kol.username_tiktok) ? `https://tiktok.com/@${text(kol.username_tiktok)}` : "");
  const linkedin = text(kol.linkedin_url);
  const chips: Array<{ key: string; icon: string; label: string; count: string; href: string }> = [];
  if (igLink) chips.push({ key: "ig", icon: "ti-brand-instagram", label: "Instagram", count: fmtFollowers(Number(kol.followers_ig)), href: igLink });
  if (ttLink) chips.push({ key: "tiktok", icon: "ti-brand-tiktok", label: "TikTok", count: fmtFollowers(Number(kol.followers_tiktok)), href: ttLink });
  if (linkedin) chips.push({ key: "linkedin", icon: "ti-brand-linkedin", label: "LinkedIn", count: "", href: linkedin });
  return chips;
}

function KolView({ kols, adding, onAdded }: { kols: ApiRecord[]; adding: boolean; onAdded: () => void }) {
  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState("");
  const [modal, setModal] = useState<{ kol: ApiRecord | null } | null>(null);
  const [pending, start] = useTransition();
  const niches = useMemo(() => [...new Set(kols.map((k) => text(k.niche)).filter(Boolean))].sort(), [kols]);
  const filtered = kols.filter((k) => {
    const q = search.toLowerCase();
    if (q && ![k.nama, k.username_ig, k.username_tiktok].some((value) => text(value).toLowerCase().includes(q))) return false;
    return !niche || text(k.niche) === niche;
  });
  const shown = modal || (adding ? { kol: null } : null);
  const close = () => { setModal(null); onAdded(); };

  return (
    <section aria-label="KOL list" className={s.directory}>
      <div className={s.toolbar}>
        <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search KOLs" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or username…" value={search} /></label>
        <div className={s.pills} role="group" aria-label="Niche">
          {[["", "All", kols.length] as const, ...niches.map((n) => [n, n, kols.filter((k) => text(k.niche) === n).length] as const)].map(([value, label, count]) => (
            <button aria-pressed={niche === value} className={niche === value ? s.pillOn : s.pill} key={value || "all"} onClick={() => setNiche(value)} type="button">{label} <span>{count}</span></button>
          ))}
        </div>
      </div>
      {!filtered.length ? <p className={s.empty}>{kols.length ? "No KOLs match." : "No KOLs yet."}</p> : (
        <ul className={s.cards}>
          {filtered.map((k) => {
            const name = text(k.nama) || "Unnamed";
            return (
              <li className={s.personCard} key={text(k.id)}>
                <div className={s.personHead}>
                  <Avatar large name={name} url={text(k.foto_url)} />
                  <div className={s.personName}><b>{name}</b>{k.niche ? <small>{text(k.niche)}</small> : null}</div>
                </div>
                {kolPlatforms(k).length ? <div className={s.platforms}>{kolPlatforms(k).map((chip) => <a href={chip.href} key={chip.key} rel="noopener noreferrer" target="_blank"><i className={`ti ${chip.icon}`} aria-hidden="true" /> {chip.count || chip.label}</a>)}</div> : null}
                <dl className={s.facts}>
                  {k.rate_card_text ? <div><dt>Rate</dt><dd>{text(k.rate_card_text)}</dd></div> : null}
                  {k.contact ? <div><dt>Contact</dt><dd>{text(k.contact)}</dd></div> : null}
                </dl>
                {k.catatan ? <p className={s.note}>{text(k.catatan)}</p> : null}
                <div className={s.cardActions}>
                  {k.rate_card_file_url ? <a className={s.ghostSm} href={text(k.rate_card_file_url)} rel="noopener noreferrer" target="_blank"><i className="ti ti-file" aria-hidden="true" /> Rate card</a> : null}
                  <span className={s.spacer} />
                  <button aria-label={`Edit ${name}`} className={s.iconButton} onClick={() => setModal({ kol: k })} type="button"><i className="ti ti-pencil" aria-hidden="true" /></button>
                  <button aria-label="Delete KOL" className={s.iconDanger} disabled={pending} onClick={async () => { if (await confirmAction({ title: `Delete ${name}?`, confirmLabel: "Delete KOL", danger: true })) start(() => { void deleteKolAction(text(k.id)); }); }} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {shown ? <KolModal kol={shown.kol} onClose={close} /> : null}
    </section>
  );
}

function KolModal({ kol, onClose }: { kol: ApiRecord | null; onClose: () => void }) {
  const [form, setForm] = useState<KolInput>({
    nama: text(kol?.nama), niche: text(kol?.niche),
    username_ig: text(kol?.username_ig), followers_ig: Number(kol?.followers_ig) || null,
    username_tiktok: text(kol?.username_tiktok), followers_tiktok: Number(kol?.followers_tiktok) || null,
    linkedin_url: text(kol?.linkedin_url), rate_card_text: text(kol?.rate_card_text),
    rate_card_file_url: text(kol?.rate_card_file_url), foto_url: text(kol?.foto_url),
    catatan: text(kol?.catatan), contact: text(kol?.contact),
  });
  const [pending, start] = useTransition();
  const req = useRequired();
  const set = (patch: Partial<KolInput>) => setForm((f) => ({ ...f, ...patch }));
  function save() {
    if (!req.check(text(form.nama))) return;
    start(async () => { if (kol) await updateKolAction(text(kol.id), form); else await createKolAction(form); onClose(); });
  }
  return (
    <Modal onClose={onClose} title={`${kol ? "Edit" : "Add"} KOL`}
      footer={<><span className={s.spacer} /><button className={s.ghostSm} onClick={onClose} type="button">Cancel</button><button className={s.primarySm} disabled={pending} onClick={save} type="button"><i className="ti ti-check" aria-hidden="true" /> Save KOL</button></>}
    >
      <div className={s.formGrid}>
        <Field label="Name" required><input aria-invalid={req.invalid || undefined} autoFocus className={req.invalid ? s.inputInvalid : s.input} onChange={(event) => { set({ nama: event.target.value }); req.clear(); }} id={req.id} value={text(form.nama)} /></Field>
        <Field label="Niche"><input className={s.input} onChange={(event) => set({ niche: event.target.value })} placeholder="e.g. Career / Finance" value={text(form.niche)} /></Field>
        <Field label="Instagram username" optional><input className={s.input} onChange={(event) => set({ username_ig: event.target.value })} placeholder="without @" value={text(form.username_ig)} /></Field>
        <Field label="Instagram followers" optional><input className={s.input} min={0} onChange={(event) => set({ followers_ig: event.target.value === "" ? null : Number(event.target.value) })} type="number" value={form.followers_ig ?? ""} /></Field>
        <Field label="TikTok username" optional><input className={s.input} onChange={(event) => set({ username_tiktok: event.target.value })} placeholder="without @" value={text(form.username_tiktok)} /></Field>
        <Field label="TikTok followers" optional><input className={s.input} min={0} onChange={(event) => set({ followers_tiktok: event.target.value === "" ? null : Number(event.target.value) })} type="number" value={form.followers_tiktok ?? ""} /></Field>
        <Field label="LinkedIn URL" optional><input className={s.input} onChange={(event) => set({ linkedin_url: event.target.value })} placeholder="https://linkedin.com/in/…" value={text(form.linkedin_url)} /></Field>
        <Field label="Contact" optional><input className={s.input} onChange={(event) => set({ contact: event.target.value })} placeholder="WhatsApp / email" value={text(form.contact)} /></Field>
      </div>
      <Field label="Rate card" optional><textarea className={s.textarea} onChange={(event) => set({ rate_card_text: event.target.value })} placeholder="e.g. 1 feed + 3 stories — Rp 2.500.000" value={text(form.rate_card_text)} /></Field>
      <div className={s.formGrid}>
        <Field label="Rate card file URL" optional><input className={s.input} onChange={(event) => set({ rate_card_file_url: event.target.value })} placeholder="https://…" value={text(form.rate_card_file_url)} /></Field>
        <Field label="Photo URL" optional><input className={s.input} onChange={(event) => set({ foto_url: event.target.value })} placeholder="https://…" value={text(form.foto_url)} /></Field>
      </div>
      <Field label="Notes" optional><textarea className={s.textarea} onChange={(event) => set({ catatan: event.target.value })} value={text(form.catatan)} /></Field>
    </Modal>
  );
}

/* ══════════════ MT STORY ══════════════ */
function MtView({ stories, adding, onAdded }: { stories: ApiRecord[]; adding: boolean; onAdded: () => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "posted" | "unposted">("all");
  const [modal, setModal] = useState<{ story: ApiRecord | null } | null>(null);
  const [pending, start] = useTransition();
  const postedCount = stories.filter((st) => st.is_posted).length;
  const filtered = stories.filter((st) => {
    if (filter === "posted" && !st.is_posted) return false;
    if (filter === "unposted" && st.is_posted) return false;
    const q = search.toLowerCase();
    return !q || text(st.nama).toLowerCase().includes(q) || text(st.perusahaan).toLowerCase().includes(q);
  });
  const shown = modal || (adding ? { story: null } : null);
  const close = () => { setModal(null); onAdded(); };
  const options: Array<[typeof filter, string, number]> = [["all", "All", stories.length], ["unposted", "Not posted", stories.length - postedCount], ["posted", "Posted", postedCount]];

  return (
    <section aria-label="MT Story" className={s.directory}>
      <div className={s.toolbar}>
        <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search MT stories" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or company…" value={search} /></label>
        <div className={s.pills} role="group" aria-label="Posted">
          {options.map(([value, label, count]) => <button aria-pressed={filter === value} className={filter === value ? s.pillOn : s.pill} key={value} onClick={() => setFilter(value)} type="button">{label} <span>{count}</span></button>)}
        </div>
      </div>
      {!filtered.length ? <p className={s.empty}>{stories.length ? "No MT stories match." : "No MT stories yet."}</p> : (
        <ul className={s.cards}>
          {filtered.map((st) => {
            const name = text(st.nama) || "Unnamed"; const posted = Boolean(st.is_posted);
            const links = [["IG", st.ig_url, "ti-brand-instagram"], ["LinkedIn", st.linkedin_url, "ti-brand-linkedin"], ["Brief", st.brief_url, "ti-file-text"]].filter(([, url]) => text(url));
            const wa = text(st.wa).replace(/\D/g, "").replace(/^0/, "62");
            return (
              <li className={posted ? s.personCardMuted : s.personCard} key={text(st.id)}>
                <div className={s.personHead}>
                  <Avatar large name={name} url={text(st.foto_url)} />
                  <div className={s.personName}><b>{name}</b><small>{[text(st.perusahaan), text(st.batch)].filter(Boolean).join(" · ") || "—"}</small></div>
                  {posted ? <span className={s.postedChip}><i className="ti ti-check" aria-hidden="true" /> Posted</span> : null}
                </div>
                {st.deskripsi ? <p className={s.note}>{text(st.deskripsi)}</p> : null}
                {links.length ? <div className={s.platforms}>{links.map(([label, url, icon]) => <a href={text(url)} key={text(label)} rel="noopener noreferrer" target="_blank"><i className={`ti ${text(icon)}`} aria-hidden="true" /> {text(label)}</a>)}</div> : null}
                <div className={s.cardActions}>
                  {wa ? <a aria-label={`WhatsApp ${name}`} className={s.iconButton} href={`https://wa.me/${wa}`} rel="noopener noreferrer" target="_blank"><i className="ti ti-brand-whatsapp" aria-hidden="true" /></a> : null}
                  <button aria-label={`Edit ${name}`} className={s.iconButton} onClick={() => setModal({ story: st })} type="button"><i className="ti ti-pencil" aria-hidden="true" /></button>
                  <button aria-label="Delete MT story" className={s.iconDanger} disabled={pending} onClick={async () => { if (await confirmAction({ title: `Delete the MT story of ${name}?`, confirmLabel: "Delete MT story", danger: true })) start(() => { void deleteMtStoryAction(text(st.id)); }); }} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
                  <span className={s.spacer} />
                  {!posted ? <button className={s.primarySm} disabled={pending} onClick={() => start(() => { void setMtPostedAction(text(st.id), true); })} type="button">Mark as posted</button> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {shown ? <MtModal onClose={close} story={shown.story} /> : null}
    </section>
  );
}

function MtModal({ story, onClose }: { story: ApiRecord | null; onClose: () => void }) {
  const [form, setForm] = useState<MtStoryInput>({
    nama: text(story?.nama), perusahaan: text(story?.perusahaan), batch: text(story?.batch), wa: text(story?.wa), deskripsi: text(story?.deskripsi),
    ig_url: text(story?.ig_url), linkedin_url: text(story?.linkedin_url), brief_url: text(story?.brief_url), foto_url: text(story?.foto_url), is_posted: Boolean(story?.is_posted),
  });
  const [pending, start] = useTransition();
  const req = useRequired();
  const set = (patch: Partial<MtStoryInput>) => setForm((f) => ({ ...f, ...patch }));
  function save() {
    if (!req.check(text(form.nama))) return;
    start(async () => { if (story) await updateMtStoryAction(text(story.id), form); else await createMtStoryAction(form); onClose(); });
  }
  return (
    <Modal onClose={onClose} title={`${story ? "Edit" : "Add"} MT story`}
      footer={<><span className={s.spacer} /><button className={s.ghostSm} onClick={onClose} type="button">Cancel</button><button className={s.primarySm} disabled={pending} onClick={save} type="button"><i className="ti ti-check" aria-hidden="true" /> Save MT story</button></>}
    >
      <div className={s.formGrid}>
        <Field label="Name" required><input aria-invalid={req.invalid || undefined} autoFocus className={req.invalid ? s.inputInvalid : s.input} onChange={(event) => { set({ nama: event.target.value }); req.clear(); }} id={req.id} value={text(form.nama)} /></Field>
        <Field label="Company"><input className={s.input} onChange={(event) => set({ perusahaan: event.target.value })} value={text(form.perusahaan)} /></Field>
        <Field label="Batch"><input className={s.input} onChange={(event) => set({ batch: event.target.value })} value={text(form.batch)} /></Field>
        <Field label="WhatsApp"><input className={s.input} onChange={(event) => set({ wa: event.target.value })} placeholder="62…" value={text(form.wa)} /></Field>
      </div>
      <Field label="Description" optional><textarea className={s.textarea} onChange={(event) => set({ deskripsi: event.target.value })} value={text(form.deskripsi)} /></Field>
      <div className={s.formGrid}>
        <Field label="Instagram URL" optional><input className={s.input} onChange={(event) => set({ ig_url: event.target.value })} placeholder="https://…" value={text(form.ig_url)} /></Field>
        <Field label="LinkedIn URL" optional><input className={s.input} onChange={(event) => set({ linkedin_url: event.target.value })} placeholder="https://…" value={text(form.linkedin_url)} /></Field>
        <Field label="Brief URL" optional><input className={s.input} onChange={(event) => set({ brief_url: event.target.value })} placeholder="https://…" value={text(form.brief_url)} /></Field>
        <Field label="Photo URL" optional><input className={s.input} onChange={(event) => set({ foto_url: event.target.value })} placeholder="https://…" value={text(form.foto_url)} /></Field>
      </div>
      <label className={s.checkField}><input checked={Boolean(form.is_posted)} onChange={(event) => set({ is_posted: event.target.checked })} type="checkbox" /> Posted</label>
    </Modal>
  );
}
