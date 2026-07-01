"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import styles from "./talent-pool.module.css";
import { TalentPoolTools } from "./talent-pool-tools";

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
  const detail = rows.find((row) => String(row.id) === detailId);
  const sudahBeli = rows.filter(isBuyer).length;
  function distribution(field: string) { const counts = new Map<string, number>(); rows.forEach((row) => { const value = String(row[field] || "Unknown"); counts.set(value, (counts.get(value) || 0) + 1); }); return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10); }
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
                {visible.length === 0 ? <tr><td className={styles.empty} colSpan={12}>Belum ada data. Import CSV dulu.</td></tr> : visible.map((row) => (
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
        </div>
      ) : null}
      {tab === "analytics" ? (
        <div className={styles.analyticsGrid}>
          {["domisili", "universitas", "campus_tier", "pendidikan", "angkatan", "tahun_lulus", "target_mt", "posisi_mt", "sumber", "pipeline"].map((field) => {
            const data = distribution(field);
            const max = Math.max(...data.map((item) => item[1]), 1);
            return (
              <section className={styles.analyticsCard} key={field}>
                <h3>{field.replaceAll("_", " ")}</h3>
                {data.map(([name, count]) => <div className={styles.analyticsBar} key={name}><span>{name}</span><i style={{ width: `${(count / max) * 100}%` }} /><strong>{count}</strong></div>)}
              </section>
            );
          })}
        </div>
      ) : null}
      {tab === "outreach" ? <TalentPoolTools rows={visible} /> : null}
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
