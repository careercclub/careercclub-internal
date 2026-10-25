"use client";

import { startSheetSyncAction, stopSheetSyncAction, syncSheetNowAction } from "@/app/actions/sheet-sync-actions";
import type { SheetSyncState } from "@/lib/api/sheet-sync";
import type { SheetSyncJob } from "@/lib/sheet-sync/jobs";
import { formatDay } from "@/lib/text/date";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { confirmAction } from "./app-dialog";
import s from "./page-kit.module.css";
import { HelpTip } from "./ui-kit";

// Google Sheet sync, the same control in every module that has one (Talent Pool, Job Vacancy MT):
// paste the link once → Start sync (runs at once, then every hour) → Sync now / Stop sync.

const LABELS: Array<[string, string]> = [["added", "new"], ["updated", "updated"], ["removed", "removed"], ["unchanged", "unchanged"], ["contacts", "HR contacts"], ["skipped", "skipped (no valid email)"]];

export function syncResultText(result: Record<string, number | undefined>) {
  return LABELS.filter(([key]) => key === "added" || key === "updated" || result[key]).map(([key, label]) => `${result[key] || 0} ${label}`).join(" · ");
}

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
  return `${formatDay(date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }))}, ${time}`;
}

function sheetLabel(url: string) {
  try { const u = new URL(url); const gid = u.searchParams.get("gid") || new URLSearchParams(u.hash.slice(1)).get("gid"); return `Google Sheet${gid ? ` · tab ${gid}` : ""}`; } catch { return "Google Sheet"; }
}

type Props = { job: SheetSyncJob; sync: SheetSyncState | null; title: string; help: ReactNode; placeholder: string; stopMessage: string };

export function SheetSyncControl({ job, sync: initial, title, help, placeholder, stopMessage }: Props) {
  const router = useRouter();
  const [sync, setSync] = useState<SheetSyncState | null>(initial);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<SheetSyncState | null>) {
    setBusy(true); setError("");
    try { const next = await action(); setSync(next?.url ? next : null); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sync the sheet."); }
    finally { setBusy(false); }
  }
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) { setError("Paste the Google Sheet link."); (event.currentTarget.elements.namedItem("url") as HTMLInputElement | null)?.focus(); return; }
    await run(() => startSheetSyncAction(job, url.trim()));
  }
  async function stop() {
    if (!(await confirmAction({ title: "Stop Google Sheet sync?", message: stopMessage, confirmLabel: "Stop sync", danger: true }))) return;
    await run(() => stopSheetSyncAction(job));
  }

  if (!sync) {
    return (
      <form className={s.field} noValidate onSubmit={start} style={{ gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{title} <b aria-hidden="true" className={s.req}>*</b><HelpTip label="How to get the sheet link">{help}</HelpTip></span>
        <input aria-invalid={error ? true : undefined} aria-label="Google Sheet link" className={s.input} name="url" onChange={(event) => { setUrl(event.target.value); setError(""); }} placeholder={placeholder} style={error ? { borderColor: "var(--red)" } : undefined} type="url" value={url} />
        {error ? <p className={s.danger} role="alert" style={{ margin: 0, fontSize: 13 }}>{error}</p> : null}
        <button className={s.primary} disabled={busy} type="submit">{busy ? "Syncing…" : "Start sync"}</button>
      </form>
    );
  }
  return (
    <div className={s.field} style={{ gap: 10 }}>
      <span>Google Sheet sync</span>
      <div aria-label="Google Sheet sync status" role="group" style={{ display: "grid", gap: 4, padding: "12px 14px", border: `1px solid ${sync.needsReview ? "var(--red)" : "var(--border)"}`, borderRadius: 14, background: "var(--white)" }}>
        <b style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><i aria-hidden="true" className="ti ti-refresh" style={{ color: "var(--purple-mid)" }} />{sync.needsReview ? "Paused — needs a check" : "Every hour"} · <a href={sync.url} rel="noreferrer" target="_blank">{sheetLabel(sync.url)}</a></b>
        {sync.lastRunAt ? <small style={{ color: sync.lastError ? "var(--red)" : "var(--text-muted)", fontSize: 12 }}>Last sync {when(sync.lastRunAt)} · {sync.lastError ? sync.lastError : syncResultText(sync.lastResult || {})}</small> : <small style={{ color: "var(--text-muted)", fontSize: 12 }}>Not synced yet</small>}
        {error ? <small className={s.danger} role="alert">{error}</small> : null}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {sync.needsReview
          ? <button className={s.primary} disabled={busy} onClick={async () => { if (await confirmAction({ title: "Apply the sheet anyway?", message: sync.lastError || "", confirmLabel: "Apply anyway", danger: true })) await run(() => syncSheetNowAction(job, true)); }} type="button">{busy ? "Syncing…" : "Apply anyway"}</button>
          : null}
        <button className={sync.needsReview ? s.ghost : s.primary} disabled={busy} onClick={() => run(() => syncSheetNowAction(job))} type="button">{busy && !sync.needsReview ? "Syncing…" : "Sync now"}</button>
        <button className={s.ghost} disabled={busy} onClick={stop} style={{ color: "var(--red)" }} type="button">Stop sync</button>
      </div>
    </div>
  );
}
