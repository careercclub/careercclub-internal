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
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { IndustryDoughnutChart, MonthlyOpenChart } from "./charts";
import { SheetImportPanel } from "./job-vacancy-mt-sheet-import";
import styles from "./job-vacancy-mt.module.css";
import { usePagination } from "./ui-kit";

/* ── Helpers ── */
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const IND_COLORS = ["#0f52ba", "#1d9e75", "#ef9f27", "#d85a30", "#378add", "#d4537e", "#639922", "#ba7517", "#185fa5", "#993556", "#3b6d11", "#888780"];
const LAINNYA_COLOR = "#c8c6c0";
const WEEK_RANGES = ["1–7", "8–14", "15–21", "22–31"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) { try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* fall through */ } }
    return trimmed ? trimmed.split(/[;,|]/).map((item) => item.trim()).filter(Boolean) : [];
  }
  return [];
}
function toDate(value: unknown) { if (!value) return null; const d = value instanceof Date ? value : new Date(String(value)); return Number.isFinite(d.getTime()) ? d : null; }
function weekOfMonth(d: Date) { const day = d.getDate(); return day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4; }
function fmtShort(d: Date) { return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`; }

type Tab = "dashboard" | "list" | "newsletter" | "master" | "company";

/* ── Root ── */
export function JobVacancyMtTools({ rows, industries, referenceDate }: { rows: ApiRecord[]; industries: ApiRecord[]; referenceDate: string }) {
  const now = useMemo(() => new Date(referenceDate), [referenceDate]);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [listIndustryFilter, setListIndustryFilter] = useState("");
  const [formState, setFormState] = useState<{ record: ApiRecord | null } | null>(null);

  const tabs: Array<[Tab, string, string]> = [
    ["dashboard", "ti-layout-dashboard", "Dashboard"],
    ["list", "ti-list", "Semua Loker"],
    ["newsletter", "ti-send", "Newsletter"],
    ["master", "ti-database", "Master Data"],
    ["company", "ti-buildings", "Company Intel"],
  ];

  function jumpToList(industry: string) {
    setListIndustryFilter(industry);
    setTab("list");
  }

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.tabRow}>
          {tabs.map(([key, icon, label]) => (
            <button key={key} type="button" className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`} onClick={() => setTab(key)}>
              <i className={`ti ${icon}`} /> {label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.addBtn} onClick={() => setFormState({ record: null })}><i className="ti ti-plus" /> Tambah Loker</button>
      </div>
      <div className={styles.body}>
        <div className={styles.page}>
          {tab === "dashboard" ? <DashboardTab rows={rows} now={now} onJumpToList={jumpToList} /> : null}
          {tab === "list" ? <ListTab industries={industries} onEdit={(row) => setFormState({ record: row })} presetIndustry={listIndustryFilter} rows={rows} /> : null}
          {tab === "newsletter" ? <NewsletterTab now={now} rows={rows} /> : null}
          {tab === "master" ? <MasterDataTab industries={industries} rows={rows} /> : null}
          {tab === "company" ? <CompanyIntelTab rows={rows} /> : null}
        </div>
      </div>
      {formState ? <VacancyForm industries={industries} onClose={() => setFormState(null)} record={formState.record} /> : null}
    </div>
  );
}

/* ── Shared UI ── */
function Modal({ size, title, onClose, children, footer }: { size?: "sm" | "lg"; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const sizeClass = size === "sm" ? styles.modalSm : size === "lg" ? styles.modalLg : "";
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${sizeClass}`} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{title}</div>
          <button aria-label="Tutup" className={`${styles.btn} ${styles.btnSm} ${styles.btnIcon}`} onClick={onClose} type="button"><i className="ti ti-x" /></button>
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

function ConfirmModal({ title, description, busy, onCancel, onConfirm }: { title: string; description: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}><div className={styles.modalTitle}>{title}</div></div>
        <div className={styles.modalBody}><p style={{ fontSize: 12, color: "var(--text-muted)" }}>{description}</p></div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btn} ${styles.btnSm}`} onClick={onCancel} type="button">Batal</button>
          <button className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} disabled={busy} onClick={onConfirm} type="button">{busy ? "Menghapus..." : "Ya, Hapus"}</button>
        </div>
      </div>
    </div>
  );
}

function TagInput({ values, onChange, placeholder, ordered = false }: { values: string[]; onChange: (next: string[]) => void; placeholder?: string; ordered?: boolean }) {
  const [draft, setDraft] = useState("");
  function commit() {
    const value = draft.trim();
    if (!value) return;
    onChange([...values, value]);
    setDraft("");
  }
  return (
    <div className={styles.tagInput}>
      {values.map((value, index) => (
        <span className={`${styles.tagChip} ${ordered ? styles.tagChipOrdered : ""}`} key={`${value}-${index}`} title={value}>
          {ordered ? <b className={styles.tagChipIndex}>{index + 1}</b> : null}
          <span>{value.length > 30 ? `${value.slice(0, 30)}...` : value}</span>
          <button className={styles.tagChipRemove} onClick={() => onChange(values.filter((_, idx) => idx !== index))} type="button"><i className="ti ti-x" style={{ fontSize: 10 }} /></button>
        </span>
      ))}
      <input
        className={styles.tagInputField}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }}
        placeholder={placeholder}
        value={draft}
      />
    </div>
  );
}

function MonthGrid({ selected, onChange }: { selected: number[]; onChange: (months: number[]) => void }) {
  return (
    <div className={styles.monthGrid}>
      {MONTHS_SHORT.map((label, index) => {
        const month = index + 1;
        const active = selected.includes(month);
        return (
          <button className={`${styles.monthCell} ${active ? styles.monthCellActive : ""}`} key={month} onClick={() => onChange(active ? selected.filter((x) => x !== month) : [...selected, month].sort((a, b) => a - b))} type="button">
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0" }}>
      <button className={`${styles.btn} ${styles.btnSm}`} disabled={page <= 0} onClick={() => onChange(Math.max(0, page - 1))} type="button"><i className="ti ti-chevron-left" /></button>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Page {page + 1} / {totalPages}</span>
      <button className={`${styles.btn} ${styles.btnSm}`} disabled={page >= totalPages - 1} onClick={() => onChange(Math.min(totalPages - 1, page + 1))} type="button"><i className="ti ti-chevron-right" /></button>
    </div>
  );
}

/* ══════════════ DASHBOARD ══════════════ */
function DashboardTab({ rows, now, onJumpToList }: { rows: ApiRecord[]; now: Date; onJumpToList: (industry: string) => void }) {
  const years = useMemo(() => [...new Set(rows.map((row) => text(row.year)).filter(Boolean))].sort().reverse(), [rows]);
  const [dashYear, setDashYear] = useState(() => years[0] || String(now.getFullYear()));

  const total = rows.length;
  const thisWeek = useMemo(() => rows.filter((row) => { const created = toDate(row.created_at); return created && created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth() && weekOfMonth(created) === weekOfMonth(now); }).length, [rows, now]);
  const thisMonth = useMemo(() => rows.filter((row) => list(row.months).map(Number).includes(now.getMonth() + 1)).length, [rows, now]);

  const industryCounts = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rows.forEach((row) => { const industry = text(row.industry) || "Lainnya"; const set = map.get(industry) || new Set<string>(); set.add(text(row.company)); map.set(industry, set); });
    return [...map.entries()].map(([name, set]) => [name, set.size] as [string, number]).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const topIndustry = industryCounts[0];

  const monthlyCounts = useMemo(() => {
    const counts = Array<number>(12).fill(0);
    rows.forEach((row) => { if (text(row.year) !== dashYear) return; list(row.months).map(Number).forEach((month) => { if (month >= 1 && month <= 12) counts[month - 1] += 1; }); });
    return counts;
  }, [rows, dashYear]);

  const doughnutSegments = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rows.forEach((row) => { if (text(row.year) !== dashYear) return; const industry = text(row.industry) || "Lainnya"; const set = map.get(industry) || new Set<string>(); set.add(text(row.company)); map.set(industry, set); });
    const entries = [...map.entries()].map(([name, set]) => [name, set.size] as [string, number]);
    const totalCompanies = entries.reduce((sum, [, value]) => sum + value, 0);
    if (!totalCompanies) return [];
    const THRESHOLD = 0.02;
    const colored = entries.map(([name, value], index) => ({ name, value, color: IND_COLORS[index % IND_COLORS.length] }));
    const main = colored.filter((slice) => slice.value / totalCompanies >= THRESHOLD).sort((a, b) => b.value - a.value);
    const otherTotal = colored.filter((slice) => slice.value / totalCompanies < THRESHOLD).reduce((sum, slice) => sum + slice.value, 0);
    const segments = main.map((slice) => ({ label: slice.name, value: slice.value, color: slice.color, pct: slice.value / totalCompanies }));
    if (otherTotal > 0) segments.push({ label: "Lainnya", value: otherTotal, color: LAINNYA_COLOR, pct: otherTotal / totalCompanies });
    return segments;
  }, [rows, dashYear]);

  const categoryMax = topIndustry?.[1] || 1;

  return (
    <>
      <div className={styles.statsRow}>
        <div className={styles.statCard}><div className={styles.statLabel}>Total Loker</div><div className={styles.statValue}>{total}</div><div className={styles.statSub}><i className="ti ti-database" /> semua data</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Minggu Ini</div><div className={styles.statValue}>{thisWeek}</div><div className={styles.statSub}><i className="ti ti-trending-up" /> loker baru diinput</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Industri Terbanyak</div><div className={styles.statValue} style={{ fontSize: 14, paddingTop: 4 }}>{topIndustry?.[0] || "—"}</div><div className={styles.statSub}>{topIndustry ? `${topIndustry[1]} perusahaan` : "—"}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Buka Bulan Ini</div><div className={styles.statValue}>{thisMonth}</div><div className={styles.statSub}><i className="ti ti-calendar" /> bulan berjalan</div></div>
      </div>

      <div className={styles.sectionRow}>
        <div className={styles.sectionLabel}>Tren Bulanan</div>
        <select className={styles.filterSelect} onChange={(event) => setDashYear(event.target.value)} value={dashYear}>{years.length ? years.map((year) => <option key={year} value={year}>{year}</option>) : <option value={dashYear}>{dashYear}</option>}</select>
      </div>
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Loker Buka per Bulan</div>
          <div className={styles.chartSub}>Berdasarkan bulan buka loker — {dashYear}</div>
          <div className={styles.chartWrap}><MonthlyOpenChart counts={monthlyCounts} labels={MONTHS_SHORT} /></div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Distribusi Industri</div>
          <div className={styles.chartSub}>Breakdown kategori perusahaan</div>
          <div className={styles.chartDoughnutRow}>
            <div className={styles.chartDoughnutWrap}>{doughnutSegments.length ? <IndustryDoughnutChart segments={doughnutSegments} /> : null}</div>
            <div className={styles.legendCol}>
              {doughnutSegments.map((segment) => (
                <div className={styles.legendRow} key={segment.label}>
                  <span className={styles.legendSwatch} style={{ background: segment.color }} />
                  <span className={styles.legendLabel} title={segment.label}>{segment.label}</span>
                  <span className={styles.legendPct}>{(segment.pct * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.sectionLabel} style={{ marginTop: 16, marginBottom: 8 }}>Ringkasan per Kategori</div>
      {!industryCounts.length ? (
        <div className={styles.empty}>Belum ada data. Tambahkan loker MT pertama!</div>
      ) : (
        <div className={styles.categoryGrid}>
          {industryCounts.map(([name, count]) => {
            const openCompanies = new Set(rows.filter((row) => (text(row.industry) || "Lainnya") === name && list(row.months).map(Number).includes(now.getMonth() + 1)).map((row) => text(row.company)));
            const barPct = Math.round((count / categoryMax) * 100);
            return (
              <button className={styles.categoryCard} key={name} onClick={() => onJumpToList(name)} type="button">
                <div className={styles.categoryTop}><span className={styles.categoryName}>{name}</span><span className={styles.categoryCount}>{count}</span></div>
                <div className={styles.categoryBarTrack}><div className={styles.categoryBarFill} style={{ width: `${barPct}%` }} /></div>
                <div className={styles.categoryFoot}><span className={`${styles.pill} ${openCompanies.size > 0 ? styles.pillGreen : styles.pillGray}`}>{openCompanies.size} buka</span></div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ══════════════ LIST ══════════════ */
function ListTab({ rows, industries, presetIndustry, onEdit }: { rows: ApiRecord[]; industries: ApiRecord[]; presetIndustry: string; onEdit: (row: ApiRecord) => void }) {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState(presetIndustry);
  const [appliedPreset, setAppliedPreset] = useState(presetIndustry);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [pending, start] = useTransition();

  if (presetIndustry !== appliedPreset) {
    setAppliedPreset(presetIndustry);
    setIndustry(presetIndustry);
  }

  const years = useMemo(() => [...new Set(rows.map((row) => text(row.year)).filter(Boolean))].sort().reverse(), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    if (query && !text(row.company).toLowerCase().includes(query) && !text(row.program).toLowerCase().includes(query)) return false;
    if (industry && text(row.industry) !== industry) return false;
    if (month && !list(row.months).map(Number).includes(Number(month))) return false;
    if (year && text(row.year) !== year) return false;
    return true;
  }), [rows, search, industry, month, year]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 15);

  return (
    <>
      <SheetImportPanel existingRows={rows} />
      <div className={styles.filterBar}>
        <input className={styles.filterInput} onChange={(event) => setSearch(event.target.value)} placeholder="Cari perusahaan..." value={search} />
        <select className={styles.nlSelect} onChange={(event) => setIndustry(event.target.value)} value={industry}>
          <option value="">Industri</option>
          {industries.map((row) => <option key={text(row.id)} value={text(row.nama)}>{text(row.nama)}</option>)}
        </select>
        <select className={styles.nlSelect} onChange={(event) => setMonth(event.target.value)} value={month}>
          <option value="">Bulan</option>
          {MONTHS_SHORT.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
        </select>
        <select className={styles.nlSelect} onChange={(event) => setYear(event.target.value)} value={year}>
          <option value="">Tahun</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className={styles.tableWrap}>
        {filtered.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Perusahaan / Program</th><th>Industri</th><th>Role</th><th>Buka Bulan</th><th>Diinput</th><th>Career Links</th><th /></tr></thead>
              <tbody>
                {pageItems.map((row) => {
                  const created = toDate(row.created_at);
                  return (
                    <tr key={text(row.id)}>
                      <td><span className={styles.companyName}>{text(row.company) || "-"}</span><span className={styles.progName}>{text(row.program) || "-"}</span></td>
                      <td><span className={`${styles.pill} ${styles.pillPurple}`}>{text(row.industry) || "-"}</span></td>
                      <td>{list(row.roles).map((role) => <span className={`${styles.pill} ${styles.pillTeal}`} key={role}>{role}</span>)}</td>
                      <td>
                        {list(row.months).map(Number).sort((a, b) => a - b).map((m) => <span className={`${styles.pill} ${styles.pillBlue}`} key={m}>{MONTHS_SHORT[m - 1]}</span>)}
                        <span className={styles.progName}>{text(row.year)}</span>
                      </td>
                      <td>
                        {created ? fmtShort(created) : "-"}
                        {created ? <span className={styles.weekBadge}>Minggu {weekOfMonth(created)}</span> : null}
                      </td>
                      <td>
                        {list(row.career_links).map((link, index) => { const stripped = link.replace(/^https?:\/\//, ""); return <a className={styles.srcLink} href={link} key={index} rel="noreferrer" target="_blank">{stripped.length > 26 ? `${stripped.slice(0, 26)}...` : stripped}</a>; })}
                      </td>
                      <td className={styles.rowActions}>
                        <button className={`${styles.btn} ${styles.btnSm} ${styles.btnIcon}`} onClick={() => onEdit(row)} type="button"><i className="ti ti-edit" /></button>
                        <button className={`${styles.btn} ${styles.btnSm} ${styles.btnIcon} ${styles.btnDanger}`} onClick={() => setDeleteTarget(row)} type="button"><i className="ti ti-trash" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}><i className="ti ti-search" />Tidak ada data</div>
        )}
      </div>
      <Pager onChange={setPage} page={page} totalPages={totalPages} />
      {deleteTarget ? (
        <ConfirmModal
          busy={pending}
          description="Data loker akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => start(async () => { await deleteVacancyAction(text(deleteTarget.id)); setDeleteTarget(null); })}
          title="Hapus loker ini?"
        />
      ) : null}
    </>
  );
}

/* ══════════════ VACANCY FORM (Add/Edit) ══════════════ */
function VacancyForm({ record, industries, onClose }: { record: ApiRecord | null; industries: ApiRecord[]; onClose: () => void }) {
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
  const [openDate, setOpenDate] = useState(text(record?.open_date));
  const [deadline, setDeadline] = useState(text(record?.deadline));
  const [months, setMonths] = useState<number[]>(list(record?.months).map(Number));
  const [year, setYear] = useState(text(record?.year) || String(new Date().getFullYear()));
  const [careerLinks, setCareerLinks] = useState<string[]>(list(record?.career_links));
  const [refLinks, setRefLinks] = useState<string[]>(list(record?.ref_links));
  const [notes, setNotes] = useState(text(record?.notes));
  const [pending, start] = useTransition();

  const createdAt = record?.created_at ? toDate(record.created_at) : null;
  const yearOptions = [String(new Date().getFullYear() - 1), String(new Date().getFullYear()), String(new Date().getFullYear() + 1)];

  function save() {
    if (!company.trim() || !industry.trim() || !program.trim()) { window.alert("Isi dulu: Nama Perusahaan, Industri, dan Nama Program!"); return; }
    if (!months.length) { window.alert("Pilih minimal 1 bulan buka!"); return; }
    if (!careerLinks.length) { window.alert("Isi minimal 1 Career Platform Link!"); return; }
    const input: VacancyInput = { company, industry, program, roles, edu, gpa, majors, placement, other_req: otherReq, duration, selection, months, year, open_date: openDate || null, deadline: deadline || null, career_links: careerLinks, ref_links: refLinks, notes };
    start(async () => {
      try {
        if (record) await updateVacancyAction(text(record.id), input);
        else await createVacancyAction(input);
        onClose();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Gagal simpan loker");
      }
    });
  }

  return (
    <Modal
      footer={<>
        <button className={`${styles.btn} ${styles.btnSm}`} onClick={onClose} type="button">Batal / Reset</button>
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending} onClick={save} type="button"><i className="ti ti-device-floppy" /> {record ? "Simpan Perubahan" : "Simpan Loker"}</button>
      </>}
      onClose={onClose}
      size="lg"
      title={record ? `Edit Loker — ${text(record.company)}` : "Tambah Loker MT Baru"}
    >
      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}><i className="ti ti-building" /> Info Perusahaan</div>
        <div className={styles.formGrid}>
          <Field label="Nama Perusahaan *"><input className={styles.input} onChange={(event) => setCompany(event.target.value)} placeholder="contoh: Bank BCA" value={company} /></Field>
          <Field label="Kategori Industri *">
            <select className={styles.select} onChange={(event) => setIndustry(event.target.value)} value={industry}>
              <option value="">Pilih industri...</option>
              {industries.map((row) => <option key={text(row.id)} value={text(row.nama)}>{text(row.nama)}</option>)}
            </select>
          </Field>
          <div className={styles.fieldFull}><Field label="Nama Program MT *"><input className={styles.input} onChange={(event) => setProgram(event.target.value)} placeholder="contoh: Officer Development Program (ODP)" value={program} /></Field></div>
        </div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}><i className="ti ti-target" /> Requirements</div>
        <div className={styles.formGrid}>
          <div className={styles.fieldFull}><Field label="Roles"><TagInput onChange={setRoles} placeholder="Ketik lalu Enter..." values={roles} /></Field></div>
          <Field label="Education"><input className={styles.input} onChange={(event) => setEdu(event.target.value)} placeholder="contoh: Min. S1, S1/S2" value={edu} /></Field>
          <Field label="Minimum GPA"><input className={styles.input} onChange={(event) => setGpa(event.target.value)} placeholder="contoh: Min. 3.0" value={gpa} /></Field>
          <div className={styles.fieldFull}><Field label="Majors"><TagInput onChange={setMajors} placeholder="Ketik jurusan lalu Enter..." values={majors} /></Field></div>
          <div className={styles.fieldFull}><Field label="Placement"><TagInput onChange={setPlacement} placeholder="contoh: Jakarta, Seluruh Indonesia..." values={placement} /></Field></div>
          <div className={styles.fieldFull}><Field label="Another Requirements"><textarea className={styles.textarea} onChange={(event) => setOtherReq(event.target.value)} placeholder="Syarat tambahan lainnya..." value={otherReq} /></Field></div>
        </div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}><i className="ti ti-list-numbers" /> Tahapan Seleksi</div>
        <Field label="Selection Steps"><TagInput onChange={setSelection} ordered placeholder="Ketik tahapan lalu Enter (urutan = alur seleksi)..." values={selection} /></Field>
        <div className={styles.fieldHint}>Input pertama = Step 1, kedua = Step 2, dst.</div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}><i className="ti ti-calendar" /> Info Program &amp; Waktu</div>
        <div className={styles.formGrid}>
          <Field label="Durasi Program"><input className={styles.input} onChange={(event) => setDuration(event.target.value)} placeholder="contoh: 2 tahun, 18 bulan" value={duration} /></Field>
          <Field label="Open Date" optional><input className={styles.input} onChange={(event) => setOpenDate(event.target.value)} type="date" value={openDate} /></Field>
          <Field label="Deadline" optional><input className={styles.input} onChange={(event) => setDeadline(event.target.value)} type="date" value={deadline} /></Field>
          <div className={styles.fieldFull}><Field label="Buka di Bulan *"><MonthGrid onChange={setMonths} selected={months} /></Field></div>
          <Field label="Tahun Buka">
            <select className={styles.select} onChange={(event) => setYear(event.target.value)} value={year}>{yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          </Field>
        </div>
      </div>

      <div className={styles.formSection} style={{ borderBottom: "none", paddingBottom: 0 }}>
        <div className={styles.formSectionTitle}><i className="ti ti-link" /> Source</div>
        <Field label="Career Platform Links *"><TagInput onChange={setCareerLinks} placeholder="Paste link lalu Enter..." values={careerLinks} /></Field>
        <div className={styles.fieldHint}>Tampil di newsletter customer</div>
        <div style={{ marginTop: 10 }}><Field label="Source Referensi (internal)" optional><TagInput onChange={setRefLinks} placeholder="Paste link sumber riset..." values={refLinks} /></Field></div>
        <div className={styles.fieldHint}>Internal only — tidak tampil di newsletter</div>
        <div style={{ marginTop: 10 }}><Field label="Catatan Tambahan" optional><textarea className={styles.textarea} onChange={(event) => setNotes(event.target.value)} placeholder="Info tambahan..." value={notes} /></Field></div>
        <div className={styles.inputDateAuto} style={{ marginTop: 10 }}><i className="ti ti-clock" /> Tanggal input otomatis tercatat: <strong>{fmtShort(createdAt || new Date())}</strong></div>
      </div>
    </Modal>
  );
}

/* ══════════════ NEWSLETTER ══════════════ */
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

function NewsletterTab({ rows, now }: { rows: ApiRecord[]; now: Date }) {
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [week, setWeek] = useState(weekOfMonth(now));
  const [industryDdOpen, setIndustryDdOpen] = useState(false);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [output, setOutput] = useState<"wa" | "email">("wa");
  const [copyLabel, setCopyLabel] = useState("Copy teks");

  const presentIndustries = useMemo(() => [...new Set(rows.map((row) => text(row.industry)).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const created = toDate(row.created_at);
    if (!created) return false;
    if (created.getMonth() !== month || created.getFullYear() !== year) return false;
    if (weekOfMonth(created) !== week) return false;
    if (!list(row.months).map(Number).includes(month + 1)) return false;
    if (selectedIndustries.length && !selectedIndustries.includes(text(row.industry))) return false;
    return true;
  }), [rows, month, year, week, selectedIndustries]);

  const monLabel = MONTHS_FULL[month];
  const industryLabel = selectedIndustries.length === 1 ? selectedIndustries[0] : selectedIndustries.length > 1 ? selectedIndustries.join(", ") : "";
  const waText = buildWaText(filtered, monLabel, week, industryLabel);
  const emailText = buildEmailText(filtered, monLabel, WEEK_RANGES[week - 1], industryLabel);

  function copy() {
    const value = output === "wa" ? waText : emailText;
    navigator.clipboard.writeText(value).then(() => { setCopyLabel("Tersalin!"); setTimeout(() => setCopyLabel("Copy teks"), 2000); }).catch(() => { /* clipboard unavailable */ });
  }

  return (
    <div className={styles.newsletterCard}>
      <div className={styles.newsletterTitle}><i className="ti ti-send" style={{ color: "#0f52ba" }} /> Newsletter Generator</div>
      <div className={styles.newsletterSub}>Filter loker berdasarkan minggu input. Career platform links otomatis masuk, source referensi tidak ditampilkan.</div>
      <div className={styles.newsletterFilterRow}>
        <div className={styles.newsletterGroup}><span className={styles.newsletterLabel}>Bulan Input</span><select className={styles.nlSelect} onChange={(event) => setMonth(Number(event.target.value))} value={month}>{MONTHS_FULL.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></div>
        <div className={styles.newsletterGroup}><span className={styles.newsletterLabel}>Tahun</span><select className={styles.nlSelect} onChange={(event) => setYear(Number(event.target.value))} value={year}>{[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
        <div className={styles.newsletterGroup}><span className={styles.newsletterLabel}>Minggu ke-</span><select className={styles.nlSelect} onChange={(event) => setWeek(Number(event.target.value))} value={week}>{[1, 2, 3, 4].map((w) => <option key={w} value={w}>Minggu {w} (tgl {WEEK_RANGES[w - 1]})</option>)}</select></div>
        <div className={`${styles.newsletterGroup} ${styles.nlIndContainer}`}>
          <span className={styles.newsletterLabel}>Industri</span>
          <button className={styles.nlIndBtn} onClick={() => setIndustryDdOpen((value) => !value)} type="button">{selectedIndustries.length ? `${selectedIndustries.length} industri dipilih` : "Semua Industri"} <i className="ti ti-chevron-down" /></button>
          {industryDdOpen ? (
            <>
              <div onClick={() => setIndustryDdOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 15 }} />
              <div className={styles.nlIndDropdown}>
                {presentIndustries.map((ind) => (
                  <label className={styles.nlIndItem} key={ind}>
                    <input checked={selectedIndustries.includes(ind)} onChange={() => setSelectedIndustries((current) => current.includes(ind) ? current.filter((item) => item !== ind) : [...current, ind])} type="checkbox" />
                    {ind}
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
      {filtered.length ? (
        <>
          <div className={styles.outputTabs}>
            <button className={`${styles.outputTab} ${output === "wa" ? styles.outputTabActive : ""}`} onClick={() => setOutput("wa")} type="button"><i className="ti ti-brand-whatsapp" /> WhatsApp</button>
            <button className={`${styles.outputTab} ${output === "email" ? styles.outputTabActive : ""}`} onClick={() => setOutput("email")} type="button"><i className="ti ti-mail" /> Email</button>
          </div>
          <div className={styles.outputBox}>{output === "wa" ? waText : emailText}</div>
          <button className={styles.copyBtn} onClick={copy} type="button"><i className="ti ti-copy" /> {copyLabel}</button>
        </>
      ) : (
        <div className={styles.emptyNl}><i className="ti ti-mood-empty" />Tidak ada loker yang diinput di minggu ini</div>
      )}
    </div>
  );
}

/* ══════════════ MASTER DATA ══════════════ */
function MasterDataTab({ industries, rows }: { industries: ApiRecord[]; rows: ApiRecord[] }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const sorted = [...industries].sort((a, b) => text(a.nama).localeCompare(text(b.nama)));

  function add() {
    const trimmed = value.trim();
    if (!trimmed) return;
    start(async () => {
      try { await createIndustryAction(trimmed); setValue(""); }
      catch (error) { window.alert(error instanceof Error ? error.message : "Gagal simpan industri"); }
    });
  }
  function remove(row: ApiRecord) {
    start(async () => {
      try { await deleteIndustryAction(text(row.id), text(row.nama)); }
      catch (error) { window.alert(error instanceof Error ? error.message : "Gagal hapus industri"); }
    });
  }

  return (
    <div className={styles.masterWrap}>
      <div className={styles.masterTitle}><i className="ti ti-database" style={{ color: "#0f52ba" }} /> Master Data Industri</div>
      <div className={styles.masterSub}>Kelola kategori industri yang muncul di form input loker</div>
      <div className={styles.addIndRow}>
        <input className={styles.input} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(); }} placeholder="Nama industri baru..." value={value} />
        <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={pending} onClick={add} type="button"><i className="ti ti-plus" /> Tambah</button>
      </div>
      <div className={styles.indList}>
        {sorted.map((row) => (
          <div className={styles.indRow} key={text(row.id)}>
            <span>{text(row.nama)}</span>
            <button className={styles.indRowDelete} disabled={pending} onClick={() => remove(row)} type="button"><i className="ti ti-trash" /></button>
          </div>
        ))}
        {!sorted.length ? <div className={styles.empty}>Belum ada industri</div> : null}
      </div>
    </div>
  );
}

/* ══════════════ COMPANY INTEL ══════════════ */
function CompanyIntelTab({ rows }: { rows: ApiRecord[] }) {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const industries = useMemo(() => [...new Set(rows.map((row) => text(row.industry)).filter(Boolean))].sort(), [rows]);

  const companies = useMemo(() => {
    const map = new Map<string, { industry: string; programs: Map<string, ApiRecord[]> }>();
    rows.forEach((row) => {
      const rowIndustry = text(row.industry);
      if (industry && rowIndustry !== industry) return;
      const company = text(row.company);
      const program = text(row.program);
      const query = search.trim().toLowerCase();
      if (query && !company.toLowerCase().includes(query) && !program.toLowerCase().includes(query)) return;
      const entry = map.get(company) || { industry: rowIndustry, programs: new Map<string, ApiRecord[]>() };
      entry.industry = rowIndustry;
      entry.programs.set(program, [...(entry.programs.get(program) || []), row]);
      map.set(company, entry);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, search, industry]);

  return (
    <>
      <div className={styles.filterBar}>
        <input className={styles.filterInput} onChange={(event) => setSearch(event.target.value)} placeholder="Cari perusahaan..." value={search} />
        <select className={styles.nlSelect} onChange={(event) => setIndustry(event.target.value)} value={industry}>
          <option value="">Semua Industri</option>
          {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
        </select>
      </div>
      {!companies.length ? (
        <div className={styles.empty}><i className="ti ti-search" />Tidak ada data</div>
      ) : (
        <div className={styles.companyGrid}>
          {companies.map(([company, entry]) => {
            const programs = [...entry.programs.entries()];
            const totalRows = programs.reduce((sum, [, entries]) => sum + entries.length, 0);
            return (
              <div className={styles.companyCard} key={company}>
                <div>
                  <div className={styles.companyName2}>{company}</div>
                  <div className={styles.companySub}>{entry.industry || "-"} · {programs.length} program · {totalRows} total entri</div>
                </div>
                {programs.map(([program, history]) => {
                  const sortedHistory = [...history].sort((a, b) => Number(a.year) - Number(b.year));
                  const monthSets = sortedHistory.map((row) => list(row.months).map(Number).sort((a, b) => a - b).join(","));
                  const patternChanged = sortedHistory.length > 1 && monthSets.some((set) => set !== monthSets[0]);
                  return (
                    <div className={styles.programBlock} key={program}>
                      <div className={styles.programHead}>
                        <i className="ti ti-briefcase" /> {program}
                        {patternChanged ? <span className={`${styles.pill} ${styles.pillAmber}`}><i className="ti ti-alert-triangle" style={{ fontSize: 9 }} /> Pola berubah</span> : null}
                      </div>
                      <div className={styles.programMeta}>{sortedHistory.length} entri · Pola buka:</div>
                      {sortedHistory.map((row) => {
                        const status = text(row.status) || "Active";
                        const tone = status.toLowerCase() === "closed" ? styles.pillGray : status.toLowerCase() === "active" ? styles.pillGreen : styles.pillAmber;
                        return (
                          <div className={styles.historyRow} key={text(row.id)}>
                            <strong>{text(row.year) || "-"}</strong>
                            <span style={{ color: "var(--text-muted)" }}>{list(row.months).map(Number).sort((a, b) => a - b).map((m) => MONTHS_SHORT[m - 1]).filter(Boolean).join(", ") || "—"}</span>
                            <span className={`${styles.pill} ${tone}`}>{status}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
