"use client";

import { startTalentSheetSyncAction, stopTalentSheetSyncAction, syncTalentSheetNowAction } from "@/app/actions/talent-pool-actions";
import type { TalentSheetSync } from "@/lib/api/talent-pool-sync";
import { formatDay } from "@/lib/text/date";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { confirmAction } from "./app-dialog";
import g from "./library.module.css";
import s from "./page-kit.module.css";
import { HelpTip } from "./ui-kit";

type Result = { tone: "ok" | "error"; text: string };

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
  return `${formatDay(date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }))}, ${time}`;
}

function sheetLabel(url: string) {
  try { const u = new URL(url); const gid = u.searchParams.get("gid") || new URLSearchParams(u.hash.slice(1)).get("gid"); return `Google Sheet${gid ? ` · tab ${gid}` : ""}`; } catch { return "Google Sheet"; }
}

/** Talent Pool → Manage data: import a CSV/XLSX file, or keep a Google Sheet in sync every hour. */
export function TalentPoolSheetsImport({ sync: initialSync = null }: { sync?: TalentSheetSync | null }) {
  const [sync, setSync] = useState<TalentSheetSync | null>(initialSync);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "file" | "url">("");
  const [result, setResult] = useState<Result | null>(null);
  const [fileName, setFileName] = useState("");

  // onSubmit rather than a form action, so a failed import keeps the pasted link / chosen file.
  async function submit(event: FormEvent<HTMLFormElement>, kind: "file") {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(kind); setResult(null);
    try {
      const response = await fetch("/api/talent-pool/import", { method: "POST", body: formData });
      const data = await response.json() as SyncResultJson & { error?: string };
      if (!response.ok) throw new Error(data.error || "Import failed.");
      setResult({ tone: "ok", text: resultText(data) });
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
        <SheetSync busy={busy} setBusy={setBusy} setResult={setResult} setSync={setSync} setUrl={setUrl} setUrlError={setUrlError} sync={sync} url={url} urlError={urlError} />
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

type SyncProps = {
  sync: TalentSheetSync | null; setSync: (value: TalentSheetSync | null) => void;
  url: string; setUrl: (value: string) => void; urlError: string; setUrlError: (value: string) => void;
  busy: "" | "file" | "url"; setBusy: (value: "" | "file" | "url") => void; setResult: (value: Result | null) => void;
};

/** Google Sheet sync: paste the link once, then the sheet is read every hour. */
function SheetSync({ sync, setSync, url, setUrl, urlError, setUrlError, busy, setBusy, setResult }: SyncProps) {
  const router = useRouter();
  async function run(action: () => Promise<TalentSheetSync | null>) {
    setBusy("url"); setResult(null);
    try { const next = await action(); setSync(next?.url ? next : null); router.refresh(); }
    catch (error) { setUrlError(error instanceof Error ? error.message : "Could not sync the sheet."); }
    finally { setBusy(""); }
  }
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) { setUrlError("Paste the Google Sheet link."); (event.currentTarget.elements.namedItem("url") as HTMLInputElement | null)?.focus(); return; }
    setUrlError("");
    await run(() => startTalentSheetSyncAction(url.trim()));
  }
  async function stop() {
    if (!(await confirmAction({ title: "Stop Google Sheet sync?", message: "New form answers will no longer come in by themselves. People already in Talent Pool stay.", confirmLabel: "Stop sync", danger: true }))) return;
    await run(() => stopTalentSheetSyncAction());
  }

  if (!sync) {
    return (
      <form className={s.field} noValidate onSubmit={start} style={{ gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>Sync a Google Sheet every hour <b aria-hidden="true" className={s.req}>*</b><HelpTip label="How to get the sheet link">In the sheet: File → Share → Publish to web → pick the Talent Pool tab → Comma-separated values → copy the link. The first sync runs right away; after that every hour.</HelpTip></span>
        <input aria-invalid={urlError ? true : undefined} aria-label="Google Sheet link" className={s.input} name="url" onChange={(event) => { setUrl(event.target.value); setUrlError(""); }} placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&output=csv" style={urlError ? { borderColor: "var(--red)" } : undefined} type="url" value={url} />
        {urlError ? <p className={s.danger} role="alert" style={{ margin: 0, fontSize: 13 }}>{urlError}</p> : null}
        <button className={s.primary} disabled={Boolean(busy)} type="submit">{busy === "url" ? "Syncing…" : "Start sync"}</button>
      </form>
    );
  }
  return (
    <div className={s.field} style={{ gap: 10 }}>
      <span>Google Sheet sync</span>
      <div aria-label="Google Sheet sync status" role="group" style={{ display: "grid", gap: 4, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 14, background: "var(--white)" }}>
        <b style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><i aria-hidden="true" className="ti ti-refresh" style={{ color: "var(--purple-mid)" }} />Every hour · <a href={sync.url} rel="noreferrer" target="_blank">{sheetLabel(sync.url)}</a></b>
        {sync.lastRunAt ? <small style={{ color: sync.lastError ? "var(--red)" : "var(--text-muted)", fontSize: 12 }}>Last sync {when(sync.lastRunAt)} · {sync.lastError ? sync.lastError : resultText(sync.lastResult || {})}</small> : <small style={{ color: "var(--text-muted)", fontSize: 12 }}>Not synced yet</small>}
        {urlError ? <small className={s.danger} role="alert">{urlError}</small> : null}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={s.primary} disabled={Boolean(busy)} onClick={() => run(() => syncTalentSheetNowAction())} type="button">{busy === "url" ? "Syncing…" : "Sync now"}</button>
        <button className={s.ghost} disabled={Boolean(busy)} onClick={stop} style={{ color: "var(--red)" }} type="button">Stop sync</button>
      </div>
    </div>
  );
}
