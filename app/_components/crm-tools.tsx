"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./crm.module.css";

type ImportResult = { added?: number; updated?: number; skipped?: number; warnings?: string[]; error?: string };

export function CrmTools({ rows }: { rows: ApiRecord[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((row) => String(row.payment_status || "").toUpperCase() === "PENDING").length,
    failed: rows.filter((row) => String(row.payment_status || "").toUpperCase() === "FAILED").length,
    converted: rows.filter((row) => String(row.status || "").toLowerCase().includes("convert")).length,
    talent: rows.filter((row) => row.talent_pool_match || row.talent_pool).length,
  }), [rows]);

  async function importFile(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
      if (!files.length) throw new Error("Select at least one CSV or XLSX file.");
      const total = { added: 0, updated: 0, skipped: 0, warnings: 0 };
      for (const file of files) {
        const request = new FormData(); request.set("mode", String(formData.get("mode") || "new")); request.set("file", file);
        const response = await fetch("/api/crm/import", { method: "POST", body: request });
        const result = await response.json() as ImportResult;
        if (!response.ok) throw new Error(`${file.name}: ${result.error || "Import failed."}`);
        total.added += result.added || 0; total.updated += result.updated || 0; total.skipped += result.skipped || 0; total.warnings += result.warnings?.length || 0;
      }
      setMessage(`Added ${total.added}, updated ${total.updated}, skipped ${total.skipped}.${total.warnings ? ` ${total.warnings} classification warning(s).` : ""}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ccc-crm-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.toolStack}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}><div className={styles.statLabel}>Buyers</div><div className={styles.statVal}>{stats.total}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Pending payment</div><div className={styles.statVal}>{stats.pending}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Failed payment</div><div className={styles.statVal}>{stats.failed}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Converted</div><div className={styles.statVal}>{stats.converted}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Talent matches</div><div className={styles.statVal}>{stats.talent}</div></div>
      </div>
      <details className={styles.detailsPanel}>
        <summary className={styles.detailsSummary}><i className="ti ti-file-import" aria-hidden="true" /> Import Lynkid transactions</summary>
        <form action={importFile} className={styles.formStack}>
          <label><span>Import mode</span><select name="mode"><option value="new">New buyers (skip duplicate WhatsApp)</option><option value="results">Blast results (append purchase history)</option></select></label>
          <label><span>CSV or XLSX files</span><input accept=".csv,.xlsx" multiple name="files" type="file" required /></label>
          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} type="submit">{busy ? "Importing..." : "Import transactions"}</button>
          {message ? <p className={styles.rowCount} role="status">{message}</p> : null}
        </form>
      </details>
      <button className={styles.btn} type="button" onClick={exportJson}><i className="ti ti-download" aria-hidden="true" /> Export CRM JSON</button>
    </div>
  );
}
