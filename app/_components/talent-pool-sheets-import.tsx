"use client";

import type { SheetSyncState } from "@/lib/api/sheet-sync";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { SheetSyncControl, syncResultText } from "./sheet-sync-control";
import g from "./library.module.css";
import s from "./page-kit.module.css";
import { HelpTip } from "./ui-kit";

type Result = { tone: "ok" | "error"; text: string };

/** Talent Pool → Manage data: import a CSV/XLSX file, or keep a Google Sheet in sync every hour. */
export function TalentPoolSheetsImport({ sync = null }: { sync?: SheetSyncState | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "file">("");
  const [result, setResult] = useState<Result | null>(null);
  const [fileName, setFileName] = useState("");

  // onSubmit rather than a form action, so a failed import keeps the pasted link / chosen file.
  async function submit(event: FormEvent<HTMLFormElement>, kind: "file") {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(kind); setResult(null);
    try {
      const response = await fetch("/api/talent-pool/import", { method: "POST", body: formData });
      const data = await response.json() as Record<string, number> & { error?: string };
      if (!response.ok) throw new Error(data.error || "Import failed.");
      setResult({ tone: "ok", text: syncResultText(data) });
      router.refresh();
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Import failed." });
    } finally { setBusy(""); }
  }

  return (
    <section aria-label="Import candidates" className={s.card}>
      <div><h2>Import candidates</h2><p className={s.cardSub}>Matched by email: new people are added, existing ones updated. An empty cell never clears what is stored, and nobody is removed.</p></div>
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
        <SheetSyncControl
          help="In the sheet: File → Share → Publish to web → pick the Talent Pool tab → Comma-separated values → copy the link. The first sync runs right away; after that every hour."
          job="talent-pool" placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&output=csv"
          stopMessage="New form answers will no longer come in by themselves. People already in Talent Pool stay."
          sync={sync} title="Sync a Google Sheet every hour"
        />
      </div>
      {result ? <p className={result.tone === "error" ? s.danger : s.message} role={result.tone === "error" ? "alert" : "status"}>{result.text}</p> : null}
    </section>
  );
}

type SyncResultJson = { added?: number; updated?: number; unchanged?: number; skipped?: number };
function resultText(r: SyncResultJson) {
  const parts = [`${r.added || 0} new`, `${r.updated || 0} updated`];
  if (r.unchanged) parts.push(`${r.unchanged} unchanged`);
  if (r.skipped) parts.push(`${r.skipped} skipped (no valid email)`);
  return parts.join(" · ");
}

