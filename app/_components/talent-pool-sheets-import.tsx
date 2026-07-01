"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../record-manager.module.css";

export function TalentPoolSheetsImport() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(formData: FormData) { setBusy(true); setMessage(""); try { const response = await fetch("/api/talent-pool/import", { method: "POST", body: formData }); const result = await response.json() as { imported?: number; skipped?: number; error?: string }; if (!response.ok) throw new Error(result.error || "Import failed."); setMessage(`Imported ${result.imported || 0}; skipped ${result.skipped || 0}.`); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); } finally { setBusy(false); } }
  return <details className={styles.createPanel}><summary><i className="ti ti-brand-google-drive" /> Import published Google Sheet</summary><form action={submit} className={styles.toolForm}><input name="url" placeholder="https://docs.google.com/spreadsheets/..." required type="url" /><button className={styles.primaryButton} disabled={busy}>Import Sheet</button>{message ? <p className={styles.formMessage}>{message}</p> : null}</form></details>;
}
