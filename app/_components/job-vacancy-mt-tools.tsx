"use client";

import {
  createIndustryAction,
  createVacancyAction,
  deleteIndustryAction,
  deleteVacancyAction,
  updateVacancyAction,
  type VacancyInput,
} from "@/app/actions/job-vacancy-mt-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { companyHistory, filterVacancies, fmtShort, industryOf, industryRanking, list, monthsOf, MONTHS_FULL, MONTHS_SHORT, newsletterRows, openingsByMonth, toDate, vacancySummary, weekOfMonth, WEEK_RANGES, type VacancyFilter } from "@/lib/job-vacancy/view";
import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { confirmAction, notifyError } from "./app-dialog";
import { guard } from "./safe-action";
import { SheetImportPanel } from "./job-vacancy-mt-sheet-import";
import s from "./job-vacancy.module.css";
import { Pagination, usePagination } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";
import { useModal } from "./use-modal";

// Job Vacancy MT in the IJIS layout: an opening calendar (12 months) and industry ranking,
// vacancy cards with a month strip, a two-pane newsletter builder, company history and the
// industry list. Same data and actions as before.

// Preset industries always shown alongside saved mt_industries rows, so the dropdowns are never empty.
const DEFAULT_INDUSTRIES = ["Perbankan & Keuangan", "FMCG", "Telekomunikasi", "Energi & Pertambangan", "Manufaktur", "Retail & E-commerce", "Konsultasi", "Teknologi", "Logistik & Supply Chain", "Properti & Konstruksi", "BUMN", "Lainnya"];

type View = "overview" | "list" | "newsletter" | "company" | "industries";

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?"; }

export function JobVacancyMtTools({ rows, industries, referenceDate }: { rows: ApiRecord[]; industries: ApiRecord[]; referenceDate: string }) {
  const now = useMemo(() => new Date(referenceDate), [referenceDate]);
  const [view, setView] = useState<View>("overview");
  const [filter, setFilter] = useState<VacancyFilter>({ query: "", industry: "", month: "", year: "" });
  const [formState, setFormState] = useState<{ record: ApiRecord | null } | null>(null);
  const summary = useMemo(() => vacancySummary(rows, now), [rows, now]);
  // Search result opened: open the vacancy's edit form directly.
  useRecordFocus((id) => {
    const record = rows.find((row) => text(row.id) === id);
    if (!record) return;
    setFormState({ record });
    return true;
  });
  const industryNames = useMemo(() => {
    const seen = new Set<string>(); const out: string[] = [];
    for (const nama of [...industries.map((row) => text(row.nama)), ...DEFAULT_INDUSTRIES]) { const t = nama.trim(); if (!t || seen.has(t.toLowerCase())) continue; seen.add(t.toLowerCase()); out.push(t); }
    return out.sort((a, b) => a.localeCompare(b));
  }, [industries]);
  const openList = (patch: VacancyFilter) => { setFilter({ query: "", industry: "", month: "", year: "", ...patch }); setView("list"); };
  const views: Array<[View, string, number | null]> = [["overview", "Overview", null], ["list", "Vacancies", rows.length], ["newsletter", "Newsletter", null], ["company", "Companies", summary.companies], ["industries", "Industries", industryNames.length]];

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Operations</span>
          <h1>Job Vacancy MT</h1>
          <p>{summary.total} vacancies · {summary.openNow} open in {MONTHS_FULL[now.getMonth()]} · {summary.addedThisWeek} added this week</p>
        </div>
        <button className={s.primary} onClick={() => setFormState({ record: null })} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add vacancy</button>
      </header>

      <div className={s.segmented} role="tablist" aria-label="Job Vacancy view">
        {views.map(([id, label, count]) => <button aria-selected={view === id} className={view === id ? s.segmentActive : s.segment} key={id} onClick={() => setView(id)} role="tab" type="button">{label}{count !== null ? <span>{count}</span> : null}</button>)}
      </div>

      {view === "overview" ? <Overview now={now} onOpen={openList} rows={rows} /> : null}
      {view === "list" ? <VacancyList filter={filter} industryNames={industryNames} now={now} onEdit={(row) => setFormState({ record: row })} rows={rows} setFilter={setFilter} /> : null}
      {view === "newsletter" ? <Newsletter now={now} rows={rows} /> : null}
      {view === "company" ? <Companies rows={rows} /> : null}
      {view === "industries" ? <Industries industries={industries} names={industryNames} rows={rows} /> : null}

      {formState ? <VacancyForm industryNames={industryNames} onClose={() => setFormState(null)} record={formState.record} /> : null}
    </div>
  );
}

/* ── Shared UI ── */
function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { dialogProps, titleId, dismiss } = useModal(onClose);
  return (
    <div className={s.overlay} onClick={() => void dismiss()}>
      <div className={s.modal} onClick={(event) => event.stopPropagation()} {...dialogProps}>
        <div className={s.modalHeader}><div className={s.modalTitle} id={titleId}>{title}</div><button aria-label="Close" className={s.iconButton} onClick={() => void dismiss()} type="button"><i className="ti ti-x" aria-hidden="true" /></button></div>
        <div className={s.modalBody}>{children}</div>
        {footer ? <div className={s.modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, required, optional, hint, invalid, children }: { label: string; required?: boolean; optional?: boolean; hint?: string; invalid?: boolean; children: ReactNode }) {
  return (
    <div className={invalid ? s.fieldInvalid : s.field}>
      <span className={s.fieldLabel}>{label}{required ? <b className={s.req}> *</b> : null}{optional ? <span className={s.optional}> (optional)</span> : null}</span>
      {children}
      {hint ? <small className={s.fieldHint}>{hint}</small> : null}
    </div>
  );
}

function TagInput({ id, values, onChange, placeholder, ordered = false, label }: { id?: string; values: string[]; onChange: (next: string[]) => void; placeholder?: string; ordered?: boolean; label: string }) {
  const [draft, setDraft] = useState("");
  function commit() { const value = draft.trim(); if (!value) return; onChange([...values, value]); setDraft(""); }
  return (
    <div className={s.tagInput}>
      {values.map((value, index) => (
        <span className={s.tag} key={`${value}-${index}`} title={value}>
          {ordered ? <b>{index + 1}</b> : null}<span>{value.length > 34 ? `${value.slice(0, 34)}…` : value}</span>
          <button aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((_, i) => i !== index))} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
        </span>
      ))}
      <input aria-label={label} id={id} onBlur={commit} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} placeholder={placeholder} value={draft} />
    </div>
  );
}

/** Twelve small cells, the opening months filled; "now" outlined. */
function MonthStrip({ months, current }: { months: number[]; current?: number }) {
  return (
    <span aria-label={`Opens in ${months.map((m) => MONTHS_SHORT[m - 1]).join(", ") || "no month set"}`} className={s.strip} role="img">
      {MONTHS_SHORT.map((label, index) => <span className={`${months.includes(index + 1) ? s.stripOn : s.stripOff} ${current === index + 1 ? s.stripNow : ""}`} key={label} title={label}>{label[0]}</span>)}
    </span>
  );
}

/* ══════════════ OVERVIEW ══════════════ */
function Overview({ rows, now, onOpen }: { rows: ApiRecord[]; now: Date; onOpen: (patch: VacancyFilter) => void }) {
  const years = useMemo(() => [...new Set(rows.map((row) => text(row.year)).filter(Boolean))].sort().reverse(), [rows]);
  const [year, setYear] = useState(() => (years.includes(String(now.getFullYear())) ? String(now.getFullYear()) : years[0] || String(now.getFullYear())));
  const bars = useMemo(() => openingsByMonth(rows, year), [rows, year]);
  const ranking = useMemo(() => industryRanking(rows, now.getMonth() + 1), [rows, now]);
  const max = Math.max(1, ...bars);
  const maxCompanies = ranking[0]?.companies || 1;
  const openNow = rows.filter((row) => monthsOf(row).includes(now.getMonth() + 1) && text(row.year) === String(now.getFullYear()));

  if (!rows.length) return <p className={s.empty}>No vacancies yet. Add the first MT vacancy or import a sheet.</p>;
  return (
    <div className={s.overview}>
      <section aria-labelledby="jv-calendar" className={s.panelWide}>
        <div className={s.panelHead}>
          <div><h2 id="jv-calendar">Opening calendar</h2><p>Vacancies that open in each month · click a month to see them</p></div>
          <label className={s.filterPill}><span>Year</span><select aria-label="Year" onChange={(event) => setYear(event.target.value)} value={year}>{(years.length ? years : [year]).map((y) => <option key={y}>{y}</option>)}</select></label>
        </div>
        <div className={s.bars}>
          {bars.map((count, index) => (
            <button aria-label={`${MONTHS_FULL[index]} ${year}: ${count} vacancies`} className={year === String(now.getFullYear()) && index === now.getMonth() ? s.barNow : s.bar} disabled={!count} key={index} onClick={() => onOpen({ month: String(index + 1), year })} type="button">
              <b>{count || ""}</b>
              <span className={s.barTrack}><i style={{ height: `${(count / max) * 100}%` }} /></span>
              <small>{MONTHS_SHORT[index]}</small>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="jv-industries" className={s.panel}>
        <div className={s.panelHead}><div><h2 id="jv-industries">Industries</h2><p>Companies per industry · open in {MONTHS_SHORT[now.getMonth()]}</p></div></div>
        <ol className={s.ranking}>
          {ranking.map((item) => (
            <li key={item.name}>
              <button className={s.rank} onClick={() => onOpen({ industry: item.name })} type="button">
                <span className={s.rankText}><b>{item.name}</b><span className={s.rankBar}><i style={{ width: `${(item.companies / maxCompanies) * 100}%` }} /></span></span>
                <span className={s.rankCount}>{item.companies}</span>
                <span className={item.open ? s.chipStrong : s.chipMuted}>{item.open} open</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="jv-open-now" className={s.panel}>
        <div className={s.panelHead}><div><h2 id="jv-open-now">Open in {MONTHS_FULL[now.getMonth()]}</h2><p>{openNow.length} programs this month</p></div></div>
        {openNow.length ? (
          <ul className={s.openList}>
            {openNow.slice(0, 8).map((row) => (
              <li key={text(row.id)}><span className={s.logo} aria-hidden="true">{initials(text(row.company))}</span><span className={s.rowText}><b>{text(row.company)}</b><small>{text(row.program)}</small></span>{toDate(row.deadline) ? <span className={s.deadline}>until {fmtShort(toDate(row.deadline)!)}</span> : null}</li>
            ))}
          </ul>
        ) : <p className={s.emptySmall}>Nothing opens this month.</p>}
        {openNow.length > 8 ? <button className={s.linkButton} onClick={() => onOpen({ month: String(now.getMonth() + 1), year: String(now.getFullYear()) })} type="button">See all {openNow.length}</button> : null}
      </section>
    </div>
  );
}

/* ══════════════ VACANCIES ══════════════ */
function VacancyList({ rows, industryNames, filter, setFilter, now, onEdit }: { rows: ApiRecord[]; industryNames: string[]; filter: VacancyFilter; setFilter: (next: VacancyFilter) => void; now: Date; onEdit: (row: ApiRecord) => void }) {
  const [pending, start] = useTransition();
  const years = useMemo(() => [...new Set(rows.map((row) => text(row.year)).filter(Boolean))].sort().reverse(), [rows]);
  const filtered = useMemo(() => filterVacancies(rows, filter), [rows, filter]);
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);
  const set = (patch: VacancyFilter) => { setFilter({ ...filter, ...patch }); setPage(0); };
  const filtersOn = Object.values(filter).some(Boolean);

  return (
    <>
      <SheetImportPanel existingRows={rows} />
      <div className={s.toolbar}>
        <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search vacancies" onChange={(e) => set({ query: e.target.value })} placeholder="Search company or program…" value={filter.query} /></label>
        <label className={s.filterPill}><span>Industry</span><select aria-label="Filter industry" onChange={(e) => set({ industry: e.target.value })} value={filter.industry}><option value="">All</option>{industryNames.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className={s.filterPill}><span>Opens in</span><select aria-label="Filter opening month" onChange={(e) => set({ month: e.target.value })} value={filter.month}><option value="">Any month</option>{MONTHS_FULL.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label>
        <label className={s.filterPill}><span>Year</span><select aria-label="Filter year" onChange={(e) => set({ year: e.target.value })} value={filter.year}><option value="">All</option>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
        {filtersOn ? <button className={s.clear} onClick={() => set({ query: "", industry: "", month: "", year: "" })} type="button">Clear filters</button> : null}
      </div>
      <section aria-label="Vacancies" className={s.listCard}>
        <p className={s.count}>{filtered.length === rows.length ? `${rows.length} vacancies` : `${filtered.length} of ${rows.length} vacancies`}</p>
        {pageItems.length ? (
          <ul className={s.rows}>
            {pageItems.map((row) => {
              const created = toDate(row.created_at); const roles = list(row.roles); const links = list(row.career_links);
              const name = text(row.company) || "Untitled";
              return (
                <li className={s.row} data-record-id={text(row.id)} key={text(row.id)}>
                  <button className={s.rowMain} data-record-open onClick={() => onEdit(row)} type="button">
                    <span className={s.logo} aria-hidden="true">{initials(name)}</span>
                    <span className={`${s.rowText} ${s.colName}`}><b>{name}</b><small>{text(row.program) || "—"}</small></span>
                    <span className={`${s.rowText} ${s.colIndustry}`}><b className={s.rowSub}>{industryOf(row)}</b><small>{roles.length ? `${roles[0]}${roles.length > 1 ? ` +${roles.length - 1}` : ""}` : "No roles yet"}</small></span>
                    <span className={s.rowMonths}><MonthStrip current={text(row.year) === String(now.getFullYear()) ? now.getMonth() + 1 : undefined} months={monthsOf(row)} /><small>{text(row.year)}{text(row.deadline) && toDate(row.deadline) ? ` · until ${fmtShort(toDate(row.deadline)!)}` : ""}</small></span>
                    <span className={`${s.rowText} ${s.colAdded}`}><small>{created ? `Added ${fmtShort(created)}` : ""}</small><small>{created ? `Week ${weekOfMonth(created)}` : ""}</small></span>
                  </button>
                  <span className={s.rowActions}>
                    {links[0] ? <a aria-label={`Open career page of ${name}`} className={s.iconButton} href={links[0]} rel="noreferrer" target="_blank" title={links.length > 1 ? `${links.length} career links` : links[0]}><i className="ti ti-external-link" aria-hidden="true" /></a> : null}
                    <button aria-label="Delete vacancy" className={s.iconDanger} disabled={pending} onClick={async () => { if (await confirmAction({ title: "Delete this vacancy?", message: "This cannot be undone.", confirmLabel: "Delete vacancy", danger: true })) start(() => guard(async () => { await deleteVacancyAction(text(row.id)); }, "Could not delete the vacancy.")); }} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className={s.empty}>{rows.length ? "No vacancies match these filters." : "No vacancies yet."}</p>}
        <Pagination onChange={setPage} page={page} totalPages={totalPages} />
      </section>
    </>
  );
}

/* ══════════════ VACANCY FORM ══════════════ */
type Missing = "company" | "industry" | "program" | "months" | "links";
function VacancyForm({ record, industryNames, onClose }: { record: ApiRecord | null; industryNames: string[]; onClose: () => void }) {
  const uid = useId();
  const [company, setCompany] = useState(text(record?.company));
  const [industry, setIndustry] = useState(text(record?.industry));
  const [program, setProgram] = useState(text(record?.program));
  const [roles, setRoles] = useState<string[]>(list(record?.roles));
  const [edu, setEdu] = useState(text(record?.edu));
  const [gpa, setGpa] = useState(text(record?.gpa));
  const [majors, setMajors] = useState<string[]>(list(record?.majors));
  const [placement, setPlacement] = useState<string[]>(list(record?.placement));
  const [otherReq, setOtherReq] = useState(text(record?.other_req));
  const [selection, setSelection] = useState<string[]>(list(record?.selection));
  const [duration, setDuration] = useState(text(record?.duration));
  const [openDate, setOpenDate] = useState(text(record?.open_date).slice(0, 10));
  const [deadline, setDeadline] = useState(text(record?.deadline).slice(0, 10));
  const [months, setMonths] = useState<number[]>(record ? monthsOf(record) : []);
  const [year, setYear] = useState(text(record?.year) || String(new Date().getFullYear()));
  const [careerLinks, setCareerLinks] = useState<string[]>(list(record?.career_links));
  const [refLinks, setRefLinks] = useState<string[]>(list(record?.ref_links));
  const [notes, setNotes] = useState(text(record?.notes));
  const [missing, setMissing] = useState<Missing[]>([]);
  const [pending, start] = useTransition();
  const createdAt = record?.created_at ? toDate(record.created_at) : null;
  const thisYear = new Date().getFullYear();
  const yearOptions = [...new Set([String(thisYear - 1), String(thisYear), String(thisYear + 1), year])].sort();
  const bad = (key: Missing) => missing.includes(key);
  const fix = (key: Missing) => setMissing((m) => m.filter((k) => k !== key));

  function save() {
    const gaps: Missing[] = [];
    if (!company.trim()) gaps.push("company"); if (!industry.trim()) gaps.push("industry"); if (!program.trim()) gaps.push("program");
    if (!months.length) gaps.push("months"); if (!careerLinks.length) gaps.push("links");
    if (gaps.length) { setMissing(gaps); document.getElementById(`${uid}-${gaps[0]}`)?.focus(); return; }
    const input: VacancyInput = { company, industry, program, roles, edu, gpa, majors, placement, other_req: otherReq, duration, selection, months, year, open_date: openDate || null, deadline: deadline || null, career_links: careerLinks, ref_links: refLinks, notes };
    start(async () => {
      try { if (record) await updateVacancyAction(text(record.id), input); else await createVacancyAction(input); onClose(); }
      catch (error) { notifyError(error, "Could not save vacancy."); }
    });
  }

  return (
    <Modal onClose={onClose} title={record ? `Edit vacancy — ${text(record.company)}` : "Add MT vacancy"}
      footer={<>
        {missing.length ? <span className={s.formError} role="status">Fill in the {missing.length} field{missing.length === 1 ? "" : "s"} marked in red.</span> : <span className={s.formNote}><i className="ti ti-clock" aria-hidden="true" /> Added {fmtShort(createdAt || new Date())}</span>}
        <span className={s.spacer} />
        <button className={s.ghostSm} onClick={onClose} type="button">Cancel</button>
        <button className={s.primarySm} disabled={pending} onClick={save} type="button"><i className="ti ti-device-floppy" aria-hidden="true" /> {record ? "Save changes" : "Save vacancy"}</button>
      </>}
    >
      <section className={s.formSection}>
        <h3><i className="ti ti-building" aria-hidden="true" /> Company</h3>
        <div className={s.formGrid}>
          <Field invalid={bad("company")} label="Company name" required><input className={s.input} id={`${uid}-company`} onChange={(e) => { setCompany(e.target.value); fix("company"); }} placeholder="e.g. Bank BCA" value={company} /></Field>
          <Field invalid={bad("industry")} label="Industry" required><select className={s.input} id={`${uid}-industry`} onChange={(e) => { setIndustry(e.target.value); fix("industry"); }} value={industry}><option value="">Select industry…</option>{industryNames.map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
          <div className={s.full}><Field invalid={bad("program")} label="MT program name" required><input className={s.input} id={`${uid}-program`} onChange={(e) => { setProgram(e.target.value); fix("program"); }} placeholder="e.g. Officer Development Program (ODP)" value={program} /></Field></div>
        </div>
      </section>
      <section className={s.formSection}>
        <h3><i className="ti ti-calendar" aria-hidden="true" /> When it opens</h3>
        <Field invalid={bad("months")} label="Opening months" required>
          <div className={s.monthPicker} id={`${uid}-months`} role="group" aria-label="Opening months" tabIndex={-1}>
            {MONTHS_SHORT.map((label, index) => { const m = index + 1; const on = months.includes(m); return <button aria-pressed={on} className={on ? s.monthOn : s.month} key={label} onClick={() => { setMonths(on ? months.filter((x) => x !== m) : [...months, m].sort((a, b) => a - b)); fix("months"); }} type="button">{label}</button>; })}
          </div>
        </Field>
        <div className={s.formGrid3}>
          <Field label="Opening year"><select className={s.input} onChange={(e) => setYear(e.target.value)} value={year}>{yearOptions.map((y) => <option key={y}>{y}</option>)}</select></Field>
          <Field label="Open date" optional><input className={s.input} onChange={(e) => setOpenDate(e.target.value)} type="date" value={openDate} /></Field>
          <Field label="Deadline" optional><input className={s.input} onChange={(e) => setDeadline(e.target.value)} type="date" value={deadline} /></Field>
          <Field label="Program duration"><input className={s.input} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 2 years, 18 months" value={duration} /></Field>
        </div>
      </section>
      <section className={s.formSection}>
        <h3><i className="ti ti-target" aria-hidden="true" /> Requirements</h3>
        <div className={s.formGrid}>
          <div className={s.full}><Field label="Roles"><TagInput label="Roles" onChange={setRoles} placeholder="Type, then press Enter…" values={roles} /></Field></div>
          <Field label="Education"><input className={s.input} onChange={(e) => setEdu(e.target.value)} placeholder="e.g. Min. S1, S1/S2" value={edu} /></Field>
          <Field label="Minimum GPA"><input className={s.input} onChange={(e) => setGpa(e.target.value)} placeholder="e.g. Min. 3.0" value={gpa} /></Field>
          <div className={s.full}><Field label="Majors"><TagInput label="Majors" onChange={setMajors} placeholder="Type a major, then press Enter…" values={majors} /></Field></div>
          <div className={s.full}><Field label="Placement"><TagInput label="Placement" onChange={setPlacement} placeholder="e.g. Jakarta, anywhere in Indonesia…" values={placement} /></Field></div>
          <div className={s.full}><Field label="Other requirements"><textarea className={s.textarea} onChange={(e) => setOtherReq(e.target.value)} placeholder="Any other requirements…" value={otherReq} /></Field></div>
          <div className={s.full}><Field hint="The first entry is step 1, the second step 2, and so on." label="Selection steps"><TagInput label="Selection steps" onChange={setSelection} ordered placeholder="Type a stage, then press Enter…" values={selection} /></Field></div>
        </div>
      </section>
      <section className={s.formSection}>
        <h3><i className="ti ti-link" aria-hidden="true" /> Links &amp; notes</h3>
        <Field hint="Shown in the customer newsletter." invalid={bad("links")} label="Career platform links" required><TagInput id={`${uid}-links`} label="Career platform links" onChange={(v) => { setCareerLinks(v); fix("links"); }} placeholder="Paste a link, then press Enter…" values={careerLinks} /></Field>
        <Field hint="Internal only — not shown in the newsletter." label="Research sources" optional><TagInput label="Research sources" onChange={setRefLinks} placeholder="Paste a research source link…" values={refLinks} /></Field>
        <Field label="Notes" optional><textarea className={s.textarea} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else worth knowing…" value={notes} /></Field>
      </section>
    </Modal>
  );
}

/* ══════════════ NEWSLETTER ══════════════ */
// The message text goes to customers, so it stays in Indonesian.
function buildWaText(rows: ApiRecord[], monLabel: string, week: number, industryLabel: string) {
  const waLines = rows.map((row, index) => {
    const links = list(row.career_links).map((link) => `🔗 ${link}`).join("\n");
    const selection = list(row.selection).length ? `📋 ${list(row.selection).join(" → ")}\n` : "";
    return `*${index + 1}. ${text(row.company)} — ${text(row.program)}*\n📌 ${list(row.roles).join(", ")}\n${selection}${links}`;
  }).join("\n\n");
  return `Halo! 👋

Update MT minggu ini (${monLabel}, minggu ke-${week}) 🎯
Ada *${rows.length} lowongan MT${industryLabel ? ` ${industryLabel}` : ""}* yang baru buka — jangan kelewatan!

${waLines}

━━━━━━━━━━━━━━
Udah tau cara lolos seleksinya belum? 👀
Ribuan freshgrad udah buktiin metode CCC —
cek sekarang → *careercclub.com* 🚀`;
}

function buildEmailText(rows: ApiRecord[], monLabel: string, weekRange: string, industryLabel: string) {
  const emailLines = rows.map((row, index) => {
    const links = list(row.career_links).map((link) => `   Link    : ${link}`).join("\n");
    const selection = list(row.selection).length ? `   Seleksi : ${list(row.selection).join(" → ")}\n` : "";
    return `${index + 1}. ${text(row.company).toUpperCase()}\n   Program : ${text(row.program)}\n   Role    : ${list(row.roles).join(", ")}\n${selection}${links}`;
  }).join("\n──────────────────────────\n");
  return `Subject: [MT Alert] ${rows.length} Loker MT Baru Minggu Ini — ${monLabel} Tgl ${weekRange}!

Halo!

Ini update MT${industryLabel ? ` industri ${industryLabel}` : ""} yang baru masuk minggu ini (${monLabel}, tgl ${weekRange}) 👇

──────────────────────────
${emailLines}
──────────────────────────

Udah punya strategi buat lolos seleksinya?

Ribuan freshgrad udah pakai metode CCC dan
berhasil tembus MT impian mereka. Kalau belum,
sekarang saat yang tepat 👇

→ careercclub.com

Semangat apply! 💪
Tim CareerCclub`;
}

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function Newsletter({ rows, now }: { rows: ApiRecord[]; now: Date }) {
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [week, setWeek] = useState(weekOfMonth(now));
  const [picked, setPicked] = useState<string[]>([]);
  const [output, setOutput] = useState<"wa" | "email">("wa");
  const [copied, setCopied] = useState(false);
  const present = useMemo(() => [...new Set(rows.map((row) => text(row.industry)).filter(Boolean))].sort(), [rows]);
  const shown = useMemo(() => newsletterRows(rows, month, year, week, picked), [rows, month, year, week, picked]);
  const industryLabel = picked.join(", ");
  const body = output === "wa" ? buildWaText(shown, MONTHS_ID[month], week, industryLabel) : buildEmailText(shown, MONTHS_ID[month], WEEK_RANGES[week - 1], industryLabel);
  function copy() {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    // The Clipboard API only exists on https; fall back to a hidden textarea elsewhere.
    if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(body).then(done).catch(() => notifyError(new Error("Copy was blocked by the browser."), "Could not copy.")); return; }
    const area = document.createElement("textarea"); area.value = body; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select();
    try { if (document.execCommand("copy")) done(); else notifyError(new Error("Copy is not available here."), "Could not copy."); } finally { area.remove(); }
  }

  return (
    <div className={s.newsletter}>
      <section aria-labelledby="nl-pick" className={s.panel}>
        <div className={s.panelHead}><div><h2 id="nl-pick">Which vacancies</h2><p>Added in the chosen week and opening that month. Career links are included; research sources are not.</p></div></div>
        <div className={s.formGrid}>
          <Field label="Month added"><select className={s.input} onChange={(e) => setMonth(Number(e.target.value))} value={month}>{MONTHS_FULL.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></Field>
          <Field label="Year"><select className={s.input} onChange={(e) => setYear(Number(e.target.value))} value={year}>{[year - 1, year, year + 1].map((y) => <option key={y}>{y}</option>)}</select></Field>
        </div>
        <Field label="Week">
          <div className={s.weekPicker} role="group" aria-label="Week">
            {[1, 2, 3, 4].map((w) => <button aria-pressed={week === w} className={week === w ? s.weekOn : s.week} key={w} onClick={() => setWeek(w)} type="button"><b>Week {w}</b><small>{WEEK_RANGES[w - 1]}</small></button>)}
          </div>
        </Field>
        {present.length ? (
          <Field label="Industries" hint={picked.length ? `${picked.length} selected` : "All industries"}>
            <div className={s.pills}>{present.map((ind) => { const on = picked.includes(ind); return <button aria-pressed={on} className={on ? s.pillOn : s.pill} key={ind} onClick={() => setPicked(on ? picked.filter((x) => x !== ind) : [...picked, ind])} type="button">{ind}</button>; })}</div>
          </Field>
        ) : null}
        <p className={s.matchCount}><b>{shown.length}</b> vacanc{shown.length === 1 ? "y" : "ies"} in this newsletter</p>
      </section>
      <section aria-labelledby="nl-out" className={s.panel}>
        <div className={s.panelHead}>
          <h2 id="nl-out">Message</h2>
          <div className={s.subTabs} role="tablist" aria-label="Channel">
            <button aria-selected={output === "wa"} className={output === "wa" ? s.subTabOn : s.subTab} onClick={() => setOutput("wa")} role="tab" type="button"><i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp</button>
            <button aria-selected={output === "email"} className={output === "email" ? s.subTabOn : s.subTab} onClick={() => setOutput("email")} role="tab" type="button"><i className="ti ti-mail" aria-hidden="true" /> Email</button>
          </div>
        </div>
        {shown.length ? (
          <>
            <pre className={s.output}>{body}</pre>
            <button className={s.primary} onClick={copy} type="button"><i className={`ti ${copied ? "ti-check" : "ti-copy"}`} aria-hidden="true" /> {copied ? "Copied" : "Copy message"}</button>
          </>
        ) : <p className={s.empty}>No vacancies were added in that week.</p>}
      </section>
    </div>
  );
}

/* ══════════════ COMPANIES ══════════════ */
function Companies({ rows }: { rows: ApiRecord[] }) {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const industries = useMemo(() => [...new Set(rows.map((row) => text(row.industry)).filter(Boolean))].sort(), [rows]);
  const companies = useMemo(() => companyHistory(filterVacancies(rows, { query: search, industry })), [rows, search, industry]);
  return (
    <>
      <div className={s.toolbar}>
        <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search companies" onChange={(e) => setSearch(e.target.value)} placeholder="Search company or program…" value={search} /></label>
        <label className={s.filterPill}><span>Industry</span><select aria-label="Filter company industry" onChange={(e) => setIndustry(e.target.value)} value={industry}><option value="">All</option>{industries.map((v) => <option key={v}>{v}</option>)}</select></label>
      </div>
      {companies.length ? (
        <ul className={s.companyGrid}>
          {companies.map((c) => (
            <li className={s.company} key={c.company}>
              <div className={s.companyHead}><span className={s.logoLg} aria-hidden="true">{initials(c.company)}</span><div className={s.rowText}><b>{c.company || "—"}</b><small>{c.industry || "—"} · {c.programs.length} program{c.programs.length === 1 ? "" : "s"}</small></div></div>
              {c.programs.map((p) => (
                <div className={s.program} key={p.program}>
                  <div className={s.programHead}><b>{p.program || "—"}</b>{p.patternChanged ? <span className={s.chip}><i className="ti ti-arrows-shuffle" aria-hidden="true" /> Opening months changed</span> : null}</div>
                  <ul className={s.history}>
                    {p.history.map((row) => <li key={text(row.id)}><b>{text(row.year) || "—"}</b><MonthStrip months={monthsOf(row)} /><span className={text(row.status).toLowerCase() === "closed" ? s.chipMuted : s.chip}>{text(row.status) || "Active"}</span></li>)}
                  </ul>
                </div>
              ))}
            </li>
          ))}
        </ul>
      ) : <p className={s.empty}>No companies match.</p>}
    </>
  );
}

/* ══════════════ INDUSTRIES ══════════════ */
function Industries({ industries, names, rows }: { industries: ApiRecord[]; names: string[]; rows: ApiRecord[] }) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [pending, start] = useTransition();
  const rowByName = useMemo(() => new Map(industries.map((row) => [text(row.nama).toLowerCase(), row])), [industries]);
  const usage = useMemo(() => { const m = new Map<string, number>(); rows.forEach((row) => m.set(industryOf(row), (m.get(industryOf(row)) || 0) + 1)); return m; }, [rows]);
  function add() {
    const trimmed = value.trim();
    if (!trimmed) { setInvalid(true); document.getElementById("new-industry")?.focus(); return; }
    start(async () => { try { await createIndustryAction(trimmed); setValue(""); } catch (error) { notifyError(error, "Could not save industry."); } });
  }
  async function remove(row: ApiRecord) {
    const n = usage.get(text(row.nama)) || 0;
    if (!(await confirmAction({ title: `Delete industry "${text(row.nama)}"?`, message: n ? `${n} vacanc${n === 1 ? "y keeps" : "ies keep"} this name; it just won't be offered in the form any more.` : "It won't be offered in the vacancy form any more.", confirmLabel: "Delete industry", danger: true }))) return;
    start(async () => { try { await deleteIndustryAction(text(row.id), text(row.nama)); } catch (error) { notifyError(error, "Could not delete industry."); } });
  }
  return (
    <section aria-labelledby="jv-ind" className={s.panelNarrow}>
      <div className={s.panelHead}><div><h2 id="jv-ind">Industries</h2><p>The industries offered in the vacancy form. Presets are always available.</p></div></div>
      <div className={s.inlineForm}>
        <label className={s.grow}><span className="sr-only">New industry name</span><input aria-invalid={invalid || undefined} className={invalid ? s.inputInvalid : s.input} id="new-industry" onChange={(e) => { setValue(e.target.value); setInvalid(false); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="New industry name…" value={value} /></label>
        <button className={s.primarySm} disabled={pending} onClick={add} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add industry</button>
      </div>
      <ul className={s.industryList}>
        {names.map((nama) => {
          const row = rowByName.get(nama.toLowerCase()); const n = usage.get(nama) || 0;
          return (
            <li key={nama}>
              <span>{nama}</span><small>{n ? `${n} vacanc${n === 1 ? "y" : "ies"}` : ""}</small>
              {row ? <button aria-label={`Delete industry ${nama}`} className={s.iconDanger} disabled={pending} onClick={() => remove(row)} type="button"><i className="ti ti-trash" aria-hidden="true" /></button> : <span className={s.chipMuted}>preset</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
