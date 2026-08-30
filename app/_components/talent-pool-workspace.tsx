"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AnalyticsCard, AnalyticsHeader, analyticsGrid, ANALYTICS_COLORS_TP, BarBreakdown, DonutBreakdown, downloadJson, freq, freqMulti, type Entry } from "./analytics-cards";
import styles from "./talent-pool.module.css";
import { TalentPoolTools } from "./talent-pool-tools";
import { Pagination, usePagination } from "./ui-kit";

function options(rows: ApiRecord[], field: string) { return [...new Set(rows.map((row) => String(row[field] || "")).filter(Boolean))].sort(); }
function text(value: unknown) { return value === null || value === undefined || value === "" ? "" : String(value); }
function isBuyer(row: ApiRecord) { return Boolean(row.buyer_match) || Boolean(text(row.produk_dibeli)); }
function tagList(value: unknown, className: string) { const items = text(value).split(",").map((item) => item.trim()).filter(Boolean); return items.length ? items.map((item) => <span className={className} key={item}>{item}</span>) : <span style={{ color: "var(--text-hint)" }}>—</span>; }
function initials(name: string) { return name.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?"; }

function DetailField({ label, value, wide }: { label: string; value: unknown; wide?: boolean }) {
  if (!text(value)) return null;
  return <div className={`${styles.detailField}${wide ? ` ${styles.detailFieldWide}` : ""}`}><span>{label}</span><strong>{String(value)}</strong></div>;
}

export function TalentPoolWorkspace({ rows, management, sheetsImport }: { rows: ApiRecord[]; management: ReactNode; sheetsImport: ReactNode }) {
  const [tab, setTab] = useState<"profiles" | "analytics" | "outreach" | "manage">("profiles");
  const [query, setQuery] = useState(""); const [pipeline, setPipeline] = useState(""); const [status, setStatus] = useState(""); const [source, setSource] = useState(""); const [tier, setTier] = useState(""); const [detailId, setDetailId] = useState("");
  const visible = useMemo(() => rows.filter((row) => {
    const search = `${row.nama} ${row.email} ${row.wa} ${row.universitas} ${row.linkedin}`.toLowerCase();
    const matchesPipeline = !pipeline || (pipeline === "beli" ? isBuyer(row) : !isBuyer(row));
    return (!query || search.includes(query.toLowerCase())) && matchesPipeline && (!status || row.status === status) && (!source || row.sumber === source) && (!tier || row.campus_tier === tier);
  }), [rows, query, pipeline, status, source, tier]);
  const { pageItems, page, setPage, totalPages } = usePagination(visible, 15);
  const detail = rows.find((row) => String(row.id) === detailId);
  const sudahBeli = rows.filter(isBuyer).length;
  const waLink = detail?.wa ? `https://wa.me/${String(detail.wa).replace(/\D/g, "")}` : "";

  return (
    <div>
      <div className={styles.tabRow}>
        <button className={tab === "profiles" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab("profiles")} type="button"><i className="ti ti-users" style={{ fontSize: 11 }} /> Database</button>
        <button className={tab === "analytics" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab("analytics")} type="button"><i className="ti ti-chart-bar" style={{ fontSize: 11 }} /> Analytics</button>
        <button className={tab === "outreach" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab("outreach")} type="button"><i className="ti ti-mail" style={{ fontSize: 11 }} /> Email Blast</button>
        <button className={tab === "manage" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab("manage")} type="button"><i className="ti ti-database-cog" style={{ fontSize: 11 }} /> Manage data</button>
      </div>
      {tab === "profiles" ? (
        <div className={styles.card}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}><div className={styles.statLabel}>Total</div><div className={styles.statVal}>{rows.length}</div></div>
            <div className={styles.statCard}><div className={styles.statLabel}>Sudah Beli</div><div className={styles.statVal} style={{ color: "var(--green)" }}>{sudahBeli}</div></div>
            <div className={styles.statCard}><div className={styles.statLabel}>Belum Beli</div><div className={styles.statVal} style={{ color: "var(--amber)" }}>{rows.length - sudahBeli}</div></div>
          </div>
          <div className={styles.filterBar}>
            <input placeholder="Cari nama / WA..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <select value={pipeline} onChange={(event) => setPipeline(event.target.value)}><option value="">Pipeline</option><option value="beli">Sudah Beli</option><option value="belum">Belum Beli</option></select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Status</option>{options(rows, "status").map((value) => <option key={value}>{value}</option>)}</select>
            <select value={source} onChange={(event) => setSource(event.target.value)}><option value="">Sumber</option>{options(rows, "sumber").map((value) => <option key={value}>{value}</option>)}</select>
            <select value={tier} onChange={(event) => setTier(event.target.value)}><option value="">Tier</option>{options(rows, "campus_tier").map((value) => <option key={value}>{value}</option>)}</select>
            <span className={styles.filterSpacer} />
          </div>
          <div className={styles.rowCount}>{visible.length} dari {rows.length} data</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Nama</th>
                  <th className={styles.th}>WA</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Sumber</th>
                  <th className={styles.th}>Domisili</th>
                  <th className={styles.th}>Univ</th>
                  <th className={styles.th}>Tier</th>
                  <th className={styles.th}>IPK</th>
                  <th className={styles.th}>Lulus</th>
                  <th className={styles.th}>Target MT</th>
                  <th className={styles.th}>Posisi MT</th>
                  <th className={styles.th}>Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? <tr><td className={styles.empty} colSpan={12}>Belum ada data. Import CSV dulu.</td></tr> : pageItems.map((row) => (
                  <tr className={styles.row} key={String(row.id)} onClick={() => setDetailId(String(row.id))}>
                    <td className={`${styles.td} ${styles.tdName}`}>{text(row.nama) || "—"}</td>
                    <td className={styles.td}>{text(row.wa) || "—"}</td>
                    <td className={styles.td}><span className={styles.pillGray}>{text(row.status) || "—"}</span></td>
                    <td className={styles.td}>{text(row.sumber) || "—"}</td>
                    <td className={styles.td}>{text(row.domisili) || "—"}</td>
                    <td className={`${styles.td} ${styles.tdEllipsis}`} title={text(row.universitas)}>{text(row.universitas) || "—"}</td>
                    <td className={styles.td}>{text(row.campus_tier) ? <span className={styles.pillTier}>{text(row.campus_tier)}</span> : "—"}</td>
                    <td className={styles.td}>{text(row.ipk) || "—"}</td>
                    <td className={styles.td}>{text(row.tahun_lulus) || "—"}</td>
                    <td className={styles.td}>{tagList(row.target_mt, styles.tagTarget)}</td>
                    <td className={styles.td}>{tagList(row.posisi_mt, styles.tagPosisi)}</td>
                    <td className={styles.td}><span className={`${styles.pipelinePill} ${isBuyer(row) ? styles.pipelineYes : styles.pipelineNo}`}>{isBuyer(row) ? "Sudah Beli" : "Belum Beli"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination onChange={setPage} page={page} totalPages={totalPages} />
        </div>
      ) : null}
      {tab === "analytics" ? <TalentPoolAnalytics rows={rows} /> : null}
      {tab === "outreach" ? <TalentPoolTools rows={rows} /> : null}
      {tab === "manage" ? <div className={styles.toolStack}>{sheetsImport}{management}</div> : null}
      {detail ? (
        <div className={styles.detailOverlay} role="dialog" aria-modal="true">
          <section className={styles.detailPanel}>
            <header className={styles.detailHeader}>
              <div className={styles.detailAvatar}>{initials(text(detail.nama) || "?")}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{text(detail.nama) || "—"}</h2>
                <p>{text(detail.email)}</p>
              </div>
              <span className={`${styles.pipelinePill} ${isBuyer(detail) ? styles.pipelineYes : styles.pipelineNo}`}>{isBuyer(detail) ? "Sudah Beli" : "Belum Beli"}</span>
              <button onClick={() => setDetailId("")} type="button"><i className="ti ti-x" /></button>
            </header>
            <div className={styles.detailActions}>
              {waLink ? <a className={styles.detailActionWa} href={waLink} target="_blank" rel="noopener"><i className="ti ti-brand-whatsapp" /> Chat WA</a> : null}
              {text(detail.email) ? <a className={styles.detailActionLink} href={`mailto:${text(detail.email)}`}><i className="ti ti-mail" /> Email</a> : null}
              {text(detail.linkedin) ? <a className={styles.detailActionLink} href={text(detail.linkedin)} target="_blank" rel="noopener"><i className="ti ti-brand-linkedin" /> LinkedIn</a> : null}
            </div>
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}><i className="ti ti-address-book" /> Kontak</div>
              <div className={styles.detailFields}>
                <DetailField label="WhatsApp" value={detail.wa} />
                <DetailField label="Email" value={detail.email} />
                <DetailField label="Domisili" value={detail.domisili} />
                <DetailField label="Sumber" value={detail.sumber} />
              </div>
            </div>
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}><i className="ti ti-school" /> Akademik</div>
              <div className={styles.detailFields}>
                <DetailField label="Universitas" value={detail.universitas} />
                <DetailField label="Campus Tier" value={detail.campus_tier} />
                <DetailField label="Fakultas" value={detail.fakultas} />
                <DetailField label="Pendidikan" value={detail.pendidikan} />
                <DetailField label="IPK" value={detail.ipk} />
                <DetailField label="Angkatan / Lulus" value={detail.angkatan || detail.tahun_lulus ? `${text(detail.angkatan) || "—"} / ${text(detail.tahun_lulus) || "—"}` : ""} />
              </div>
            </div>
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}><i className="ti ti-user" /> Profil</div>
              <div className={styles.detailFields}>
                <DetailField label="Status" value={detail.status} />
                <DetailField label="Organisasi" value={detail.organisasi} />
                <DetailField label="Exchange" value={detail.exchange} />
                <DetailField label="Relocate" value={detail.relocate} />
                <DetailField label="Topik minat" value={detail.topik_minat} wide />
              </div>
            </div>
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}><i className="ti ti-briefcase" /> Management trainee</div>
              <div className={styles.detailFields}>
                <DetailField label="Target MT" value={detail.target_mt} />
                <DetailField label="Posisi MT" value={detail.posisi_mt} />
                <DetailField label="Pipeline" value={detail.pipeline} />
              </div>
            </div>
            {text(detail.produk_dibeli) ? <div className={styles.detailHighlight}><span>Produk dibeli</span>{text(detail.produk_dibeli)}</div> : null}
            {text(detail.feedback) ? <div className={styles.detailFeedback}><span>Feedback</span>{text(detail.feedback)}</div> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

/* ══════════════ ANALYTICS (ported from legacy renderTpAnalytics) ══════════════ */
function TalentPoolAnalytics({ rows }: { rows: ApiRecord[] }) {
  const total = rows.length;

  const domisiliData = useMemo(() => freq(rows.map((row) => row.domisili)), [rows]);
  const sumberData = useMemo(() => freq(rows.map((row) => row.sumber)), [rows]);
  const statusData = useMemo(() => freq(rows.map((row) => row.status)), [rows]);
  const pendidikanData = useMemo(() => freq(rows.map((row) => row.pendidikan)), [rows]);
  const tierData = useMemo(() => freq(rows.map((row) => row.campus_tier)), [rows]);
  const angkatanData = useMemo(() => freq(rows.map((row) => row.angkatan)), [rows]);
  const lulusData = useMemo(() => freq(rows.map((row) => row.tahun_lulus)), [rows]);
  const univData = useMemo(() => freq(rows.map((row) => row.universitas)), [rows]);
  const exchangeData = useMemo(() => freq(rows.map((row) => row.exchange)), [rows]);
  const organisasiData = useMemo(() => freq(rows.map((row) => row.organisasi)), [rows]);
  // A candidate can name several target roles/industries in one field.
  const posisiData = useMemo(() => freqMulti(rows.map((row) => row.posisi_mt)), [rows]);
  const targetData = useMemo(() => freqMulti(rows.map((row) => row.target_mt)), [rows]);

  // GPA is bucketed rather than counted per distinct value, and its share is measured
  // against the candidates who actually reported one — not the whole pool.
  const { ipkData, ipkTotal } = useMemo(() => {
    const values = rows.map((row) => parseFloat(String(row.ipk))).filter((value) => !Number.isNaN(value));
    const buckets: Array<[string, number]> = [["< 3.0", 0], ["3.0 – 3.25", 0], ["3.26 – 3.50", 0], ["3.51 – 3.75", 0], ["3.76 – 4.00", 0]];
    values.forEach((value) => {
      const index = value < 3 ? 0 : value <= 3.25 ? 1 : value <= 3.5 ? 2 : value <= 3.75 ? 3 : 4;
      buckets[index][1] += 1;
    });
    return { ipkData: buckets.filter(([, count]) => count > 0) as Entry[], ipkTotal: values.length };
  }, [rows]);

  const donut = (entries: Entry[], entriesTotal = total) => <DonutBreakdown colors={ANALYTICS_COLORS_TP} entries={entries} total={entriesTotal} />;

  return (
    <div>
      <AnalyticsHeader count={`${total} peserta`} layout="inline" onExport={() => downloadJson(rows, `talent-pool-analytics-${new Date().toISOString().slice(0, 10)}.json`)} title="Ringkasan Talent Pool" />
      <div style={analyticsGrid(3)}>
        <AnalyticsCard icon="ti-map-pin" title="Domisili" total={total}>{donut(domisiliData)}</AnalyticsCard>
        <AnalyticsCard icon="ti-source-code" title="Sumber" total={total}>{donut(sumberData)}</AnalyticsCard>
        <AnalyticsCard icon="ti-id-badge" title="Status" total={total}>{donut(statusData)}</AnalyticsCard>
        <AnalyticsCard icon="ti-school" title="Pendidikan" total={total}>{donut(pendidikanData)}</AnalyticsCard>
        <AnalyticsCard icon="ti-building-community" title="Campus Tier" total={total}>{donut(tierData)}</AnalyticsCard>
        <AnalyticsCard icon="ti-star" title="Range IPK" total={ipkTotal}>{donut(ipkData, ipkTotal)}</AnalyticsCard>
      </div>
      <div style={{ ...analyticsGrid(2), marginTop: 12 }}>
        <AnalyticsCard icon="ti-calendar" title="Angkatan" total={total}><BarBreakdown entries={angkatanData} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-calendar-event" title="Tahun Lulus" total={total}><BarBreakdown entries={lulusData} total={total} /></AnalyticsCard>
      </div>
      <div style={{ ...analyticsGrid(2), marginTop: 12 }}>
        <AnalyticsCard icon="ti-building" title="Universitas Terbanyak" total={total}><BarBreakdown entries={univData} total={total} /></AnalyticsCard>
        <AnalyticsCard icon="ti-briefcase" title="Minat Posisi MT" total={total}><BarBreakdown entries={posisiData} total={total} /></AnalyticsCard>
      </div>
      <div style={{ ...analyticsGrid(2), marginTop: 12 }}>
        <AnalyticsCard icon="ti-plane" title="Pengalaman Study Abroad" total={total}>{donut(exchangeData)}</AnalyticsCard>
        <AnalyticsCard icon="ti-users" title="Pengalaman Organisasi" total={total}>{donut(organisasiData)}</AnalyticsCard>
      </div>
      <div style={{ ...analyticsGrid(1), marginTop: 12 }}>
        <AnalyticsCard icon="ti-building-factory" title="Target Industri MT" total={total}><BarBreakdown entries={targetData} maxBars={15} total={total} /></AnalyticsCard>
      </div>
    </div>
  );
}
