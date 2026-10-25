"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { initials } from "@/lib/dashboard/summary";
import { FACETS, facetOptions, facetValue, filterCandidates, GRADE_BANDS, isBuyer, poolSummary, splitList, type CandidateFilter } from "@/lib/talent-pool/view";
import { AnalyticsCard, BarBreakdown, DonutBreakdown, downloadJson, freq, freqMulti, type Entry } from "./analytics-cards";
import s from "./talent-pool-workspace.module.css";
import { TalentPoolTools } from "./talent-pool-tools";
import { Pagination, usePagination } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";
import { DialogBehaviour } from "./use-modal";
import { compareText } from "@/lib/text/sort";

// Talent Pool in the IJIS layout: a people directory (cards, not a 12-column table),
// a profile drawer, analytics, email blast and data management as views of one page.

type View = "candidates" | "analytics" | "blast" | "manage";
const EMPTY_FILTER: CandidateFilter = { query: "", pipeline: "", facets: {} };

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function options(rows: ApiRecord[], field: string) { return [...new Set(rows.map((row) => text(row[field])).filter(Boolean))].sort(compareText); }

function Field({ label, value, wide }: { label: string; value: unknown; wide?: boolean }) {
  if (!text(value)) return null;
  return <div className={wide ? s.fieldWide : s.field}><dt>{label}</dt><dd>{text(value)}</dd></div>;
}

export function TalentPoolWorkspace({ rows, management, sheetsImport }: { rows: ApiRecord[]; management: ReactNode; sheetsImport: ReactNode }) {
  const [view, setView] = useState<View>("candidates");
  const [filter, setFilter] = useState<CandidateFilter>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailId, setDetailId] = useState("");
  const summary = useMemo(() => poolSummary(rows), [rows]);
  const visible = useMemo(() => filterCandidates(rows, filter), [rows, filter]);
  const { pageItems, page, setPage, totalPages } = usePagination(visible, 24);
  const detail = rows.find((row) => String(row.id) === detailId);
  const set = (patch: CandidateFilter) => { setFilter((current) => ({ ...current, ...patch })); setPage(0); };
  const setFacet = (key: string, value: string) => set({ facets: { ...filter.facets, [key]: value } });
  const activeFacets = Object.values(filter.facets || {}).filter(Boolean).length;
  const filtersOn = Boolean(filter.query || activeFacets);
  // Each list counts the candidates that match the search, the pipeline and the other filters.
  const optionsFor = (key: string) => facetOptions(filterCandidates(rows, { ...filter, facets: { ...filter.facets, [key]: "" } }), key);

  useRecordFocus((id) => {
    if (!rows.some((row) => String(row.id) === id)) return;
    setView("candidates"); setFilter(EMPTY_FILTER);
    setDetailId(id);
    return true;
  });

  const views: Array<[View, string, number | null]> = [["candidates", "Candidates", rows.length], ["analytics", "Analytics", null], ["blast", "Email blast", null], ["manage", "Manage data", null]];
  const pipelines: Array<[CandidateFilter["pipeline"], string, number]> = [["", "All", summary.total], ["buyers", "Buyers", summary.buyers], ["prospects", "Not a buyer", summary.prospects]];

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Operations</span>
          <h1>Talent Pool</h1>
          <p>{summary.total} candidates · {summary.buyers} buyers · {summary.withEmail} reachable by email</p>
        </div>
      </header>

      <div className={s.segmented} role="tablist" aria-label="Talent Pool view">
        {views.map(([id, label, count]) => (
          <button aria-selected={view === id} className={view === id ? s.segmentActive : s.segment} key={id} onClick={() => setView(id)} role="tab" type="button">{label}{count !== null ? <span>{count}</span> : null}</button>
        ))}
      </div>

      {view === "candidates" ? (
        <>
          <div className={s.toolbar}>
            <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search candidates" onChange={(e) => set({ query: e.target.value })} placeholder="Search name, email, WA, university…" value={filter.query} /></label>
            <div className={s.segmentedSmall} role="group" aria-label="Pipeline">
              {pipelines.map(([id, label, count]) => (
                <button aria-pressed={filter.pipeline === id} className={filter.pipeline === id ? s.segmentActive : s.segment} key={label} onClick={() => set({ pipeline: id })} type="button">{label} <span>{count}</span></button>
              ))}
            </div>
            <button aria-controls="talent-filters" aria-expanded={filtersOpen || activeFacets > 0} className={activeFacets ? s.filtersOn : s.filtersButton} onClick={() => setFiltersOpen((open) => !open)} type="button"><i aria-hidden="true" className="ti ti-adjustments-horizontal" /> Filters{activeFacets ? <span>{activeFacets}</span> : null}</button>
            {filtersOn ? <button className={s.clear} onClick={() => set({ query: "", facets: {} })} type="button">Clear filters</button> : null}
          </div>
          {filtersOpen || activeFacets ? (
            <div aria-label="Filters" className={s.facets} id="talent-filters" role="group">
              {FACETS.map((f) => (
                <label className={filter.facets?.[f.key] ? s.facetOn : s.facet} key={f.key}>
                  <span>{f.label}</span>
                  <select aria-label={`Filter ${f.label}`} onChange={(e) => setFacet(f.key, e.target.value)} value={filter.facets?.[f.key] || ""}>
                    <option value="">All</option>
                    {optionsFor(f.key).map(([value, count]) => <option key={value} value={value}>{value} · {count}</option>)}
                  </select>
                </label>
              ))}
            </div>
          ) : null}

          <div className={s.board}>
            <section aria-label="Candidates" className={s.directory}>
              <p className={s.count}>{visible.length === rows.length ? `${rows.length} candidates` : `${visible.length} of ${rows.length} candidates`}</p>
              {visible.length ? (
                <ul className={s.grid}>
                  {pageItems.map((row) => {
                    const id = String(row.id); const name = text(row.nama) || "Unnamed";
                    const targets = splitList(row.target_mt);
                    const meta = [facetValue(row, "city"), text(row.tahun_lulus) && `Class of ${text(row.tahun_lulus)}`, text(row.ipk) && `Grade ${text(row.ipk)}`].filter(Boolean).join(" · ");
                    return (
                      <li key={id}>
                        <button className={s.person} data-record-id={id} data-record-open onClick={() => setDetailId(id)} type="button">
                          <span className={s.personTop}>
                            <span className={s.avatar} aria-hidden="true">{initials(name)}</span>
                            <span className={s.personName}><b>{name}</b><small>{[text(row.universitas), facetValue(row, "tier")].filter(Boolean).join(" · ") || facetValue(row, "status") || "—"}</small></span>
                            {isBuyer(row) ? <span className={s.buyer}>Buyer</span> : null}
                          </span>
                          {meta ? <span className={s.meta}>{meta}</span> : null}
                          {targets.length ? <span className={s.tags}><span className={s.tag}>{targets[0]}</span>{targets.length > 1 ? <span className={s.more}>+{targets.length - 1}</span> : null}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className={s.empty}>{rows.length ? "No candidates match these filters." : "No candidates yet. Import them in Manage data."}</p>}
              <Pagination onChange={setPage} page={page} totalPages={totalPages} />
            </section>

            <aside aria-label="Pool at a glance" className={s.glance}>
              <h2>At a glance</h2>
              <div className={s.split}>
                <div><b>{summary.buyers}</b><span>Buyers</span></div>
                <div><b>{summary.prospects}</b><span>Not a buyer</span></div>
              </div>
              <div className={s.bar} aria-label={`${summary.total ? Math.round((summary.buyers / summary.total) * 100) : 0}% are buyers`} role="img"><span style={{ width: `${summary.total ? (summary.buyers / summary.total) * 100 : 0}%` }} /></div>
              <dl className={s.tops}>
                {summary.topUniversity ? <div><dt>Top university</dt><dd>{summary.topUniversity[0]} <span>{summary.topUniversity[1]}</span></dd></div> : null}
                {summary.topTarget ? <div><dt>Top MT target</dt><dd>{summary.topTarget[0]} <span>{summary.topTarget[1]}</span></dd></div> : null}
                {summary.topCity ? <div><dt>Top city</dt><dd>{summary.topCity[0]} <span>{summary.topCity[1]}</span></dd></div> : null}
              </dl>
              <button className={s.glanceAction} disabled={!summary.withEmail} onClick={() => setView("blast")} type="button"><i className="ti ti-mail" aria-hidden="true" /> Email {summary.withEmail} candidates</button>
              <button className={s.glanceLink} onClick={() => setView("analytics")} type="button">See full analytics</button>
            </aside>
          </div>
        </>
      ) : null}

      {view === "analytics" ? <TalentPoolAnalytics rows={rows} /> : null}
      {view === "blast" ? <TalentPoolTools rows={rows} /> : null}
      {view === "manage" ? <div className={s.manage}>{sheetsImport}{management}</div> : null}

      {detail ? <ProfileDrawer row={detail} onClose={() => setDetailId("")} /> : null}
    </div>
  );
}

function ProfileDrawer({ row, onClose }: { row: ApiRecord; onClose: () => void }) {
  const name = text(row.nama) || "Unnamed";
  const wa = text(row.wa) ? `https://wa.me/${text(row.wa).replace(/\D/g, "").replace(/^0/, "62")}` : "";
  const label = (key: string) => FACETS.find((f) => f.key === key)!.label;
  return (
    <div className={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Candidate detail">
      <DialogBehaviour onClose={onClose} />
      <section className={s.drawer}>
        <header className={s.drawerHead}>
          <span className={s.avatarLg} aria-hidden="true">{initials(name)}</span>
          <div className={s.drawerTitle}><h2>{name}</h2><p>{[text(row.universitas), facetValue(row, "status")].filter(Boolean).join(" · ") || text(row.email)}</p></div>
          <button aria-label="Close candidate detail" className={s.close} onClick={onClose} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
        </header>
        {isBuyer(row) ? <p className={s.buyerNote}><i className="ti ti-shopping-bag-check" aria-hidden="true" /> Buyer{text(row.produk_dibeli) ? ` · ${text(row.produk_dibeli)}` : ""}</p> : null}
        <div className={s.contact}>
          {wa ? <a href={wa} rel="noopener" target="_blank"><i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp</a> : null}
          {text(row.email) ? <a href={`mailto:${text(row.email)}`}><i className="ti ti-mail" aria-hidden="true" /> Email</a> : null}
          {text(row.linkedin) ? <a href={text(row.linkedin)} rel="noopener" target="_blank"><i className="ti ti-brand-linkedin" aria-hidden="true" /> LinkedIn</a> : null}
        </div>
        <h3>Contact</h3>
        <dl className={s.fields}><Field label="WhatsApp" value={row.wa} /><Field label="Email" value={row.email} /><Field label="City" value={facetValue(row, "city")} /><Field label="Source" value={row.sumber} /></dl>
        <h3>Academic</h3>
        <dl className={s.fields}><Field label="University" value={row.universitas} /><Field label="Campus tier" value={facetValue(row, "tier")} /><Field label="Faculty" value={row.fakultas} /><Field label="Education" value={facetValue(row, "education")} /><Field label="Grade" value={row.ipk} /><Field label={label("intake")} value={row.angkatan} /><Field label={label("graduation")} value={row.tahun_lulus} /></dl>
        <h3>Profile</h3>
        <dl className={s.fields}><Field label="Status" value={facetValue(row, "status")} /><Field label={label("org")} value={facetValue(row, "org")} /><Field label={label("abroad")} value={facetValue(row, "abroad")} /><Field label={label("relocate")} value={facetValue(row, "relocate")} /><Field label="Topics of interest" value={row.topik_minat} wide /></dl>
        <h3>Management trainee</h3>
        <dl className={s.fields}><Field label="MT target" value={row.target_mt} wide /><Field label="MT position" value={row.posisi_mt} wide /><Field label="Pipeline" value={row.pipeline} /></dl>
        {text(row.feedback) ? <><h3>Feedback</h3><p className={s.feedback}>{text(row.feedback)}</p></> : null}
      </section>
    </div>
  );
}

/* Analytics: same breakdowns as before, in one responsive grid. */
function TalentPoolAnalytics({ rows }: { rows: ApiRecord[] }) {
  const total = rows.length;
  const data = useMemo(() => {
    // Same English options as the filters (lib/talent-pool/view.ts facets).
    const by = (key: string) => facetOptions(rows, key) as Entry[];
    const gpa = by("grade").sort((a, b) => GRADE_BANDS.indexOf(b[0]) - GRADE_BANDS.indexOf(a[0]));
    return {
      city: by("city"), source: by("source"), status: by("status"), education: by("education"), tier: by("tier"), relocate: by("relocate"),
      cohort: by("intake"), graduation: by("graduation"), university: freq(rows.map((row) => row.universitas)), exchange: by("abroad"), organisation: by("org"),
      position: freqMulti(rows.map((row) => row.posisi_mt)), target: freqMulti(rows.map((row) => row.target_mt)),
      gpa, gpaTotal: gpa.reduce((sum, [, count]) => sum + count, 0),
    };
  }, [rows]);
  const donut = (entries: Entry[], of = total) => <DonutBreakdown entries={entries} total={of} />;
  return (
    <div className={s.analytics}>
      <div className={s.analyticsHead}>
        <p>Breakdown of all {total} candidates</p>
        <button className={s.ghostButton} onClick={() => downloadJson(rows, `talent-pool-analytics-${new Date().toISOString().slice(0, 10)}.json`)} type="button"><i className="ti ti-download" aria-hidden="true" /> Export JSON</button>
      </div>
      <div className={s.analyticsGrid}>
        <AnalyticsCard icon="ti-map-pin" title="City" total={total}>{donut(data.city)}</AnalyticsCard>
        <AnalyticsCard icon="ti-source-code" title="Source" total={total}>{donut(data.source)}</AnalyticsCard>
        <AnalyticsCard icon="ti-id-badge" title="Status" total={total}>{donut(data.status)}</AnalyticsCard>
        <AnalyticsCard icon="ti-school" title="Education" total={total}>{donut(data.education)}</AnalyticsCard>
        <AnalyticsCard icon="ti-building-community" title="Campus tier" total={total}>{donut(data.tier)}</AnalyticsCard>
        <AnalyticsCard icon="ti-star" title="Grade" total={data.gpaTotal}>{donut(data.gpa, data.gpaTotal)}</AnalyticsCard>
        <AnalyticsCard icon="ti-plane" title="Study Abroad Exp" total={total}>{donut(data.exchange)}</AnalyticsCard>
        <AnalyticsCard icon="ti-users" title="Org Exp" total={total}>{donut(data.organisation)}</AnalyticsCard>
        <AnalyticsCard icon="ti-map-2" title="Willing to relocate" total={total}>{donut(data.relocate)}</AnalyticsCard>
      </div>
      <div className={s.analyticsWide}>
        <AnalyticsCard icon="ti-calendar" title="Intake year" total={total}><BarBreakdown entries={data.cohort} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-calendar-event" title="Graduation year" total={total}><BarBreakdown entries={data.graduation} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-building" title="Top universities" total={total}><BarBreakdown entries={data.university} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-briefcase" title="MT positions of interest" total={total}><BarBreakdown entries={data.position} total={total} /></AnalyticsCard>
      </div>
      <AnalyticsCard icon="ti-building-factory" title="MT target industries" total={total}><BarBreakdown entries={data.target} maxBars={15} total={total} /></AnalyticsCard>
    </div>
  );
}
