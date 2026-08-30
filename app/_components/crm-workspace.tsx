"use client";

import { bulkUpdateCrmBuyers } from "@/app/actions/crm-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { DailyBlastCount, EmailBlastRecord } from "@/lib/api/email-blast";
import { AnalyticsCard, AnalyticsHeader, analyticsGrid, BarBreakdown, DonutBreakdown, downloadJson, freq, freqMulti, type Entry } from "./analytics-cards";
import { CrmEmailBlast } from "./crm-email-blast";
import { CrmTools } from "./crm-tools";
import { Pagination, usePagination } from "./ui-kit";
import styles from "./crm.module.css";

type Transaction = { produk?: string; klasifikasi?: string; harga?: number; tanggal?: string; paymentStatus?: string };
type Customer = ApiRecord & { ids: string[]; transactions: Transaction[]; spend: number; txCount: number };
const crmStatuses = ["Belum diblast", "Diblast", "Sedang di-upsell", "Sedang di-downsell", "Sedang di-cross sell", "Sudah convert — Upsell", "Sudah convert — Downsell", "Sudah convert — Cross sell"];

const KLAS_PILL: Record<string, string> = { "Bundling Package": "pillPurple", "Elearning": "pillBlue", "Optimasi Screening": "pillTeal", "Psikotes": "pillAmber", "E-book MT": "pillCoral", "Database MT": "pillPink", "Belum Diklasifikasi": "pillGray" };
const STATUS_PILL: Record<string, string> = { "Belum diblast": "pillGray", "Diblast": "pillBlue", "Sedang di-upsell": "pillPurple", "Sedang di-downsell": "pillAmber", "Sedang di-cross sell": "pillPurple", "Sudah convert — Upsell": "pillGreen", "Sudah convert — Downsell": "pillGreen", "Sudah convert — Cross sell": "pillGreen" };
const PAYMENT_STYLE: Record<string, { color: string; bg: string; icon: string }> = { SUCCESS: { color: "#1a7a4a", bg: "#d1fae5", icon: "ti-circle-check" }, PENDING: { color: "#b45309", bg: "#fef3c7", icon: "ti-clock" }, FAILED: { color: "#b91c1c", bg: "#fee2e2", icon: "ti-circle-x" } };
const styleMap = styles as Record<string, string>;

function normalizedWa(value: unknown) { let digits = String(value || "").replace(/\D/g, ""); if (digits.startsWith("0")) digits = `62${digits.slice(1)}`; else if (digits.startsWith("8")) digits = `62${digits}`; return digits; }
function history(row: ApiRecord): Transaction[] { const value = Array.isArray(row.riwayat) ? row.riwayat as Transaction[] : []; return value.length ? value : [{ produk: String(row.produk || ""), klasifikasi: String(row.klasifikasi || ""), harga: Number(row.harga || 0), tanggal: String(row.tanggal || "") }]; }
function unique(rows: Customer[], key: string) { return [...new Set(rows.map((row) => String(row[key] || "")).filter(Boolean))].sort(); }
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function rupiahK(value: number) { return `Rp${(value / 1000).toFixed(0)}k`; }
function klasPillClass(value: string) { return styleMap[KLAS_PILL[value] || "pillGray"]; }
function statusPillClass(value: string) { return styleMap[STATUS_PILL[value] || "pillGray"]; }

function PaymentPill({ status }: { status: string }) {
  if (!status) return <span className={styles.paymentNone}>—</span>;
  const style = PAYMENT_STYLE[status] || { color: "#6b7280", bg: "#f3f4f6", icon: "ti-help" };
  return <span className={styles.paymentPill} style={{ color: style.color, background: style.bg }}><i className={`ti ${style.icon}`} style={{ fontSize: 10 }} />{status}</span>;
}

export function CrmWorkspace({ rows, blastHistory = [], blastDaily = [] }: { rows: ApiRecord[]; blastHistory?: EmailBlastRecord[]; blastDaily?: DailyBlastCount[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"buyers" | "analytics" | "blast" | "import">("buyers");
  const [query, setQuery] = useState(""); const [classification, setClassification] = useState(""); const [industry, setIndustry] = useState(""); const [stage, setStage] = useState(""); const [status, setStatus] = useState(""); const [talent, setTalent] = useState(""); const [source, setSource] = useState(""); const [payment, setPayment] = useState(""); const [repeat, setRepeat] = useState("");
  const [selected, setSelected] = useState<string[]>([]); const [detailKey, setDetailKey] = useState(""); const [bulkStatus, setBulkStatus] = useState(""); const [bulkPool, setBulkPool] = useState(""); const [message, setMessage] = useState(""); const [pending, startTransition] = useTransition();
  const customers = useMemo(() => {
    const groups = new Map<string, ApiRecord[]>();
    rows.forEach((row) => { const key = normalizedWa(row.wa) || String(row.email || row.id); groups.set(key, [...(groups.get(key) || []), row]); });
    return [...groups.entries()].map(([key, group]) => { const sorted = [...group].sort((a, b) => String(b.tanggal || b.created_at || "").localeCompare(String(a.tanggal || a.created_at || ""))); const latest = sorted[0]; const transactions = group.flatMap(history); return { ...latest, _key: key, ids: group.map((row) => String(row.id)), transactions, txCount: transactions.length, spend: transactions.reduce((sum, item) => sum + Number(item.harga || 0), 0) } as Customer; });
  }, [rows]);
  const filtered = useMemo(() => customers.filter((row) => {
    const search = `${row.name} ${row.wa} ${row.email} ${row.produk}`.toLowerCase();
    return (!query || search.includes(query.toLowerCase())) && (!classification || row.klasifikasi === classification) && (!industry || row.industri === industry) && (!stage || row.tahap === stage) && (!status || row.status === status) && (!talent || (talent === "yes") === Boolean(row.talent_pool || row.talent_pool_match)) && (!source || row.sumber === source) && (!payment || (payment === "none" ? !row.payment_status : row.payment_status === payment)) && (!repeat || (repeat === "repeat" ? row.txCount > 1 : row.txCount === 1));
  }), [customers, query, classification, industry, stage, status, talent, source, payment, repeat]);
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 15);
  const detail = customers.find((row) => String(row._key) === detailKey);
  const selectedIds = customers.filter((row) => selected.includes(String(row._key))).flatMap((row) => row.ids);
  const stats = { buyers: customers.length, transactions: customers.reduce((sum, row) => sum + row.txCount, 0), noPool: customers.filter((row) => !(row.talent_pool || row.talent_pool_match)).length, blasting: customers.filter((row) => String(row.status || "").includes("blast")).length, converted: customers.filter((row) => String(row.status || "").includes("convert")).length };

  function mutate(operation: "status" | "talent" | "delete", value?: string) { if (!selectedIds.length) return; if (operation === "delete" && !window.confirm(`Hapus ${selectedIds.length} transaksi?`)) return; startTransition(async () => { try { await bulkUpdateCrmBuyers(selectedIds, operation, value); setSelected([]); setMessage("CRM records updated."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); } }); }
  function exportCsv() { const data = selected.length ? filtered.filter((row) => selected.includes(String(row._key))) : filtered; const csv = [["Name","WhatsApp","Email","Product","Classification","Spend","Transactions","Industry","Stage","Source","Status","Payment"], ...data.map((row) => [row.name,row.wa,row.email,row.produk,row.klasifikasi,row.spend,row.txCount,row.industri,row.tahap,row.sumber,row.status,row.payment_status])].map((line) => line.map(csvCell).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ccc-crm-buyers.csv"; anchor.click(); URL.revokeObjectURL(url); }

  return (
    <div>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}><div className={styles.statLabel}>Total Buyers</div><div className={styles.statVal}>{stats.buyers}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Total Transaksi</div><div className={styles.statVal}>{stats.transactions}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Belum Isi Pool</div><div className={styles.statVal} style={{ color: "var(--red)" }}>{stats.noPool}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Sedang Diblast</div><div className={styles.statVal} style={{ color: "var(--blue)" }}>{stats.blasting}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Sudah Convert</div><div className={styles.statVal} style={{ color: "var(--green)" }}>{stats.converted}</div></div>
      </div>
      <div className={styles.card}>
        <nav className={styles.tabRow}>
          <button className={tab === "buyers" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab("buyers")} type="button">Data Buyers</button>
          <Link className={styles.tab} href="/crm/deals"><i className="ti ti-layout-kanban" style={{ fontSize: 12 }} /> Pipeline</Link>
          <button className={tab === "blast" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab("blast")} type="button"><i className="ti ti-send" style={{ fontSize: 12 }} /> Email Blast</button>
          <button className={tab === "import" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab("import")} type="button">Import</button>
          <button className={tab === "analytics" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab("analytics")} type="button"><i className="ti ti-chart-bar" style={{ fontSize: 12 }} /> Analytics</button>
        </nav>
        {message ? <p className={styles.rowCount}>{message}</p> : null}
        {tab === "buyers" ? (
          <>
            <div className={styles.filterBar}>
              <input placeholder="Cari nama, WA, email..." value={query} onChange={(event) => setQuery(event.target.value)} />
              <select value={classification} onChange={(event) => setClassification(event.target.value)}><option value="">Klasifikasi</option>{unique(customers, "klasifikasi").map((value) => <option key={value}>{value}</option>)}</select>
              <select value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">Industri</option>{unique(customers, "industri").map((value) => <option key={value}>{value}</option>)}</select>
              <select value={stage} onChange={(event) => setStage(event.target.value)}><option value="">Tahap</option>{unique(customers, "tahap").map((value) => <option key={value}>{value}</option>)}</select>
              <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Status blast</option>{crmStatuses.map((value) => <option key={value}>{value}</option>)}</select>
              <select value={talent} onChange={(event) => setTalent(event.target.value)}><option value="">Talent pool</option><option value="yes">Sudah isi pool</option><option value="no">Belum isi pool</option></select>
              <select value={source} onChange={(event) => setSource(event.target.value)}><option value="">Sumber</option>{unique(customers, "sumber").map((value) => <option key={value}>{value}</option>)}</select>
              <select value={payment} onChange={(event) => setPayment(event.target.value)}><option value="">Payment</option><option>SUCCESS</option><option>PENDING</option><option>FAILED</option><option value="none">Belum ada status</option></select>
              <select value={repeat} onChange={(event) => setRepeat(event.target.value)}><option value="">Riwayat</option><option value="repeat">{"> 1x"}</option><option value="single">Single transaction</option></select>
              <button className={styles.filterBarBtn} onClick={() => { setQuery(""); setClassification(""); setIndustry(""); setStage(""); setStatus(""); setTalent(""); setSource(""); setPayment(""); setRepeat(""); }} type="button"><i className="ti ti-refresh" style={{ fontSize: 13 }} /></button>
            </div>
            {selected.length ? (
              <div className={styles.actionBar}>
                <strong>{selected.length} dipilih</strong>
                <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option value="">Tandai sebagai...</option>{crmStatuses.map((value) => <option key={value}>{value}</option>)}</select>
                <button className={styles.btn} disabled={!bulkStatus || pending} onClick={() => mutate("status", bulkStatus)} type="button"><i className="ti ti-tag" /> Terapkan</button>
                <select value={bulkPool} onChange={(event) => setBulkPool(event.target.value)}><option value="">Talent pool...</option><option value="yes">Tandai sudah isi</option><option value="no">Tandai belum isi</option></select>
                <button className={styles.btn} disabled={!bulkPool || pending} onClick={() => mutate("talent", bulkPool)} type="button"><i className="ti ti-users" /> Terapkan</button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={exportCsv} type="button"><i className="ti ti-download" /> Download CSV blast</button>
                <button className={`${styles.btn} ${styles.btnDanger}`} disabled={pending} onClick={() => mutate("delete")} type="button"><i className="ti ti-trash" /> Hapus ({selected.length})</button>
              </div>
            ) : null}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={`${styles.th} ${styles.checkboxCol}`}><input checked={filtered.length > 0 && filtered.every((row) => selected.includes(String(row._key)))} onChange={(event) => setSelected(event.target.checked ? filtered.map((row) => String(row._key)) : [])} type="checkbox" /></th>
                    <th className={styles.th}>Nama</th>
                    <th className={styles.th}>WA</th>
                    <th className={styles.th}>Email</th>
                    <th className={styles.th}>Klasifikasi</th>
                    <th className={styles.th}>Produk terakhir</th>
                    <th className={styles.th}>Harga</th>
                    <th className={styles.th}>Industri</th>
                    <th className={styles.th}>Tahap</th>
                    <th className={styles.th}>Sumber</th>
                    <th className={styles.th}>Blast status</th>
                    <th className={styles.th}>Payment</th>
                    <th className={styles.th}>Pool</th>
                    <th className={styles.th}>Riwayat</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => (
                    <tr key={String(row._key)}>
                      <td className={styles.td}><input checked={selected.includes(String(row._key))} onChange={(event) => setSelected((current) => event.target.checked ? [...current, String(row._key)] : current.filter((key) => key !== String(row._key)))} type="checkbox" /></td>
                      <td className={styles.td}><button className={styles.nameLink} onClick={() => setDetailKey(String(row._key))} type="button">{String(row.name || "-")}</button></td>
                      <td className={styles.td} style={{ fontSize: 11, color: "var(--text-muted)" }}>{String(row.wa || "-")}</td>
                      <td className={styles.td} style={{ fontSize: 11, color: "var(--text-muted)" }}>{String(row.email || "—")}</td>
                      <td className={styles.td}><span className={`${styles.pill} ${klasPillClass(String(row.klasifikasi || ""))}`}>{String(row.klasifikasi || "Belum Diklasifikasi")}</span></td>
                      <td className={styles.td} title={String(row.produk || "")} style={{ fontSize: 11, color: "var(--text-muted)" }}>{String(row.produk || "-")}</td>
                      <td className={styles.td} style={{ fontSize: 11 }}>{rupiahK(row.spend)}</td>
                      <td className={styles.td} style={{ fontSize: 11 }}>{String(row.industri || "-").split(",")[0].trim() || "-"}</td>
                      <td className={styles.td} style={{ fontSize: 11 }}>{String(row.tahap || "—")}</td>
                      <td className={styles.td} style={{ fontSize: 11 }}>{String(row.sumber || "—")}</td>
                      <td className={styles.td}><span className={`${styles.pill} ${statusPillClass(String(row.status || ""))}`}>{String(row.status || "Belum diblast")}</span></td>
                      <td className={styles.td}><PaymentPill status={String(row.payment_status || "")} /></td>
                      <td className={styles.td}><span className={`${styles.talentFlag} ${row.talent_pool || row.talent_pool_match ? styles.flagYes : styles.flagNo}`}><i className={`ti ${row.talent_pool || row.talent_pool_match ? "ti-check" : "ti-x"}`} style={{ fontSize: 10 }} /> {row.talent_pool || row.talent_pool_match ? "Sudah" : "Belum"}</span></td>
                      <td className={styles.td}><button className={styles.txCount} style={{ color: row.txCount > 1 ? "var(--purple-accent)" : "var(--text-muted)" }} onClick={() => setDetailKey(String(row._key))} type="button">{row.txCount}x</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.rowCount}>{filtered.length} dari {customers.length} orang</div>
            <Pagination onChange={setPage} page={page} totalPages={totalPages} />
          </>
        ) : null}
        {tab === "analytics" ? <CrmAnalytics customers={customers} /> : null}
        {tab === "blast" ? <CrmEmailBlast daily={blastDaily} history={blastHistory} rows={customers} /> : null}
        {tab === "import" ? <CrmTools rows={rows} /> : null}
      </div>
      {detail ? (
        <div className={styles.detailOverlay} role="dialog" aria-modal="true">
          <section className={styles.detailPanel}>
            <header className={styles.detailHeader}>
              <div><span>Customer detail</span><h2>{String(detail.name || "Unknown")}</h2><p>{String(detail.wa || "-")} · {String(detail.email || "-")}</p></div>
              <button onClick={() => setDetailKey("")} type="button"><i className="ti ti-x" /></button>
            </header>
            <div className={styles.statsGrid} style={{ gridTemplateColumns: "repeat(3, 1fr)", margin: "12px 0" }}>
              <div className={styles.statCard}><div className={styles.statLabel}>Transaksi</div><div className={styles.statVal}>{detail.txCount}</div></div>
              <div className={styles.statCard}><div className={styles.statLabel}>Total Spend</div><div className={styles.statVal}>{rupiahK(detail.spend)}</div></div>
              <div className={styles.statCard}><div className={styles.statLabel}>Status</div><div className={styles.statVal} style={{ fontSize: 13 }}>{String(detail.status || "-")}</div></div>
            </div>
            <h3>Riwayat transaksi</h3>
            <div className={styles.timelineList}>
              {detail.transactions.map((transaction, index) => (
                <div key={`${transaction.produk}-${index}`}>
                  <strong>{String(transaction.tanggal || "-")}</strong>
                  <span>{String(transaction.produk || "-")} · {String(transaction.klasifikasi || "-")}</span>
                  <span>{rupiahK(Number(transaction.harga || 0))}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

/* ══════════════ ANALYTICS (ported from legacy renderCRMAnalytics) ══════════════ */
function CrmAnalytics({ customers }: { customers: Customer[] }) {
  const total = customers.length;

  // Legacy buckets repeat orders by exact transaction count, labelling the first
  // "1x (new)", and orders the axis numerically rather than by frequency.
  const repeatData: Entry[] = useMemo(() => {
    const counts = new Map<string, number>();
    customers.forEach((row) => { const key = row.txCount === 1 ? "1x (new)" : `${row.txCount}x`; counts.set(key, (counts.get(key) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
  }, [customers]);

  const poolFilled = customers.filter((row) => row.talent_pool || row.talent_pool_match).length;
  const poolData: Entry[] = [["Sudah isi pool", poolFilled], ["Belum isi pool", total - poolFilled]];

  const klasData = useMemo(() => freq(customers.map((row) => row.klasifikasi)), [customers]);
  const tahapData = useMemo(() => freq(customers.map((row) => row.tahap)), [customers]);
  const sumberData = useMemo(() => freq(customers.map((row) => row.sumber)), [customers]);
  // One buyer can list several industries ("FMCG, Finance"); legacy also uppercases.
  const industriData = useMemo(() => freqMulti(customers.map((row) => row.industri), true), [customers]);

  // Payment is counted per transaction, not per buyer, so it has its own total.
  const paymentRaw = useMemo(() => customers.flatMap((row) => row.transactions.map((tx) => tx.paymentStatus).filter(Boolean)), [customers]);
  const paymentData = useMemo(() => freq(paymentRaw), [paymentRaw]);

  return (
    <div>
      <AnalyticsHeader count={`${total} buyers`} onExport={() => downloadJson(customers, `crm-analytics-${new Date().toISOString().slice(0, 10)}.json`)} title="Analytics CRM" />
      <div style={analyticsGrid(3)}>
        <AnalyticsCard icon="ti-repeat" title="Repeat Order" total={total}><BarBreakdown entries={repeatData} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-tag" title="Klasifikasi Produk" total={total}><DonutBreakdown entries={klasData} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-user-check" title="Talent Pool Status" total={total}><DonutBreakdown entries={poolData} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-stairs" title="Tahapan" total={total}><BarBreakdown entries={tahapData} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-building-factory" title="Industri Diminati" total={total}><BarBreakdown entries={industriData} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-source-code" title="Sumber" total={total}><DonutBreakdown entries={sumberData} total={total} /></AnalyticsCard>
      </div>
      <div style={{ ...analyticsGrid(1), marginTop: 12 }}>
        <AnalyticsCard icon="ti-credit-card" title="Status Payment" total={paymentRaw.length}><DonutBreakdown entries={paymentData} total={paymentRaw.length} /></AnalyticsCard>
      </div>
    </div>
  );
}
