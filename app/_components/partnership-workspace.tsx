"use client";

import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ApiRecord } from "@/lib/api/_crud";
import { initials, shortDate } from "@/lib/dashboard/summary";
import { outreachByDay, partnerActivity, partnerSummary, pipelineColumns, PARTNER_STATUSES } from "@/lib/partnership/view";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { confirmAction, notify, notifyError } from "./app-dialog";
import { guard } from "./safe-action";
import s from "./partnership-workspace.module.css";
import { Pagination, usePagination } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";
import { DateInput } from "./date-input";
import { digitsOf, MoneyInput } from "./money-input";

// Partnership (B2B and Organization) in the IJIS layout: the pipeline board first,
// then the partner list, deals, an outreach timeline and insights — same data and actions.

type View = "pipeline" | "partners" | "deals" | "outreach" | "insights";

const STATUSES = PARTNER_STATUSES;
const TIERS = ["Strategic", "Standard"];
const DEAL_STAGES = ["Active", "Negotiation", "Done", "Cancelled"];
const CHANNELS = ["WhatsApp", "Email", "LinkedIn", "Meeting"];
const RESPONSES = ["Replied", "No Reply", "Meeting Scheduled", "Declined"];
const CHANNEL_ICON: Record<string, string> = { WhatsApp: "ti-brand-whatsapp", Email: "ti-mail", LinkedIn: "ti-brand-linkedin", Meeting: "ti-users" };
const PARTNER_FIELDS = ["name", "type", "category", "tier", "status", "contact_name", "contact_email", "contact_phone", "pos", "li", "scope", "notes", "input_date"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function localIso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function cell(value: unknown) { if (value === null || value === undefined) return ""; if (value instanceof Date) return localIso(value); return String(value); }
function dayValue(value: unknown) { return value instanceof Date ? localIso(value) : text(value).slice(0, 10); }
function distribution(rows: ApiRecord[], key: string) { const map = new Map<string, number>(); rows.forEach((row) => { const value = text(row[key]) || "Unknown"; map.set(value, (map.get(value) || 0) + 1); }); return [...map.entries()].sort((a, b) => b[1] - a[1]); }
function buildFd(fields: string[], values: Record<string, unknown>) { const fd = new FormData(); for (const key of fields) fd.set(key, cell(values[key])); return fd; }
function niceDate(value: unknown) { const key = dayValue(value); return /^\d{4}-\d{2}-\d{2}$/.test(key) ? `${shortDate(key, false)} ${key.slice(0, 4)}` : ""; }

type Props = {
  title: string;
  entityLabel: string;
  rows: ApiRecord[];
  deals: ApiRecord[];
  outreach: ApiRecord[];
  tableKey: string;
  dealsKey: string;
  outreachKey: string;
  partnerField: string;
  categories: string[];
  aiPanel?: ReactNode;
  /** Opened from the sidebar or an old address: ?tab=deals / ?tab=outreach. */
  initialTab?: string;
};

// Old tab names from links and bookmarks keep working.
const TAB_ALIASES: Record<string, View> = { pipeline: "pipeline", master: "partners", partners: "partners", deals: "deals", outreach: "outreach", overview: "insights", insights: "insights" };

export function PartnershipWorkspace({ title, entityLabel, rows, deals, outreach, tableKey, dealsKey, outreachKey, partnerField, categories, aiPanel, initialTab }: Props) {
  const [view, setView] = useState<View>(TAB_ALIASES[initialTab || ""] || "pipeline");
  const [editing, setEditing] = useState<{ record: ApiRecord | null; status?: string } | null>(null);
  const summary = useMemo(() => partnerSummary(rows), [rows]);
  const activity = useMemo(() => partnerActivity(deals, outreach, partnerField), [deals, outreach, partnerField]);
  useRecordFocus((id) => {
    // Deals and outreach logs live in their own views; a partner opens its edit form.
    if (deals.some((deal) => String(deal.id) === id)) { setView("deals"); return; }
    if (outreach.some((log) => String(log.id) === id)) { setView("outreach"); return; }
    const record = rows.find((row) => String(row.id) === id);
    if (!record) return;
    setEditing({ record });
    return true;
  });
  const plural = `${entityLabel}s`;
  const views: Array<[View, string, number | null]> = [["pipeline", "Pipeline", null], ["partners", `All ${plural}`, rows.length], ["deals", "Deals & scope", deals.length], ["outreach", "Outreach log", outreach.length], ["insights", "Insights", null]];

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Internal</span>
          <h1>{title}</h1>
          <p>{summary.total} {plural} · {summary.open} in progress · {summary.closed} closed deal{summary.closed === 1 ? "" : "s"}</p>
        </div>
        <Button onClick={() => setEditing({ record: null })}><i className="ti ti-plus" aria-hidden="true" /> Add {entityLabel}</Button>
      </header>

      <div className={s.segmented} role="tablist" aria-label={`${title} view`}>
        {views.map(([id, label, count]) => <button aria-selected={view === id} className={view === id ? s.segmentActive : s.segment} key={id} onClick={() => setView(id)} role="tab" type="button">{label}{count !== null ? <span>{count}</span> : null}</button>)}
      </div>

      {view === "pipeline" ? <PipelineView activity={activity} entityLabel={entityLabel} rows={rows} tableKey={tableKey} onAdd={(status) => setEditing({ record: null, status })} onEdit={(record) => setEditing({ record })} /> : null}
      {view === "partners" ? <PartnersView activity={activity} aiPanel={aiPanel} entityLabel={entityLabel} rows={rows} tableKey={tableKey} onEdit={(record) => setEditing({ record })} /> : null}
      {view === "deals" ? <DealsView rows={rows} deals={deals} dealsKey={dealsKey} entityLabel={entityLabel} partnerField={partnerField} /> : null}
      {view === "outreach" ? <OutreachView rows={rows} outreach={outreach} outreachKey={outreachKey} entityLabel={entityLabel} partnerField={partnerField} /> : null}
      {view === "insights" ? <InsightsView activity={activity} entityLabel={entityLabel} rows={rows} summary={summary} onEdit={(record) => setEditing({ record })} /> : null}

      {editing ? <PartnerModal defaultStatus={editing.status} profile={editing.record} tableKey={tableKey} categories={categories} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

type Activity = ReturnType<typeof partnerActivity>;

function PartnerMeta({ row, activity }: { row: ApiRecord; activity: Activity }) {
  const a = activity.get(String(row.id));
  const bits = [a?.deals ? `${a.deals} deal${a.deals === 1 ? "" : "s"}` : "", a?.lastContact ? `last contact ${shortDate(a.lastContact, false)}` : "no outreach yet"].filter(Boolean);
  return <small className={s.meta}>{bits.join(" · ")}</small>;
}

/* ── Pipeline board ── */
function PipelineView({ rows, tableKey, activity, entityLabel, onAdd, onEdit }: { rows: ApiRecord[]; tableKey: string; activity: Activity; entityLabel: string; onAdd: (status: string) => void; onEdit: (record: ApiRecord) => void }) {
  const [pending, start] = useTransition();
  const [dragId, setDragId] = useState("");
  const [over, setOver] = useState("");
  const columns = useMemo(() => pipelineColumns(rows), [rows]);

  function moveTo(status: string) {
    const row = rows.find((item) => String(item.id) === dragId);
    setDragId(""); setOver("");
    if (!row || text(row.status) === status) return;
    start(() => guard(async () => { await updateManagedRecord(tableKey, String(row.id), buildFd(PARTNER_FIELDS, { ...row, type: text(row.type) || "Corporate", status })); }, "Could not save the changes."));
  }

  return (
    <section aria-label="Pipeline" className={s.boardWrap}>
      <p className={s.hint}>Drag a card to another column to change its stage{pending ? " · saving…" : ""}. On a phone, open the card and change Status.</p>
      <div className={s.board}>
        {columns.map(({ status, rows: items }, index) => (
          <div aria-label={`${status}, ${items.length}`} className={over === status ? s.columnOver : s.column} key={status} onDragLeave={() => setOver("")} onDragOver={(event) => { event.preventDefault(); setOver(status); }} onDrop={() => moveTo(status)} role="group">
            <div className={s.columnHead}><span className={s.step}>{index + 1}</span><b>{status}</b><span className={s.count}>{items.length}</span></div>
            <ul className={s.cards}>
              {items.map((row) => (
                <li key={String(row.id)}>
                  <button className={s.card} data-record-id={String(row.id)} draggable onClick={() => onEdit(row)} onDragStart={() => setDragId(String(row.id))} type="button">
                    <span className={s.cardTop}><b>{text(row.name) || "Untitled"}</b>{text(row.tier) === "Strategic" ? <span className={s.strategic}>Strategic</span> : null}</span>
                    {text(row.category) ? <small className={s.meta}>{text(row.category)}</small> : null}
                    <span className={s.cardFoot}>
                      {text(row.contact_name) ? <span className={s.pic}><span className={s.avatar} aria-hidden="true">{initials(row.contact_name)}</span>{text(row.contact_name)}</span> : <span className={s.noPic}>No PIC yet</span>}
                    </span>
                    <PartnerMeta activity={activity} row={row} />
                  </button>
                </li>
              ))}
            </ul>
            <button className={s.addCard} onClick={() => onAdd(status)} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add {entityLabel}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── All partners ── */
function PartnersView({ rows, tableKey, aiPanel, activity, entityLabel, onEdit }: { rows: ApiRecord[]; tableKey: string; aiPanel?: ReactNode; activity: Activity; entityLabel: string; onEdit: (record: ApiRecord) => void }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState(""); const [tier, setTier] = useState("");
  const [pending, start] = useTransition();
  const filtered = useMemo(() => rows.filter((row) => (!query || `${text(row.name)} ${text(row.contact_name)}`.toLowerCase().includes(query.toLowerCase())) && (!status || text(row.status) === status) && (!tier || text(row.tier) === tier)), [rows, query, status, tier]);
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  async function remove(row: ApiRecord) {
    if (!(await confirmAction({ title: `Delete ${text(row.name) || `this ${entityLabel}`}?`, message: "Its deals are deleted too. This cannot be undone.", confirmLabel: entityLabel === "partner" ? "Delete partner" : "Delete organization", danger: true }))) return;
    start(() => guard(async () => { await deleteManagedRecord(tableKey, String(row.id)); }, "Could not delete the partner."));
  }
  function exportCsv() {
    const headers = ["name", "category", "tier", "status", "contact_name", "contact_email", "contact_phone", "pos", "li", "scope", "notes", "input_date"];
    const content = [headers.join(","), ...filtered.map((row) => headers.map((key) => `"${cell(row[key]).replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${tableKey}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      {aiPanel ? <div>{aiPanel}</div> : null}
      <div className={s.toolbar}>
        <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label={`Search ${entityLabel}s`} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search name or PIC…" value={query} /></label>
        <label className={s.filterPill}><span>Status</span><select aria-label="Filter status" onChange={(e) => { setStatus(e.target.value); setPage(0); }} value={status}><option value="">All</option>{STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label className={s.filterPill}><span>Tier</span><select aria-label="Filter tier" onChange={(e) => { setTier(e.target.value); setPage(0); }} value={tier}><option value="">All</option>{TIERS.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <span className={s.spacer} />
        <button className={s.ghostButton} onClick={exportCsv} type="button"><i className="ti ti-download" aria-hidden="true" /> Export CSV</button>
      </div>
      <section aria-label={`All ${entityLabel}s`} className={s.listCard}>
        <p className={s.listCount}>{filtered.length === rows.length ? `${rows.length} ${entityLabel}s` : `${filtered.length} of ${rows.length} ${entityLabel}s`}</p>
        {pageItems.length ? (
          <ul className={s.rows}>
            {pageItems.map((row) => (
              <li className={s.row} data-record-id={String(row.id)} key={String(row.id)}>
                <button className={s.rowMain} onClick={() => onEdit(row)} type="button">
                  <span className={s.logo} aria-hidden="true">{initials(row.name)}</span>
                  <span className={s.rowText}><b>{text(row.name) || "Untitled"}</b><small>{[text(row.category), text(row.tier)].filter(Boolean).join(" · ") || "—"}</small></span>
                  <span className={s.rowText}><b className={s.rowPic}>{text(row.contact_name) || "No PIC yet"}</b><small>{[text(row.pos), text(row.contact_phone)].filter(Boolean).join(" · ") || "—"}</small></span>
                  <span className={s.rowText}><PartnerMeta activity={activity} row={row} /><small>{niceDate(row.input_date) ? `Added ${niceDate(row.input_date)}` : ""}</small></span>
                  <span className={text(row.status) === "Closed Deal" ? s.chipDone : s.chip}>{text(row.status) || "Approached"}</span>
                </button>
                <button aria-label={`Delete ${text(row.name)}`} className={s.iconButton} disabled={pending} onClick={() => remove(row)} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        ) : <p className={s.empty}>{rows.length ? `No ${entityLabel}s match these filters.` : `No ${entityLabel}s yet.`}</p>}
        <Pagination onChange={setPage} page={page} totalPages={totalPages} />
      </section>
    </>
  );
}

/* ── Deals & scope (edit in place) ── */
function DealsView({ rows, deals, dealsKey, partnerField, entityLabel }: { rows: ApiRecord[]; deals: ApiRecord[]; dealsKey: string; partnerField: string; entityLabel: string }) {
  const fields = [partnerField, "title", "stage", "scope", "deadline", "value", "notes"];
  const [selectedPartner, setSelectedPartner] = useState("");
  const [pending, start] = useTransition();
  const partnerName = (id: unknown) => text(rows.find((row) => String(row.id) === String(id))?.name) || `No ${entityLabel}`;
  const saveField = (deal: ApiRecord, patch: Record<string, unknown>) => start(() => guard(async () => { await updateManagedRecord(dealsKey, String(deal.id), buildFd(fields, { ...deal, ...patch })); }, "Could not save the changes."));
  const add = () => start(() => guard(async () => { await createManagedRecord(dealsKey, buildFd(fields, { [partnerField]: selectedPartner || null, title: "New deal", stage: "Negotiation" })); }, "Could not add the deal."));
  const remove = async (deal: ApiRecord) => { if (await confirmAction({ title: `Delete deal "${text(deal.title) || "Untitled"}"?`, confirmLabel: "Delete deal", danger: true })) start(() => guard(async () => { await deleteManagedRecord(dealsKey, String(deal.id)); }, "Could not delete the deal.")); };
  const blur = (deal: ApiRecord, key: string) => (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (event.target.value !== text(deal[key])) saveField(deal, { [key]: event.target.value }); };

  return (
    <section aria-label="Deals & scope" className={s.stack}>
      <div className={s.addBar}>
        <p>Edit right in place — changes save when you leave a field. One {entityLabel} can have several deals.</p>
        <label className={s.filterPill}><span>{entityLabel[0].toUpperCase() + entityLabel.slice(1)}</span><select aria-label={`Deal ${entityLabel}`} onChange={(event) => setSelectedPartner(event.target.value)} value={selectedPartner}><option value="">Choose…</option>{rows.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}</select></label>
        <Button disabled={pending} onClick={add}><i className="ti ti-plus" aria-hidden="true" /> Add deal</Button>
      </div>
      {deals.length ? (
        <ul className={s.dealGrid}>
          {deals.map((deal) => (
            <li className={s.deal} data-record-id={String(deal.id)} key={String(deal.id)}>
              <div className={s.dealHead}>
                <input aria-label="Deal name" className={s.dealTitle} defaultValue={text(deal.title)} onBlur={blur(deal, "title")} />
                <button aria-label={`Delete deal ${text(deal.title)}`} className={s.iconButton} onClick={() => remove(deal)} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
              </div>
              <span className={s.dealPartner}><i className="ti ti-building" aria-hidden="true" /> {partnerName(deal[partnerField])}</span>
              <div className={s.dealGridFields}>
                <label><span>Stage</span><select defaultValue={text(deal.stage) || "Negotiation"} onChange={(event) => saveField(deal, { stage: event.target.value })}>{DEAL_STAGES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label><span>Deadline</span><DateInput defaultValue={dayValue(deal.deadline)} onChange={(event) => saveField(deal, { deadline: event.target.value })}  /></label>
                <label><span>Value</span><MoneyInput defaultValue={text(deal.value)} onCommit={(digits) => { if (digits !== digitsOf(deal.value)) saveField(deal, { value: digits }); }} placeholder="e.g. Rp 25.000.000" /></label>
              </div>
              <label className={s.dealField}><span>Scope</span><textarea defaultValue={text(deal.scope)} onBlur={blur(deal, "scope")} placeholder="What the collaboration covers" rows={2} /></label>
              <label className={s.dealField}><span>Notes</span><textarea defaultValue={text(deal.notes)} onBlur={blur(deal, "notes")} rows={2} /></label>
            </li>
          ))}
        </ul>
      ) : <p className={s.empty}>No deals yet. Choose a {entityLabel} and add one.</p>}
    </section>
  );
}

/* ── Outreach log (timeline by day) ── */
function OutreachView({ rows, outreach, outreachKey, partnerField, entityLabel }: { rows: ApiRecord[]; outreach: ApiRecord[]; outreachKey: string; partnerField: string; entityLabel: string }) {
  const fields = [partnerField, "channel", "tanggal", "isi", "respons", "catatan"];
  const [selectedPartner, setSelectedPartner] = useState("");
  const [pending, start] = useTransition();
  const days = useMemo(() => outreachByDay(outreach), [outreach]);
  const partnerName = (id: unknown) => text(rows.find((row) => String(row.id) === String(id))?.name) || `No ${entityLabel}`;
  const saveField = (log: ApiRecord, patch: Record<string, unknown>) => start(() => guard(async () => { await updateManagedRecord(outreachKey, String(log.id), buildFd(fields, { ...log, ...patch })); }, "Could not save the changes."));
  const add = () => start(() => guard(async () => { await createManagedRecord(outreachKey, buildFd(fields, { [partnerField]: selectedPartner || null, channel: "WhatsApp", tanggal: localIso(new Date()), respons: "No Reply" })); }, "Could not add the outreach log."));
  const remove = async (log: ApiRecord) => { if (await confirmAction({ title: `Delete this outreach to ${partnerName(log[partnerField])}?`, confirmLabel: "Delete outreach log", danger: true })) start(() => guard(async () => { await deleteManagedRecord(outreachKey, String(log.id)); }, "Could not delete the outreach log.")); };
  const blur = (log: ApiRecord, key: string) => (event: React.FocusEvent<HTMLInputElement>) => { if (event.target.value !== text(log[key])) saveField(log, { [key]: event.target.value }); };

  return (
    <section aria-label="Outreach log" className={s.stack}>
      <div className={s.addBar}>
        <p>Every message, call or meeting with a {entityLabel}, newest first. Edit right in place.</p>
        <label className={s.filterPill}><span>{entityLabel[0].toUpperCase() + entityLabel.slice(1)}</span><select aria-label={`Outreach ${entityLabel}`} onChange={(event) => setSelectedPartner(event.target.value)} value={selectedPartner}><option value="">Choose…</option>{rows.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}</select></label>
        <Button disabled={pending} onClick={add}><i className="ti ti-plus" aria-hidden="true" /> Log outreach</Button>
      </div>
      {days.length ? days.map(({ date, logs }) => (
        <div className={s.dayGroup} key={date || "none"}>
          <h3>{date ? shortDate(date) : "No date"}</h3>
          <ul className={s.timeline}>
            {logs.map((log) => (
              <li className={s.log} data-record-id={String(log.id)} key={String(log.id)}>
                <span className={s.channel} aria-hidden="true"><i className={`ti ${CHANNEL_ICON[text(log.channel)] || "ti-message"}`} /></span>
                <div className={s.logBody}>
                  <div className={s.logHead}>
                    <b>{partnerName(log[partnerField])}</b>
                    <select aria-label="Channel" className={s.inlineSelect} defaultValue={text(log.channel) || "WhatsApp"} onChange={(event) => saveField(log, { channel: event.target.value })}>{CHANNELS.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                    <DateInput aria-label="Date" className={s.inlineDate} defaultValue={dayValue(log.tanggal)} onChange={(event) => saveField(log, { tanggal: event.target.value })}  />
                    <select aria-label="Response" className={text(log.respons) === "Declined" ? s.responseOff : text(log.respons) === "No Reply" || !text(log.respons) ? s.responseWait : s.responseOn} defaultValue={text(log.respons) || "No Reply"} onChange={(event) => saveField(log, { respons: event.target.value })}>{RESPONSES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                    <button aria-label="Delete outreach log" className={s.iconButton} onClick={() => remove(log)} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
                  </div>
                  <input aria-label="What was sent" className={s.inlineText} defaultValue={text(log.isi)} onBlur={blur(log, "isi")} placeholder="What was sent or discussed" />
                  <input aria-label="Notes" className={s.inlineNote} defaultValue={text(log.catatan)} onBlur={blur(log, "catatan")} placeholder="Notes" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )) : <p className={s.empty}>No outreach logged yet.</p>}
    </section>
  );
}

/* ── Insights ── */
function InsightsView({ rows, summary, activity, entityLabel, onEdit }: { rows: ApiRecord[]; summary: ReturnType<typeof partnerSummary>; activity: Activity; entityLabel: string; onEdit: (record: ApiRecord) => void }) {
  const stats: Array<[string, number]> = [[`Total ${entityLabel}s`, summary.total], ["In progress", summary.open], ["Negotiation", summary.negotiation], ["Closed deal", summary.closed], ["Strategic tier", summary.strategic]];
  const recent = [...rows].sort((a, b) => dayValue(b.input_date || b.created_at).localeCompare(dayValue(a.input_date || a.created_at))).slice(0, 8);
  return (
    <>
      <div className={s.stats}>{stats.map(([label, value]) => <div className={s.stat} key={label}><span>{label}</span><b>{value}</b></div>)}</div>
      <div className={s.insightGrid}>
        <Distribution rows={distribution(rows, "status")} title="Pipeline stage" />
        <Distribution rows={distribution(rows, "category")} title="Category" />
        <Distribution rows={distribution(rows, "tier")} title="Tier" />
      </div>
      <section aria-labelledby="partner-recent" className={s.listCard}>
        <h3 className={s.panelTitle} id="partner-recent">Recently added</h3>
        {recent.length ? (
          <ul className={s.rows}>
            {recent.map((row) => (
              <li className={s.row} key={String(row.id)}>
                <button className={s.rowMainCompact} onClick={() => onEdit(row)} type="button">
                  <span className={s.logo} aria-hidden="true">{initials(row.name)}</span>
                  <span className={s.rowText}><b>{text(row.name)}</b><small>{text(row.category) || "—"} · {text(row.contact_name) || "No PIC yet"}</small></span>
                  <PartnerMeta activity={activity} row={row} />
                  <span className={text(row.status) === "Closed Deal" ? s.chipDone : s.chip}>{text(row.status) || "Approached"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className={s.empty}>No {entityLabel}s yet.</p>}
      </section>
    </>
  );
}

function Distribution({ title, rows }: { title: string; rows: [string, number][] }) {
  const maximum = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <section className={s.panel} aria-label={title}>
      <h3 className={s.panelTitle}>{title}</h3>
      {rows.length ? rows.map(([label, value]) => <div className={s.distRow} key={label}><span>{label}</span><i style={{ width: `${(value / maximum) * 100}%` }} /><b>{value}</b></div>) : <p className={s.emptySmall}>No data yet.</p>}
    </section>
  );
}

/* ── Add / Edit partner modal ── */
function PartnerModal({ profile, tableKey, categories, defaultStatus, onClose }: { profile: ApiRecord | null; tableKey: string; categories: string[]; defaultStatus?: string; onClose: () => void }) {
  const [form, setForm] = useState({
    name: text(profile?.name), category: text(profile?.category), tier: text(profile?.tier) || "Standard", status: text(profile?.status) || defaultStatus || "Approached",
    contact_name: text(profile?.contact_name), pos: text(profile?.pos), contact_phone: text(profile?.contact_phone), contact_email: text(profile?.contact_email),
    li: text(profile?.li), scope: text(profile?.scope), notes: text(profile?.notes), input_date: dayValue(profile?.input_date),
  });
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const [nameInvalid, setNameInvalid] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function save() {
    if (!form.name.trim()) { setNameInvalid(true); nameRef.current?.focus(); notify("Company name is required.", "error"); return; }
    const fd = buildFd(PARTNER_FIELDS, { ...form, type: "Corporate" });
    start(async () => {
      try {
        if (profile) await updateManagedRecord(tableKey, String(profile.id), fd);
        else await createManagedRecord(tableKey, fd);
        onClose();
      } catch (error) { notifyError(error, "Could not save partner."); }
    });
  }

  const labelClass = "mb-1 block text-xs font-medium text-foreground";
  const inputClass = "w-full rounded-[var(--radius)] border border-[var(--border-md)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--purple-accent)]";

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose(); }} open>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]" showCloseButton={false}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0"><DialogTitle className="text-base font-bold">{profile ? text(profile.name) || "Edit partner" : "Add partner"}</DialogTitle><DialogDescription className="text-xs">{profile ? "Edit partner details" : "New partner"} · fields marked * are required.</DialogDescription></div>
          <button aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-[var(--bg)] hover:text-foreground" onClick={onClose} type="button"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto p-5">
          <label className="block"><span className={labelClass}>Company name <span aria-hidden="true" className="text-[var(--red)]">*</span></span><input aria-invalid={nameInvalid || undefined} required className={nameInvalid ? `${inputClass} border-[var(--red)] ring-2 ring-[var(--red-bg)]` : inputClass} onChange={(event) => { set({ name: event.target.value }); if (nameInvalid) setNameInvalid(false); }} placeholder="Company or organization" ref={nameRef} value={form.name} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={labelClass}>Category</span><select className={inputClass} onChange={(event) => set({ category: event.target.value })} value={form.category}><option value="">Select category</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}{form.category && !categories.includes(form.category) ? <option value={form.category}>{form.category}</option> : null}</select></label>
            <label className="block"><span className={labelClass}>Tier</span><select className={inputClass} onChange={(event) => set({ tier: event.target.value })} value={form.tier}>{TIERS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={labelClass}>Status</span><select className={inputClass} onChange={(event) => set({ status: event.target.value })} value={form.status}>{STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="block"><span className={labelClass}>Date added</span><DateInput className={inputClass} onChange={(event) => set({ input_date: event.target.value })}  value={form.input_date} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={labelClass}>PIC</span><input className={inputClass} onChange={(event) => set({ contact_name: event.target.value })} value={form.contact_name} /></label>
            <label className="block"><span className={labelClass}>PIC position</span><input className={inputClass} onChange={(event) => set({ pos: event.target.value })} value={form.pos} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={labelClass}>WhatsApp</span><input className={inputClass} onChange={(event) => set({ contact_phone: event.target.value })} value={form.contact_phone} /></label>
            <label className="block"><span className={labelClass}>Email</span><input className={inputClass} onChange={(event) => set({ contact_email: event.target.value })} type="email" value={form.contact_email} /></label>
          </div>
          <label className="block"><span className={labelClass}>LinkedIn</span><input className={inputClass} onChange={(event) => set({ li: event.target.value })} placeholder="https://linkedin.com/..." value={form.li} /></label>
          <label className="block"><span className={labelClass}>Partnership scope</span><textarea className={inputClass} onChange={(event) => set({ scope: event.target.value })} rows={2} value={form.scope} /></label>
          <label className="block"><span className={labelClass}>Notes</span><textarea className={inputClass} onChange={(event) => set({ notes: event.target.value })} rows={2} value={form.notes} /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">Cancel</Button>
          <Button disabled={pending} onClick={save} size="sm" type="button"><i aria-hidden="true" className="ti ti-check" /> {pending ? "Saving…" : "Save partner"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
