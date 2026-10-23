"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import styles from "../record-manager.module.css";

export function TalentPoolSheetsImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // onSubmit rather than a form action, so a failed import keeps the pasted link / chosen file.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
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

      <form className={styles.toolForm} onSubmit={submit}>
        <label>
          <span>Upload CSV / XLSX</span>
          <input accept=".csv,.xlsx" name="file" required type="file" />
        </label>
        <button className={styles.primaryButton} disabled={busy}>{busy ? "Importing…" : "Import File"}</button>
      </form>

      <form className={styles.toolForm} onSubmit={submit}>
        <label>
          <span>Or import a published Google Sheet</span>
          <input name="url" placeholder="https://docs.google.com/spreadsheets/..." required type="url" />
        </label>
        <button className={styles.primaryButton} disabled={busy}>{busy ? "Importing…" : "Import Sheet"}</button>
      </form>

      {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
    </details>
  );
}
