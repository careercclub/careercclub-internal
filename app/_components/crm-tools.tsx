"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "../record-manager.module.css";

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
      const response = await fetch("/api/crm/import", { method: "POST", body: formData });
      const result = await response.json() as ImportResult;
      if (!response.ok) throw new Error(result.error || "Import failed.");
      setMessage(`Added ${result.added || 0}, updated ${result.updated || 0}, skipped ${result.skipped || 0}.${result.warnings?.length ? ` ${result.warnings.length} classification warning(s).` : ""}`);
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
      <div className={styles.metricStrip}>
        <div><strong>{stats.total}</strong><span>buyers</span></div>
        <div><strong>{stats.pending}</strong><span>pending payment</span></div>
        <div><strong>{stats.failed}</strong><span>failed payment</span></div>
        <div><strong>{stats.converted}</strong><span>converted</span></div>
        <div><strong>{stats.talent}</strong><span>talent matches</span></div>
      </div>
      <details className={styles.createPanel}>
        <summary><i className="ti ti-file-import" aria-hidden="true" /> Import Lynkid transactions</summary>
        <form action={importFile} className={styles.formGrid}>
          <label className={styles.field}><span>Import mode</span><select name="mode"><option value="new">New buyers (skip duplicate WhatsApp)</option><option value="results">Blast results (append purchase history)</option></select></label>
          <label className={styles.field}><span>CSV or XLSX</span><input accept=".csv,.xlsx" name="file" type="file" required /></label>
          <button className={styles.primaryButton} disabled={busy} type="submit">{busy ? "Importing..." : "Import transactions"}</button>
          {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
        </form>
      </details>
      <button className={styles.secondaryButton} type="button" onClick={exportJson}><i className="ti ti-download" aria-hidden="true" /> Export CRM JSON</button>
    </div>
  );
}
