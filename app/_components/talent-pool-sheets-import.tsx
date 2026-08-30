"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../record-manager.module.css";

export function TalentPoolSheetsImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/talent-pool/import", { method: "POST", body: formData });
      const result = await response.json() as { imported?: number; skipped?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Import failed.");
      setMessage(`Imported ${result.imported || 0}; skipped ${result.skipped || 0}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className={styles.createPanel}>
      <summary><i className="ti ti-table-import" /> Import Talent Pool</summary>

      <form action={submit} className={styles.toolForm}>
        <label>
          <span>Upload CSV / XLSX</span>
          <input accept=".csv,.xlsx" name="file" required type="file" />
        </label>
        <button className={styles.primaryButton} disabled={busy}>{busy ? "Importing…" : "Import File"}</button>
      </form>

      <form action={submit} className={styles.toolForm}>
        <label>
          <span>Or import a published Google Sheet</span>
          <input name="url" placeholder="https://docs.google.com/spreadsheets/..." required type="url" />
        </label>
        <button className={styles.primaryButton} disabled={busy}>{busy ? "Importing…" : "Import Sheet"}</button>
      </form>

      {message ? <p className={styles.formMessage}>{message}</p> : null}
    </details>
  );
}
