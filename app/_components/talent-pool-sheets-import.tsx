"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import g from "./library.module.css";
import s from "./page-kit.module.css";

type Result = { tone: "ok" | "error"; text: string };

/** Talent Pool → Manage data: import a CSV/XLSX file or a published Google Sheet tab. */
export function TalentPoolSheetsImport() {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "file" | "url">("");
  const [result, setResult] = useState<Result | null>(null);
  const [fileName, setFileName] = useState("");

  // onSubmit rather than a form action, so a failed import keeps the pasted link / chosen file.
  async function submit(event: FormEvent<HTMLFormElement>, kind: "file" | "url") {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(kind); setResult(null);
    try {
      const response = await fetch("/api/talent-pool/import", { method: "POST", body: formData });
      const data = await response.json() as { imported?: number; skipped?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Import failed.");
      const skipped = data.skipped ? ` · ${data.skipped} skipped (no valid email)` : "";
      setResult({ tone: "ok", text: `Imported ${data.imported || 0} candidate${data.imported === 1 ? "" : "s"}${skipped}. Existing emails were updated, not duplicated.` });
      router.refresh();
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Import failed." });
    } finally { setBusy(""); }
  }

  return (
    <section aria-label="Import candidates" className={s.card}>
      <div><h2>Import candidates</h2><p className={s.cardSub}>Rows are matched by email: new emails are added, existing ones updated.</p></div>
      <div className={g.formGrid}>
        <form className={s.field} onSubmit={(event) => submit(event, "file")} style={{ gap: 10 }}>
          <span>From a file <b aria-hidden="true" className={s.req}>*</b></span>
          <label className={g.dropzone}>
            <i className="ti ti-file-spreadsheet" aria-hidden="true" />
            <b>{fileName || "Choose a CSV or XLSX"}</b>
            <span>{fileName ? "Ready to import" : "Google Form export or the Talent Pool sheet, up to 10 MB"}</span>
            <input accept=".csv,.xlsx" aria-label="Talent Pool file" name="file" onChange={(event) => setFileName(event.target.files?.[0]?.name || "")} required style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} type="file" />
          </label>
          <button className={s.primary} disabled={Boolean(busy) || !fileName} type="submit">{busy === "file" ? "Importing…" : "Import file"}</button>
        </form>
        <form className={s.field} onSubmit={(event) => submit(event, "url")} style={{ gap: 10 }}>
          <span>From a published Google Sheet <b aria-hidden="true" className={s.req}>*</b></span>
          <input aria-label="Published Google Sheet link" className={s.input} name="url" placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&output=csv" required type="url" />
          <p className={s.hint}>In the sheet: File → Share → Publish to web → pick the Talent Pool tab → Comma-separated values → copy the link.</p>
          <button className={s.primary} disabled={Boolean(busy)} type="submit">{busy === "url" ? "Importing…" : "Import sheet"}</button>
        </form>
      </div>
      {result ? <p className={result.tone === "error" ? s.danger : s.message} role={result.tone === "error" ? "alert" : "status"}>{result.text}</p> : null}
    </section>
  );
}
