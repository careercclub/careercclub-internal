"use client";

import { bulkUpdateCrmBuyers } from "@/app/actions/crm-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import type { DailyBlastCount, EmailBlastRecord } from "@/lib/api/email-blast";
import { crmSummary, CRM_STATUSES, filterCustomers, FUNNEL, funnelStage, groupCustomers, inTalentPool, rupiah, statusLabel, type CrmFilter, type Customer } from "@/lib/crm/view";
import { initials, shortDate } from "@/lib/dashboard/summary";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AnalyticsCard, BarBreakdown, DonutBreakdown, downloadJson, freq, freqMulti, type Entry } from "./analytics-cards";
import { confirmAction } from "./app-dialog";
import { CrmEmailBlast } from "./crm-email-blast";
import { CrmTools } from "./crm-tools";
import s from "./crm-workspace.module.css";
import { Pagination, usePagination } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";
import { DialogBehaviour } from "./use-modal";
import { compareText } from "@/lib/text/sort";
import { formatRupiah } from "@/lib/text/money";

// CRM in the IJIS layout: a blast funnel you can click, a buyer list (one status per buyer),
// a floating bar for bulk actions and a customer drawer with the purchase timeline.

type View = "buyers" | "blast" | "import" | "analytics";
const EMPTY: CrmFilter = { query: "", stage: "", classification: "", payment: "", pool: "", repeat: "", industry: "", tahap: "", source: "", status: "" };

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function unique(rows: Customer[], key: string) { return [...new Set(rows.map((row) => text(row[key])).filter(Boolean))].sort(compareText); }
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function dateLabel(value: unknown) { const key = text(value).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(key) ? shortDate(key, false) + ` ${key.slice(0, 4)}` : text(value) || "—"; }
function waLink(value: unknown) { let d = text(value).replace(/\D/g, ""); if (d.startsWith("0")) d = `62${d.slice(1)}`; else if (d.startsWith("8")) d = `62${d}`; return d ? `https://wa.me/${d}` : ""; }

export function CrmWorkspace({ rows, blastHistory = [], blastDaily = [] }: { rows: ApiRecord[]; blastHistory?: EmailBlastRecord[]; blastDaily?: DailyBlastCount[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>("buyers");
  const [filter, setFilter] = useState<CrmFilter>(EMPTY);
  const [moreFilters, setMoreFilters] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [detailKey, setDetailKey] = useState("");
  const [bulkStatus, setBulkStatus] = useState(""); const [bulkPool, setBulkPool] = useState("");
  const [message, setMessage] = useState(""); const [pending, startTransition] = useTransition();

  const customers = useMemo(() => groupCustomers(rows), [rows]);
  const summary = useMemo(() => crmSummary(customers), [customers]);
  const filtered = useMemo(() => filterCustomers(customers, filter), [customers, filter]);
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);
  const detail = customers.find((row) => row._key === detailKey);
  const set = (patch: CrmFilter) => { setFilter((current) => ({ ...current, ...patch })); setPage(0); };
  const filtersOn = Object.entries(filter).some(([key, value]) => key !== "stage" && Boolean(value));

  // Search result opened: a buyer can hold several transactions, so match on any of its ids.
  useRecordFocus((id) => {
    const customer = customers.find((row) => row.ids.includes(id));
    if (!customer) return;
    setView("buyers"); setFilter(EMPTY); setDetailKey(customer._key);
    return true;
  });

  const selectedIds = customers.filter((row) => selected.includes(row._key)).flatMap((row) => row.ids);
  const allOnPage = pageItems.length > 0 && pageItems.every((row) => selected.includes(row._key));
  const toggle = (key: string, on: boolean) => setSelected((current) => on ? [...new Set([...current, key])] : current.filter((item) => item !== key));

  async function mutate(operation: "status" | "talent" | "delete", value?: string) {
    if (!selectedIds.length) return;
    if (operation === "delete" && !(await confirmAction({ title: `Delete ${selectedIds.length} transaction${selectedIds.length === 1 ? "" : "s"}?`, message: "This cannot be undone.", confirmLabel: selectedIds.length === 1 ? "Delete transaction" : "Delete transactions", danger: true }))) return;
    startTransition(async () => {
      try { await bulkUpdateCrmBuyers(selectedIds, operation, value); setSelected([]); setBulkStatus(""); setBulkPool(""); setMessage("CRM records updated."); router.refresh(); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); }
    });
  }
  function exportCsv() {
    const data = selected.length ? filtered.filter((row) => selected.includes(row._key)) : filtered;
    const csv = [["Name", "WhatsApp", "Email", "Product", "Classification", "Spend", "Transactions", "Industry", "Stage", "Source", "Status", "Payment"], ...data.map((row) => [row.name, row.wa, row.email, row.produk, row.klasifikasi, row.spend, row.txCount, row.industri, row.tahap, row.sumber, row.status, row.payment_status])].map((line) => line.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ccc-crm-buyers.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  const views: Array<[View, string]> = [["buyers", "Buyers"], ["blast", "Email blast"], ["import", "Import"], ["analytics", "Analytics"]];

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Operations</span>
          <h1>CRM</h1>
          <p>{summary.buyers} buyers · {summary.transactions} transactions · {rupiah(summary.spend)} total spend</p>
        </div>
        <Link className={s.ghostButton} href="/crm/deals"><i className="ti ti-layout-kanban" aria-hidden="true" /> Deals pipeline</Link>
      </header>

      <div className={s.segmented} role="tablist" aria-label="CRM view">
        {views.map(([id, label]) => <button aria-selected={view === id} className={view === id ? s.segmentActive : s.segment} key={id} onClick={() => setView(id)} role="tab" type="button">{label}{id === "buyers" ? <span>{summary.buyers}</span> : null}</button>)}
      </div>

      {message ? <p className={s.message} role="status">{message}</p> : null}

      {view === "buyers" ? (
        <>
          <nav aria-label="Blast funnel" className={s.funnel}>
            {FUNNEL.map(([id, label], index) => {
              const count = summary.funnel[id]; const on = filter.stage === id;
              return (
                <button aria-pressed={on} className={on ? s.stageOn : s.stage} key={id} onClick={() => set({ stage: on ? "" : id })} type="button">
                  <span className={s.stageStep}>{index + 1}</span>
                  <span className={s.stageText}><b>{count}</b><small>{label}</small></span>
                  <span className={s.stagePct}>{summary.buyers ? Math.round((count / summary.buyers) * 100) : 0}%</span>
                </button>
              );
            })}
          </nav>

          <div className={s.toolbar}>
            <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search buyers" onChange={(e) => set({ query: e.target.value })} placeholder="Search name, WA, email, product…" value={filter.query} /></label>
            <label className={s.filterPill}><span>Product</span><select aria-label="Filter classification" onChange={(e) => set({ classification: e.target.value })} value={filter.classification}><option value="">All</option>{unique(customers, "klasifikasi").map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className={s.filterPill}><span>Payment</span><select aria-label="Filter payment" onChange={(e) => set({ payment: e.target.value })} value={filter.payment}><option value="">All</option><option value="SUCCESS">Success</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="none">No status</option></select></label>
            <label className={s.filterPill}><span>Talent Pool</span><select aria-label="Filter talent pool" onChange={(e) => set({ pool: e.target.value as CrmFilter["pool"] })} value={filter.pool}><option value="">All</option><option value="yes">In pool</option><option value="no">Not in pool ({summary.notInPool})</option></select></label>
            <button aria-expanded={moreFilters} className={s.morePill} onClick={() => setMoreFilters((v) => !v)} type="button"><i className="ti ti-adjustments-horizontal" aria-hidden="true" /> More filters</button>
            {filtersOn ? <button className={s.clear} onClick={() => set({ ...EMPTY, stage: filter.stage })} type="button">Clear filters</button> : null}
          </div>
          {moreFilters ? (
            <div className={s.toolbar}>
              <label className={s.filterPill}><span>Status</span><select aria-label="Filter blast status" onChange={(e) => set({ status: e.target.value })} value={filter.status}><option value="">All</option>{CRM_STATUSES.map((v) => <option key={v} value={v}>{statusLabel(v)}</option>)}</select></label>
              <label className={s.filterPill}><span>Industry</span><select aria-label="Filter industry" onChange={(e) => set({ industry: e.target.value })} value={filter.industry}><option value="">All</option>{unique(customers, "industri").map((v) => <option key={v}>{v}</option>)}</select></label>
              <label className={s.filterPill}><span>Stage</span><select aria-label="Filter stage" onChange={(e) => set({ tahap: e.target.value })} value={filter.tahap}><option value="">All</option>{unique(customers, "tahap").map((v) => <option key={v}>{v}</option>)}</select></label>
              <label className={s.filterPill}><span>Source</span><select aria-label="Filter source" onChange={(e) => set({ source: e.target.value })} value={filter.source}><option value="">All</option>{unique(customers, "sumber").map((v) => <option key={v}>{v}</option>)}</select></label>
              <label className={s.filterPill}><span>Orders</span><select aria-label="Filter order history" onChange={(e) => set({ repeat: e.target.value as CrmFilter["repeat"] })} value={filter.repeat}><option value="">All</option><option value="repeat">Repeat ({summary.repeat})</option><option value="single">One order</option></select></label>
            </div>
          ) : null}

          <section aria-label="Buyers" className={s.listCard}>
            <div className={s.listHead}>
              <label className={s.checkAll}><input aria-label="Select all buyers on this page" checked={allOnPage} onChange={(e) => pageItems.forEach((row) => toggle(row._key, e.target.checked))} type="checkbox" /> <span>{filtered.length === customers.length ? `${customers.length} buyers` : `${filtered.length} of ${customers.length} buyers`}</span></label>
              <button className={s.linkButton} onClick={exportCsv} type="button"><i className="ti ti-download" aria-hidden="true" /> Export CSV</button>
            </div>
            {filtered.length ? (
              <ul className={s.rows}>
                {pageItems.map((row) => {
                  const name = text(row.name) || "Unknown"; const stage = funnelStage(row.status); const pay = text(row.payment_status);
                  return (
                    <li className={selected.includes(row._key) ? s.rowSelected : s.row} data-record-ids={row.ids.join(" ")} key={row._key}>
                      <input aria-label={`Select ${name}`} checked={selected.includes(row._key)} className={s.rowCheck} onChange={(e) => toggle(row._key, e.target.checked)} type="checkbox" />
                      <button className={s.rowMain} data-record-open onClick={() => setDetailKey(row._key)} type="button">
                        <span className={s.avatar} aria-hidden="true">{initials(name)}</span>
                        <span className={s.who}><b>{name}</b><small>{[text(row.wa), text(row.email)].filter(Boolean).join(" · ") || "—"}</small></span>
                        <span className={s.product}><b>{text(row.produk) || "—"}</b><small>{[text(row.klasifikasi) || "Unclassified", !inTalentPool(row) ? "not in Talent Pool" : ""].filter(Boolean).join(" · ")}</small></span>
                        <span className={s.spend}><b>{formatRupiah(row.spend)}</b><small>{row.txCount > 1 ? `${row.txCount} orders` : "1 order"}{pay === "FAILED" ? " · " : ""}{pay === "FAILED" ? <em className={s.failed}>payment failed</em> : pay === "PENDING" ? " · pending" : ""}</small></span>
                        <span className={stage === "converted" ? s.chipDone : stage === "new" ? s.chipNew : s.chip}>{statusLabel(row.status)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className={s.empty}>{customers.length ? "No buyers match these filters." : "No buyers yet. Import transactions first."}</p>}
            <Pagination onChange={setPage} page={page} totalPages={totalPages} />
          </section>

          {selected.length ? (
            <div aria-label="Bulk actions" className={s.bulk} role="region">
              <strong>{selected.length} selected</strong>
              <label className={s.bulkField}><span className="sr-only">New status</span><select aria-label="New status" onChange={(e) => setBulkStatus(e.target.value)} value={bulkStatus}><option value="">Set status…</option>{CRM_STATUSES.map((v) => <option key={v} value={v}>{statusLabel(v)}</option>)}</select></label>
              <button className={s.bulkButton} disabled={!bulkStatus || pending} onClick={() => mutate("status", bulkStatus)} type="button">Apply status</button>
              <label className={s.bulkField}><span className="sr-only">Talent Pool</span><select aria-label="Talent Pool" onChange={(e) => setBulkPool(e.target.value)} value={bulkPool}><option value="">Talent Pool…</option><option value="yes">Mark in pool</option><option value="no">Mark not in pool</option></select></label>
              <button className={s.bulkButton} disabled={!bulkPool || pending} onClick={() => mutate("talent", bulkPool)} type="button">Apply talent pool</button>
              <button className={s.bulkButton} onClick={exportCsv} type="button"><i className="ti ti-download" aria-hidden="true" /> Export CSV for blast</button>
              <button className={s.bulkDanger} disabled={pending} onClick={() => mutate("delete")} type="button"><i className="ti ti-trash" aria-hidden="true" /> Delete selected ({selected.length})</button>
              <button aria-label="Clear selection" className={s.bulkClose} onClick={() => setSelected([])} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
          ) : null}
        </>
      ) : null}

      {view === "analytics" ? <CrmAnalytics customers={customers} /> : null}
      {view === "blast" ? <CrmEmailBlast daily={blastDaily} history={blastHistory} rows={customers} /> : null}
      {view === "import" ? <CrmTools rows={rows} /> : null}

      {detail ? <CustomerDrawer customer={detail} onClose={() => setDetailKey("")} /> : null}
    </div>
  );
}

function CustomerDrawer({ customer: c, onClose }: { customer: Customer; onClose: () => void }) {
  const name = text(c.name) || "Unknown"; const wa = waLink(c.wa);
  const timeline = [...c.transactions].sort((a, b) => text(b.tanggal).localeCompare(text(a.tanggal)));
  const field = (label: string, value: unknown) => (text(value) ? <div><dt>{label}</dt><dd>{text(value)}</dd></div> : null);
  return (
    <div className={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Customer detail">
      <DialogBehaviour onClose={onClose} />
      <section className={s.drawer}>
        <header className={s.drawerHead}>
          <span className={s.avatarLg} aria-hidden="true">{initials(name)}</span>
          <div className={s.drawerTitle}><span>Customer detail</span><h2>{name}</h2><p>{[text(c.wa), text(c.email)].filter(Boolean).join(" · ") || "—"}</p></div>
          <button aria-label="Close customer detail" className={s.close} onClick={onClose} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
        </header>
        <div className={s.contact}>
          {wa ? <a href={wa} rel="noopener" target="_blank"><i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp</a> : null}
          {text(c.email) ? <a href={`mailto:${text(c.email)}`}><i className="ti ti-mail" aria-hidden="true" /> Email</a> : null}
        </div>
        <div className={s.numbers}>
          <div><b>{c.txCount}</b><span>Orders</span></div>
          <div><b>{formatRupiah(c.spend)}</b><span>Total spend</span></div>
          <div><b className={s.numberText}>{statusLabel(c.status)}</b><span>Status</span></div>
        </div>
        <h3>Details</h3>
        <dl className={s.fields}>
          {field("Classification", c.klasifikasi)}{field("Industry", c.industri)}{field("Stage", c.tahap)}{field("Source", c.sumber)}{field("Payment", c.payment_status)}
          <div><dt>Talent Pool</dt><dd>{inTalentPool(c) ? "In pool" : "Not in pool"}</dd></div>
        </dl>
        <h3>Purchase history</h3>
        <ol className={s.timeline}>
          {timeline.map((tx, index) => (
            <li key={`${tx.produk}-${index}`}>
              <span className={s.dot} aria-hidden="true" />
              <div><b>{text(tx.produk) || "—"}</b><small>{dateLabel(tx.tanggal)} · {text(tx.klasifikasi) || "Unclassified"}{tx.paymentStatus ? ` · ${tx.paymentStatus}` : ""}</small></div>
              <span className={s.txAmount}>{formatRupiah(Number(tx.harga || 0))}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function CrmAnalytics({ customers }: { customers: Customer[] }) {
  const total = customers.length;
  const data = useMemo(() => {
    // Repeat orders by exact count, first bucket "1x (new)", axis ordered numerically.
    const counts = new Map<string, number>();
    customers.forEach((row) => { const key = row.txCount === 1 ? "1x (new)" : `${row.txCount}x`; counts.set(key, (counts.get(key) || 0) + 1); });
    const pool = customers.filter(inTalentPool).length;
    // Payment is counted per transaction, not per buyer, so it has its own total.
    const payments = customers.flatMap((row) => row.transactions.map((tx) => tx.paymentStatus).filter(Boolean));
    return {
      repeat: [...counts.entries()].sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10)) as Entry[],
      pool: [["In pool", pool], ["Not in pool", total - pool]] as Entry[],
      klas: freq(customers.map((row) => row.klasifikasi)), tahap: freq(customers.map((row) => row.tahap)), source: freq(customers.map((row) => row.sumber)),
      industry: freqMulti(customers.map((row) => row.industri), true), payment: freq(payments), paymentTotal: payments.length,
    };
  }, [customers, total]);
  return (
    <div className={s.analytics}>
      <div className={s.analyticsHead}><p>Breakdown of all {total} buyers</p><button className={s.ghostButton} onClick={() => downloadJson(customers, `crm-analytics-${new Date().toISOString().slice(0, 10)}.json`)} type="button"><i className="ti ti-download" aria-hidden="true" /> Export JSON</button></div>
      <div className={s.analyticsGrid}>
        <AnalyticsCard icon="ti-repeat" title="Repeat orders" total={total}><BarBreakdown entries={data.repeat} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-tag" title="Product classification" total={total}><DonutBreakdown entries={data.klas} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-user-check" title="Talent Pool" total={total}><DonutBreakdown entries={data.pool} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-stairs" title="Stage" total={total}><BarBreakdown entries={data.tahap} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-building-factory" title="Industries of interest" total={total}><BarBreakdown entries={data.industry} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-source-code" title="Source" total={total}><DonutBreakdown entries={data.source} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-credit-card" title="Payment status" total={data.paymentTotal}><DonutBreakdown entries={data.payment} total={data.paymentTotal} /></AnalyticsCard>
      </div>
    </div>
  );
}
