"use client";

import { importVacanciesFromSheetAction } from "@/app/actions/job-vacancy-mt-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { useState, useTransition } from "react";
import styles from "./job-vacancy-mt.module.css";

type SheetRow = Record<string, unknown> & { company: string; industry: string; program: string; months: number[]; year: string; open_date: string | null; deadline: string | null };
type ClassifiedRow = SheetRow & { classification: "new" | "update" };

function deriveCsvUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/pub")) return trimmed.includes("output=csv") ? trimmed : `${trimmed}${trimmed.includes("?") ? "&" : "?"}output=csv`;
  const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = trimmed.match(/gid=([0-9]+)/);
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gidMatch ? gidMatch[1] : "0"}`;
}

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false; }
      else cell += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function detectHeaderRow(grid: string[][]): number {
  for (let i = 0; i < Math.min(10, grid.length); i++) {
    if (grid[i].some((cell) => cell.trim().toLowerCase() === "company")) return i;
  }
  return 0;
}

function splitList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

function mapColumns(grid: string[][], headerRowIndex: number) {
  const headers = grid[headerRowIndex].map((h) => h.trim().toLowerCase());
  const index = (key: string) => headers.indexOf(key);
  const get = (row: string[], key: string) => { const i = index(key); return i >= 0 ? (row[i] || "").trim() : ""; };
  const valid: SheetRow[] = [];
  let invalid = 0;
  grid.slice(headerRowIndex + 1).forEach((row) => {
    if (row.every((cell) => !cell.trim())) return;
    const company = get(row, "company");
    const industry = get(row, "industry");
    const program = get(row, "program");
    const months = splitList(get(row, "months")).map((m) => parseInt(m, 10)).filter((m) => m >= 1 && m <= 12);
    if (!company || !industry || !program || !months.length) { invalid += 1; return; }
    valid.push({
      company, industry, program,
      roles: splitList(get(row, "roles")),
      edu: get(row, "education"),
      gpa: get(row, "gpa"),
      majors: splitList(get(row, "majors")),
      placement: splitList(get(row, "placement")),
      other_req: get(row, "other_req"),
      duration: get(row, "duration"),
      selection: splitList(get(row, "selection_steps")),
      months,
      year: get(row, "year") || "2026",
      open_date: get(row, "open_date") || null,
      deadline: get(row, "deadline") || null,
      career_links: splitList(get(row, "career_links")),
      ref_links: splitList(get(row, "ref_links")),
      notes: get(row, "notes"),
    });
  });
  return { valid, invalid };
}

function matchKey(company: string, program: string, year: string) { return `${company.trim().toLowerCase()}|${program.trim().toLowerCase()}|${year.trim()}`; }

function classify(valid: SheetRow[], existing: ApiRecord[]): ClassifiedRow[] {
  const existingKeys = new Set(existing.map((row) => matchKey(String(row.company || ""), String(row.program || ""), String(row.year || ""))));
  return valid.map((row) => ({ ...row, classification: existingKeys.has(matchKey(row.company, row.program, row.year)) ? "update" : "new" }));
}

export function SheetImportPanel({ existingRows }: { existingRows: ApiRecord[] }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{ text: string; tone: "info" | "error" | "success" } | null>(null);
  const [preview, setPreview] = useState<ClassifiedRow[] | null>(null);
  const [invalidCount, setInvalidCount] = useState(0);
  const [pending, start] = useTransition();

  async function fetchAndPreview() {
    const csvUrl = deriveCsvUrl(url);
    if (!csvUrl) { window.alert(url.trim() ? "URL tidak valid." : "Paste dulu URL Google Sheets!"); return; }
    setStatus({ text: "Mengambil data...", tone: "info" });
    setPreview(null);
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error("fetch failed");
      const csvText = await response.text();
      const grid = parseCsv(csvText);
      if (grid.length < 2) { setStatus({ text: "Sheet kosong atau format salah.", tone: "error" }); return; }
      const headerRowIndex = detectHeaderRow(grid);
      const { valid, invalid } = mapColumns(grid, headerRowIndex);
      setPreview(classify(valid, existingRows));
      setInvalidCount(invalid);
      setStatus({ text: `${valid.length} baris ditemukan — cek preview sebelum simpan.`, tone: "success" });
    } catch {
      setStatus({ text: "Gagal mengambil data. Pastikan sheet sudah di-publish ke web (File > Share > Publish to web > CSV).", tone: "error" });
    }
  }

  function confirm() {
    if (!preview || !preview.length) { window.alert("Tidak ada data valid!"); return; }
    start(async () => {
      const rows = preview.map(({ classification: _classification, ...row }) => row);
      const result = await importVacanciesFromSheetAction(rows);
      setStatus({ text: `${result.inserted} loker baru ditambahkan${result.updated ? ` · ${result.updated} loker diupdate` : ""}!`, tone: "success" });
      setPreview(null);
      setUrl("");
      setTimeout(() => setOpen(false), 1500);
    });
  }

  const newCount = preview?.filter((row) => row.classification === "new").length || 0;
  const updateCount = preview?.filter((row) => row.classification === "update").length || 0;

  return (
    <div className={styles.importPanel}>
      <div className={styles.importTitle} onClick={() => setOpen((value) => !value)} style={{ cursor: "pointer" }}>
        <i className="ti ti-brand-google-drive" /> Import dari Google Sheets <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ marginLeft: "auto", fontSize: 12 }} />
      </div>
      {open ? (
        <>
          <div className={styles.importHint}>Pastikan sheet sudah di-publish: <strong>File → Share → Publish to web → pilih sheet → CSV → Publish</strong></div>
          <div className={styles.importRow}>
            <input className={styles.importUrlInput} onChange={(event) => setUrl(event.target.value)} placeholder="Paste URL Google Sheets di sini..." value={url} />
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={fetchAndPreview} type="button"><i className="ti ti-download" /> Fetch &amp; Preview</button>
          </div>
          {status ? <div className={styles.importStatus} style={{ color: status.tone === "error" ? "var(--red)" : status.tone === "success" ? "#1d9e75" : "#0f52ba" }}>{status.text}</div> : null}
          {preview ? (
            <div style={{ marginTop: 12 }}>
              <div className={styles.previewSummary}>{newCount} baru{updateCount ? ` · ${updateCount} diupdate` : ""}{invalidCount ? ` · ${invalidCount} dilewati` : ""}</div>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr><th>Perusahaan</th><th>Industri</th><th>Program</th><th>Open Date</th><th>Deadline</th><th>Bulan Buka</th><th>Status</th></tr></thead>
                  <tbody>
                    {preview.map((row, index) => (
                      <tr key={index}>
                        <td>{row.company || "—"}</td>
                        <td>{row.industry || "—"}</td>
                        <td>{row.program || "—"}</td>
                        <td>{row.open_date || "—"}</td>
                        <td>{row.deadline || "—"}</td>
                        <td>{row.months.map((m) => <span className={`${styles.pill} ${styles.pillBlue}`} key={m}>{m}</span>)}</td>
                        <td><span className={`${styles.pill} ${row.classification === "new" ? styles.pillGreen : styles.pillBlue}`}>{row.classification === "new" ? "Baru" : "Update"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.previewFooter}>
                <button className={`${styles.btn} ${styles.btnSm}`} onClick={() => setPreview(null)} type="button">Batal</button>
                <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending} onClick={confirm} type="button">{pending ? "Menyimpan..." : `Simpan ${preview.length} Loker ke Supabase`}</button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
