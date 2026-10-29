"use client";

import { Button } from "@/components/ui/button";
import type { ImportInfo } from "@/lib/api/mt-prospects";
import type { SheetSyncState } from "@/lib/api/sheet-sync";
import {
  calendarMonth, displayName, expectedIn, industryCounts, initials, isPerson, latestOpening, linkHref, linkKind, matchesQuery, monthCounts,
  MONTHS, MONTHS_SHORT, openedIn, openIn, prospectSearchText, shortLegalName, sortByName, STATUS_HELP, STATUS_LABEL, STATUSES, yearsOf,
  type ContactRow, type ProspectRow, type ProspectStatus,
} from "@/lib/mt-prospects/view";
import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyForm, ImportDialog } from "./mt-prospects-forms";
import { SheetSyncButton, SheetSyncDialog, syncedLine } from "./sheet-sync-control";
import { ProspectDetail } from "./mt-prospects-detail";
import s from "./mt-prospects.module.css";
import { Pagination, usePagination } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";

// Job Vacancy MT: companies that run management trainee programmes, from the
// "CCC List MT" workbook (Import Excel) plus anything added here.
//   Overview   — numbers, openings per month, by industry, expected in the next 2 months
//   Companies  — searchable list → company detail
//   Calendar   — who opens in each month: scheduled this year vs. usually opens
//   HR contacts — every contact, searchable

type View = "overview" | "companies" | "calendar" | "contacts";
/** Industry filter value for companies with no industry ("Other" on the chart). */
const NO_INDUSTRY = "__none__";
const TAB_ALIASES: Record<string, View> = { overview: "overview", companies: "companies", company: "companies", calendar: "calendar", contacts: "contacts", hr: "contacts" };

type Props = { prospects: ProspectRow[]; contacts: ContactRow[]; lastImport: ImportInfo; referenceDate: string; initialTab?: string; sheetSync?: SheetSyncState | null };

export function MtProspectsWorkspace({ prospects, contacts, lastImport, referenceDate, initialTab, sheetSync = null }: Props) {
  const now = useMemo(() => new Date(referenceDate), [referenceDate]);
  const year = now.getFullYear();
  const [view, setView] = useState<View>(TAB_ALIASES[initialTab || ""] || "overview");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ prospect: ProspectRow | null } | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>({ status: "active", industry: "", year: null, nonce: 0 });
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(now.getMonth() + 1);

  const byId = useMemo(() => new Map(prospects.map((row) => [row.id, row])), [prospects]);
  const contactsByProspect = useMemo(() => {
    const map = new Map<string, ContactRow[]>();
    contacts.forEach((contact) => { const list = map.get(contact.prospect_id) || []; list.push(contact); map.set(contact.prospect_id, list); });
    return map;
  }, [contacts]);
  const tracked = prospects.filter((row) => row.status !== "excluded");
  // HR contacts of companies in the list: the same count as the HR contacts tab (Putaran 58).
  const people = contacts.filter((contact) => isPerson(contact) && byId.has(contact.prospect_id));

  useRecordFocus((id) => {
    if (byId.has(id)) { setOpenId(id); return true; }
    const contact = contacts.find((item) => item.id === id);
    if (contact && byId.has(contact.prospect_id)) { setOpenId(contact.prospect_id); return true; }
  });

  const open = openId ? byId.get(openId) : undefined;
  // No counts on the tabs: each list opens filtered, so a total there would not match what it shows.
  const views: Array<[View, string]> = [["overview", "Overview"], ["companies", "Companies"], ["calendar", "Calendar"], ["contacts", "HR contacts"]];
  const activeCount = prospects.filter((row) => row.status === "active").length;
  const showIndustry = (industry: string, chosenYear: number) => { setCompanyFilter((current) => ({ status: "", industry: industry === "Other" ? NO_INDUSTRY : industry, year: chosenYear, nonce: current.nonce + 1 })); setView("companies"); };

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <h1>Job Vacancy MT</h1>
          <p>
            {prospects.length ? `${tracked.length} companies · ${activeCount} opening MT in ${year}` : "No MT list yet"}
            {syncedLine(sheetSync) || (lastImport ? ` · data from ${lastImport.file_name}, ${new Date(lastImport.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "")}
          </p>
        </div>
        <div className={s.headActions}>
          <SheetSyncButton className={s.ghostButton} onClick={() => setSyncing(true)} sync={sheetSync} />
          <button className={s.ghostButton} onClick={() => setImporting(true)} type="button"><i className="ti ti-file-spreadsheet" aria-hidden="true" /> Import Excel</button>
          <Button onClick={() => setEditing({ prospect: null })}><i className="ti ti-plus" aria-hidden="true" /> Add company</Button>
        </div>
      </header>

      <div aria-label="Job Vacancy MT view" className={s.segmented} role="tablist">
        {views.map(([id, label]) => <button aria-selected={view === id} className={view === id ? s.segmentActive : s.segment} key={id} onClick={() => setView(id)} role="tab" type="button">{label}</button>)}
      </div>

      {!prospects.length ? (
        <section className={s.panel}>
          <div className={s.emptyBig}>
            <i className="ti ti-file-spreadsheet" aria-hidden="true" />
            <h2>Import the MT list to start</h2>
            <p>Upload the “CCC List MT” Excel file. Companies, opening months, HR contacts, requirements and selection steps appear here. You can also add a company by hand.</p>
            <Button onClick={() => setImporting(true)}><i className="ti ti-file-spreadsheet" aria-hidden="true" /> Import Excel</Button>
          </div>
        </section>
      ) : null}

      {prospects.length && view === "overview" ? <Overview contacts={people.length} now={now} onCalendar={() => { setCalendarMonthIndex(now.getMonth() + 1); setView("calendar"); }} onIndustry={showIndustry} onOpen={setOpenId} prospects={prospects} tracked={tracked.length} /> : null}
      {prospects.length && view === "companies" ? <CompaniesView contactsByProspect={contactsByProspect} currentYear={year} filter={companyFilter} key={companyFilter.nonce} onOpen={setOpenId} prospects={prospects} /> : null}
      {prospects.length && view === "calendar" ? <CalendarView month={calendarMonthIndex} now={now} onMonth={setCalendarMonthIndex} onOpen={setOpenId} prospects={prospects} /> : null}
      {prospects.length && view === "contacts" ? <ContactsView byId={byId} contacts={contacts} onOpen={setOpenId} /> : null}

      {open ? <ProspectDetail contacts={contactsByProspect.get(open.id) || []} key={open.id} onClose={() => setOpenId(null)} onEdit={() => setEditing({ prospect: open })} prospect={open} year={year} /> : null}
      {editing ? <CompanyForm industries={[...new Set(prospects.map((row) => row.industry).filter(Boolean))].sort()} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); if (id) setOpenId(id); }} prospect={editing.prospect} year={year} /> : null}
      {importing ? <ImportDialog onClose={() => setImporting(false)} /> : null}
      {syncing ? (
        <SheetSyncDialog
          description="Keep the MT list in a Google Sheet (edited by the team or by Claude). The app reads it every hour, the same way as Import Excel."
          help="In the sheet: File → Share → Publish to web → Entire document → Microsoft Excel (.xlsx) → copy the link. The sheet needs the same tabs as the Excel file (Aktif, Pernah Buka, Lama, Prediksi, Kontak HR, Syarat Gabungan, Update Tgl & Status, Tahapan Tambahan)."
          job="mt-prospects" note="The sheet is the source for its companies: edit them in the sheet. Companies and HR contacts added in the app stay. If one sync would remove many companies at once, it pauses until you check."
          onClose={() => setSyncing(false)} placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=xlsx"
          stopMessage="The list stops following the sheet. Companies already here stay."
          sync={sheetSync} title="Sync the MT list every hour"
        />
      ) : null}
    </div>
  );
}

/* ── Overview ── */

function Overview({ prospects, tracked, contacts, now, onOpen, onCalendar, onIndustry }: { prospects: ProspectRow[]; tracked: number; contacts: number; now: Date; onOpen: (id: string) => void; onCalendar: () => void; onIndustry: (industry: string, year: number) => void }) {
  const year = now.getFullYear();
  const years = useMemo(() => yearsOf(prospects, year), [prospects, year]);
  const [chartYear, setChartYear] = useState(year);
  const [industryYear, setIndustryYear] = useState(year);
  const openNow = openIn(prospects, year, now.getMonth() + 1);
  const expected = [expectedIn(prospects, now, 1), expectedIn(prospects, now, 2)];
  const industries = industryCounts(prospects, industryYear, year);
  const industryTotal = industries.reduce((sum, [, count]) => sum + count, 0);
  const max = Math.max(1, ...industries.map(([, count]) => count));

  return (
    <>
      <div className={s.stats}>
        <div className={s.stat}><span>Companies tracked</span><b>{tracked}</b></div>
        <div className={s.stat}><span>Opening MT in {year}</span><b>{prospects.filter((row) => row.status === "active").length}</b></div>
        <button className={s.statButton} onClick={onCalendar} type="button"><span>Open in {MONTHS[now.getMonth()]}</span><b>{openNow.length}</b></button>
        <div className={s.stat}><span>HR contacts</span><b>{contacts.toLocaleString("en-US")}</b></div>
      </div>

      <section className={s.panel} aria-labelledby="mt-when">
        <div className={s.panelHead}>
          <h2 id="mt-when">When companies open MT</h2>
          <YearSwitch label="Chart year" onChange={setChartYear} value={chartYear} years={years} />
        </div>
        <MonthChart now={now} prospects={prospects} year={chartYear} />
      </section>

      <div className={s.twoCol}>
        {expected.map(({ month, year: expectedYear, items }) => <ExpectedCard items={items} key={`${expectedYear}-${month}`} label={`${MONTHS[month - 1]} ${expectedYear}`} onOpen={onOpen} />)}
      </div>

      <section className={s.panel} aria-labelledby="mt-industry">
        <div className={s.panelHead}>
          <h2 id="mt-industry">Companies by industry</h2>
          <YearSwitch label="Industry year" onChange={setIndustryYear} value={industryYear} years={years} />
        </div>
        <p className={s.panelNote}>{industryTotal} companies with an MT programme recorded in {industryYear}. Choose an industry to see its companies.</p>
        <ul className={s.industryList}>
          {industries.map(([name, count]) => (
            <li key={name}>
              <button className={s.industryBar} onClick={() => onIndustry(name, industryYear)} type="button">
                <span>{name}</span><span className={s.track} aria-hidden="true"><i style={{ width: `${(count / max) * 100}%` }} /></span><b>{count}</b>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function YearSwitch({ years, value, onChange, label }: { years: number[]; value: number; onChange: (year: number) => void; label: string }) {
  return <div aria-label={label} className={s.yearSwitch} role="group">{years.map((item) => <button aria-pressed={item === value} key={item} onClick={() => onChange(item)} type="button">{item}</button>)}</div>;
}

function MonthChart({ prospects, year, now }: { prospects: ProspectRow[]; year: number; now: Date }) {
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at the box's real width so labels stay 12px on any screen.
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(720);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setBoxWidth(Math.max(320, Math.round(box.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const current = monthCounts(prospects, year);
  const hasPrevious = prospects.some((row) => row.openings?.[String(year - 1)]);
  const previous = hasPrevious ? monthCounts(prospects, year - 1) : null;
  const max = Math.max(1, ...current, ...(previous || [0]));
  const width = boxWidth; const height = 220; const top = 26; const bottom = height - 30; const slot = width / 12;
  const total = prospects.filter((row) => row.openings?.[String(year)]?.months.length).length;
  return (
    <>
      <div className={s.legend}><span><i style={{ background: "var(--purple-mid)" }} />{year}</span>{previous ? <span><i style={{ background: "var(--border-md)" }} />{year - 1}</span> : null}</div>
      <div className={s.chart} onMouseLeave={() => setHover(null)} ref={boxRef}>
        <svg aria-label={`Companies opening MT per month in ${year}`} role="img" viewBox={`0 0 ${width} ${height}`}>
          {MONTHS_SHORT.map((label, index) => {
            const x = index * slot; const center = x + slot / 2;
            const isNow = year === now.getFullYear() && index === now.getMonth();
            const hCurrent = (current[index] / max) * (bottom - top);
            const hPrevious = previous ? (previous[index] / max) * (bottom - top) : 0;
            return (
              <g key={label}>
                {isNow ? <rect fill="var(--purple-light)" height={bottom - top + 40} rx="12" width={slot - 6} x={x + 3} y={top - 16} /> : null}
                {previous ? <rect fill="var(--border-md)" height={hPrevious} rx="6" width={Math.min(slot * 0.62, 46)} x={center - Math.min(slot * 0.31, 23)} y={bottom - hPrevious} /> : null}
                <rect fill="var(--purple-mid)" height={Math.max(hCurrent, current[index] ? 3 : 0)} rx="6" width={Math.min(slot * 0.38, 28)} x={center - Math.min(slot * 0.19, 14)} y={bottom - hCurrent} />
                <text fill="var(--text)" fontSize="12" fontWeight="700" textAnchor="middle" x={center} y={bottom - Math.max(hCurrent, hPrevious) - 7}>{current[index] || ""}</text>
                <text fill={isNow ? "var(--purple-mid)" : "var(--text-muted)"} fontSize="12" fontWeight={isNow ? 800 : 600} textAnchor="middle" x={center} y={height - 8}>{label}</text>
                <rect fill="transparent" height={height} onMouseEnter={() => setHover(index)} width={slot} x={x} y={0} />
              </g>
            );
          })}
        </svg>
        {hover !== null ? (
          <div className={s.chartTip} style={{ left: `${((hover + 0.5) / 12) * 100}%`, top: 8 }}>
            <b>{MONTHS[hover]}</b>{year}: {current[hover]} companies{previous ? <><br />{year - 1}: {previous[hover]} companies</> : null}
          </div>
        ) : null}
      </div>
      <p className={s.panelNote}>{total} companies recorded opening MT in {year}{previous ? `, against ${prospects.filter((row) => row.openings?.[String(year - 1)]?.months.length).length} in ${year - 1}` : ""}. A company that opens over several months counts in each.</p>
    </>
  );
}

function ExpectedCard({ label, items, onOpen }: { label: string; items: ReturnType<typeof expectedIn<ProspectRow>>["items"]; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 7);
  return (
    <section className={s.panel} aria-label={`Expected in ${label}`}>
      <div className={s.panelHead}><h2>Expected in {label}</h2><span className={s.tagMuted}>{items.length}</span></div>
      {items.length ? (
        <ul className={s.miniList}>
          {shown.map(({ row, scheduled, pastYears }) => (
            <li key={row.id}><button className={s.miniRow} onClick={() => onOpen(row.id)} type="button"><span>{displayName(row)}</span>{scheduled ? <span className={s.tag}>Scheduled</span> : <span className={s.tagMuted}>Usually · {pastYears.join(", ")}</span>}</button></li>
          ))}
        </ul>
      ) : <p className={s.panelNote}>No company is expected to open this month yet.</p>}
      {items.length > 7 ? <button className={s.linkButton} onClick={() => setAll(!all)} type="button">{all ? "Show fewer" : `Show all ${items.length}`}</button> : null}
    </section>
  );
}

/* ── Companies ── */

type CompanyFilter = { status: ProspectStatus | ""; industry: string; year: number | null; nonce: number };

function CompaniesView({ prospects, contactsByProspect, filter, currentYear, onOpen }: { prospects: ProspectRow[]; contactsByProspect: Map<string, ContactRow[]>; filter: CompanyFilter; currentYear: number; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProspectStatus | "">(filter.status);
  const [industry, setIndustry] = useState(filter.industry);
  // Set from an industry bar on the overview: the same companies the bar counted for that year.
  const [year, setYear] = useState<number | null>(filter.year);
  const inYear = (row: ProspectRow) => !year || (row.status !== "excluded" && openedIn(row, year, currentYear));
  const industryMatches = (row: ProspectRow) => !industry || (industry === NO_INDUSTRY ? !row.industry : row.industry === industry);
  const statusCounts = useMemo(() => Object.fromEntries(STATUSES.map((item) => [item, prospects.filter((row) => row.status === item).length])), [prospects]);
  const industries = useMemo(() => {
    const counts = new Map<string, number>();
    prospects.filter((row) => (!status || row.status === status) && inYear(row)).forEach((row) => { const key = row.industry || NO_INDUSTRY; counts.set(key, (counts.get(key) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => (a[0] === NO_INDUSTRY ? 1 : b[0] === NO_INDUSTRY ? -1 : a[0].localeCompare(b[0], "en", { sensitivity: "base" })));
  }, [prospects, status, year]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => sortByName(prospects.filter((row) => (!status || row.status === status) && inYear(row) && industryMatches(row) && (!query || matchesQuery(prospectSearchText(row), query)))), [prospects, status, industry, query, year]); // eslint-disable-line react-hooks/exhaustive-deps
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 25);
  return (
    <>
      <div className={s.toolbar}>
        <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search companies" onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search company, programme or industry…" value={query} /></label>
        <label className={s.filterPill}><span>Status</span><select aria-label="Filter status" onChange={(event) => { setStatus(event.target.value as ProspectStatus | ""); setIndustry(""); setPage(0); }} value={status}><option value="">All ({prospects.length})</option>{STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]} ({statusCounts[item]})</option>)}</select></label>
        <label className={s.filterPill}><span>Industry</span><select aria-label="Filter industry" onChange={(event) => { setIndustry(event.target.value); setPage(0); }} value={industry}><option value="">All</option>{industries.map(([name, count]) => <option key={name} value={name}>{name === NO_INDUSTRY ? "No industry" : name} ({count})</option>)}{industry && !industries.some(([name]) => name === industry) ? <option value={industry}>{industry === NO_INDUSTRY ? "No industry" : industry} (0)</option> : null}</select></label>
        {year ? <button aria-label={`Stop showing only companies that opened in ${year}`} className={s.ghostButton} onClick={() => { setYear(null); setPage(0); }} type="button">Opened in {year} <i className="ti ti-x" aria-hidden="true" /></button> : null}
      </div>
      {status ? <p className={s.panelNote}>{STATUS_LABEL[status]}: {STATUS_HELP[status]}</p> : null}
      <section aria-label="Companies" className={s.listCard}>
        <p className={s.listCount}>{filtered.length} {filtered.length === 1 ? "company" : "companies"}</p>
        {pageItems.length ? (
          <ul className={s.rows}>
            {pageItems.map((row) => {
              const contacts = (contactsByProspect.get(row.id) || []).filter(isPerson).length;
              return (
                <li className={s.row} data-record-id={row.id} key={row.id}>
                  <button className={s.rowMain} onClick={() => onOpen(row.id)} type="button">
                    <span className={s.logo} aria-hidden="true">{initials(displayName(row))}</span>
                    <span className={s.rowText}><b>{displayName(row)}{row.added_via === "claude" ? <span className={s.claudeMark} title="Added by Claude">Claude<span className="sr-only"> (added by Claude)</span></span> : null}</b><small>{shortLegalName(row.legal_name) || "Not set"}</small></span>
                    <span className={s.rowText}><b className={s.soft}>{row.program.split("\n")[0] || "Not set"}</b><small>{row.industry || "No industry"}</small></span>
                    <span className={s.rowText}><b className={s.soft}>{latestOpening(row) || "No date yet"}</b><small>{contacts ? `${contacts} HR contact${contacts === 1 ? "" : "s"}` : "No HR contact"}</small></span>
                    {status ? <span aria-hidden="true" /> : <span className={s.status} data-status={row.status}>{STATUS_LABEL[row.status]}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className={s.empty}>No companies match these filters.</p>}
        <Pagination onChange={setPage} page={page} totalPages={totalPages} />
      </section>
    </>
  );
}

/* ── Calendar ── */

function CalendarView({ prospects, now, month, onMonth, onOpen }: { prospects: ProspectRow[]; now: Date; month: number; onMonth: (month: number) => void; onOpen: (id: string) => void }) {
  const year = now.getFullYear();
  const months = useMemo(() => MONTHS.map((_, index) => calendarMonth(prospects, year, index + 1)), [prospects, year]);
  const { scheduled, usual } = months[month - 1];
  const tagFor = (row: ProspectRow) => [year - 1, year - 2].filter((past) => row.openings?.[String(past)]?.months.includes(month)).join(", ");
  return (
    <>
      <div aria-label={`Months of ${year}`} className={s.monthStrip} role="group">
        {MONTHS_SHORT.map((label, index) => (
          <button aria-label={`${MONTHS[index]}: ${months[index].scheduled.length + months[index].usual.length} companies`} aria-pressed={month === index + 1} className={s.month} data-now={index === now.getMonth()} key={label} onClick={() => onMonth(index + 1)} type="button">
            <b>{months[index].scheduled.length + months[index].usual.length}</b>{label}
          </button>
        ))}
      </div>
      <section aria-label={`${MONTHS[month - 1]} ${year}`} className={s.panel}>
        <div className={s.panelHead}><h2>{MONTHS[month - 1]} {year}</h2></div>
        <p className={s.panelNote}>Scheduled: recorded for this month in {year}. Usually opens: opened this month in {year - 2} or {year - 1}, not yet recorded for {year}.</p>
        <h3 className={s.groupTitle}>Scheduled · {scheduled.length}</h3>
        {scheduled.length ? <ul className={s.miniList}>{scheduled.map((row) => <li key={row.id}><button className={s.miniRow} onClick={() => onOpen(row.id)} type="button"><span>{displayName(row)}</span><span className={s.tag}>{row.openings?.[String(year)]?.label || year}</span></button></li>)}</ul> : <p className={s.panelNote}>None recorded.</p>}
        <h3 className={s.groupTitle}>Usually opens · {usual.length}</h3>
        {usual.length ? <ul className={s.miniList}>{usual.map((row) => <li key={row.id}><button className={s.miniRow} onClick={() => onOpen(row.id)} type="button"><span>{displayName(row)}</span><span className={s.tagMuted}>{tagFor(row)}</span></button></li>)}</ul> : <p className={s.panelNote}>None.</p>}
      </section>
    </>
  );
}

/* ── HR contacts ── */

function ContactsView({ contacts, byId, onOpen }: { contacts: ContactRow[]; byId: Map<string, ProspectRow>; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  // All companies first, so the count matches the Overview; narrow by status from here.
  const [status, setStatus] = useState<ProspectStatus | "">("");
  const filtered = useMemo(() => {
    const rows = contacts.filter((contact) => {
      const company = byId.get(contact.prospect_id);
      if (!company || !isPerson(contact) || (status && company.status !== status)) return false;
      return !query || matchesQuery(`${contact.name} ${contact.title} ${displayName(company)} ${company.legal_name}`.toLowerCase(), query);
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }, [contacts, byId, query, status]);
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 30);
  return (
    <>
      <div className={s.toolbar}>
        <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search HR contacts" onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search name, job title or company…" value={query} /></label>
        <label className={s.filterPill}><span>Company</span><select aria-label="Filter company status" onChange={(event) => { setStatus(event.target.value as ProspectStatus | ""); setPage(0); }} value={status}><option value="">All</option>{STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}</select></label>
      </div>
      <section aria-label="HR contacts" className={s.listCard}>
        <p className={s.listCount}>{filtered.length.toLocaleString("en-US")} HR contacts</p>
        {pageItems.length ? (
          <ul className={s.rows}>
            {pageItems.map((contact) => {
              const company = byId.get(contact.prospect_id);
              const href = linkHref(contact.link);
              const kind = linkKind(contact.link);
              return (
                <li className={s.row} data-record-id={contact.id} key={contact.id}>
                  <button className={`${s.rowMain} ${s.contactMain}`} onClick={() => onOpen(contact.prospect_id)} type="button">
                    <span className={s.avatar} aria-hidden="true">{initials(contact.name)}</span>
                    <span className={s.rowText}><b>{contact.name}</b><small>{contact.title || "Not set"}</small></span>
                    <span className={s.rowText}><b className={s.soft}>{company ? displayName(company) : "Not set"}</b><small>{company?.industry || ""}</small></span>
                  </button>
                  {href ? <a aria-label={kind === "email" ? `Email ${contact.name}` : `Open ${contact.name} on LinkedIn`} className={s.iconLink} href={href} rel="noopener noreferrer" target="_blank"><i className={`ti ${kind === "email" ? "ti-mail" : kind === "linkedin" ? "ti-brand-linkedin" : "ti-external-link"}`} aria-hidden="true" /></a> : <span />}
                </li>
              );
            })}
          </ul>
        ) : <p className={s.empty}>No HR contacts match.</p>}
        <Pagination onChange={setPage} page={page} totalPages={totalPages} />
      </section>
    </>
  );
}
