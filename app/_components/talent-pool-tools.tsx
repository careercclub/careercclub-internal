"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "../record-manager.module.css";

type BlastTemplate = { name: string; subject: string; body: string };
type BlastLog = { subject: string; total: number; sent: number; failed: number; sentAt: string };

export function TalentPoolTools({ rows }: { rows: ApiRecord[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromName, setFromName] = useState("CareerCclub");
  const [fromEmail, setFromEmail] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [templates, setTemplates] = useState<BlastTemplate[]>([]);
  const [logs, setLogs] = useState<BlastLog[]>([]);
  const visible = useMemo(() => rows.filter((row) => (!query || `${row.nama} ${row.email} ${row.wa} ${row.universitas}`.toLowerCase().includes(query.toLowerCase())) && (!pipeline || String(row.pipeline || "") === pipeline)), [rows, query, pipeline]);
  const pipelines = [...new Set(rows.map((row) => String(row.pipeline || "")).filter(Boolean))].sort();

  async function importFile(formData: FormData) {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/talent-pool/import", { method: "POST", body: formData }); const result = await response.json() as { imported?: number; skipped?: number; error?: string }; if (!response.ok) throw new Error(result.error || "Import failed."); setMessage(`Imported ${result.imported || 0}; skipped ${result.skipped || 0}.`); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); } finally { setBusy(false); }
  }

  function loadBlastStorage() {
    try {
      setTemplates(JSON.parse(localStorage.getItem("ccc_tp_blast_templates") || "[]") as BlastTemplate[]);
      setLogs(JSON.parse(localStorage.getItem("ccc_tp_blast_logs") || "[]") as BlastLog[]);
      setFromName(localStorage.getItem("ccc_blast_from_name") || "CareerCclub");
      setFromEmail(localStorage.getItem("ccc_blast_from_email") || "");
    } catch { setMessage("Stored blast data could not be read."); }
  }

  function saveTemplate() {
    const name = window.prompt("Template name");
    if (!name?.trim() || !subject.trim() || !body.trim()) return;
    const next = [...templates, { name: name.trim(), subject, body }];
    setTemplates(next); localStorage.setItem("ccc_tp_blast_templates", JSON.stringify(next)); setMessage("Template saved.");
  }

  function deleteTemplate(index: number) {
    const next = templates.filter((_, itemIndex) => itemIndex !== index);
    setTemplates(next); localStorage.setItem("ccc_tp_blast_templates", JSON.stringify(next));
  }

  function saveSettings() {
    localStorage.setItem("ccc_blast_from_name", fromName || "CareerCclub");
    if (fromEmail) localStorage.setItem("ccc_blast_from_email", fromEmail); else localStorage.removeItem("ccc_blast_from_email");
    setMessage("Sender settings saved on this device. The Resend API key remains server-only.");
  }

  async function sendBlast() {
    const recipients = visible.map((row) => ({ email: String(row.email || ""), name: String(row.nama || "") })).filter((recipient) => recipient.email);
    if (!recipients.length) { setMessage("No matching recipient email addresses."); return; }
    const scheduleInput = window.prompt("Optional schedule (YYYY-MM-DDTHH:mm). Leave blank to send now.", scheduledAt);
    if (scheduleInput === null) return;
    if (scheduleInput && !Number.isFinite(new Date(scheduleInput).getTime())) { setMessage("The scheduled date/time is invalid."); return; }
    setScheduledAt(scheduleInput);
    setBusy(true);
    try { let sent=0;let failed=0;for(let offset=0;offset<recipients.length;offset+=100){const response = await fetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: recipients.slice(offset,offset+100), subject: subject || "CareerCclub update", from_name: fromName, from_email: fromEmail || undefined, scheduled_at: scheduleInput ? new Date(scheduleInput).toISOString() : undefined, html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${body.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] || character)}</div>` }) }); const result = await response.json() as { sent?: number; failed?: number; error?: string }; if (!response.ok) throw new Error(result.error || "Blast failed.");sent+=result.sent||0;failed+=result.failed||0;} const nextLogs = [{ subject, total: recipients.length, sent, failed, sentAt: scheduleInput ? new Date(scheduleInput).toISOString() : new Date().toISOString() }, ...logs].slice(0, 100); setLogs(nextLogs); localStorage.setItem("ccc_tp_blast_logs", JSON.stringify(nextLogs)); setMessage(`${scheduleInput?"Scheduled":"Sent"} ${sent}; failed ${failed}.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Blast failed."); } finally { setBusy(false); }
  }

  return <div className={styles.toolStack}><div className={styles.metricStrip}><div><strong>{rows.length}</strong><span>profiles</span></div><div><strong>{rows.filter((row) => row.buyer_match).length}</strong><span>buyer matches</span></div><div><strong>{visible.length}</strong><span>filtered</span></div></div><div className={styles.filterBar}><input placeholder="Search talent pool" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={pipeline} onChange={(event) => setPipeline(event.target.value)}><option value="">All pipelines</option>{pipelines.map((item) => <option key={item}>{item}</option>)}</select></div><div className={styles.toolGrid}><details className={styles.createPanel}><summary><i className="ti ti-file-import" /> Import CSV/XLSX</summary><form action={importFile} className={styles.toolForm}><input accept=".csv,.xlsx" name="file" type="file" required /><button className={styles.primaryButton} disabled={busy}>Import</button></form></details><details className={styles.createPanel} onToggle={(event) => { if (event.currentTarget.open) loadBlastStorage(); }}><summary><i className="ti ti-send" /> Email filtered profiles</summary><form action={sendBlast} className={styles.formGrid}><label className={styles.field}><span>Template</span><select defaultValue="" onChange={(event) => { const template = templates[Number(event.target.value)]; if (template) { setSubject(template.subject); setBody(template.body); } }}><option value="">Select saved template</option>{templates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}</select></label><label className={styles.field}><span>Subject</span><input required value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label className={styles.field}><span>Message</span><textarea required value={body} onChange={(event) => setBody(event.target.value)} /></label><button className={styles.secondaryButton} onClick={saveTemplate} type="button">Save template</button><button className={styles.primaryButton} disabled={busy}>Send to {Math.min(visible.length, 100)}</button></form></details><details className={styles.createPanel} onToggle={(event) => { if (event.currentTarget.open) loadBlastStorage(); }}><summary><i className="ti ti-bookmarks" /> Blast templates</summary><div className={styles.summaryGrid}>{templates.map((template, index) => <article key={`${template.name}-${index}`}><header><strong>{template.name}</strong><button onClick={() => deleteTemplate(index)} type="button"><i className="ti ti-trash" /></button></header><p>{template.subject}</p><button className={styles.secondaryButton} onClick={() => { setSubject(template.subject); setBody(template.body); }} type="button">Use template</button></article>)}</div></details><details className={styles.createPanel} onToggle={(event) => { if (event.currentTarget.open) loadBlastStorage(); }}><summary><i className="ti ti-history" /> Blast history</summary><div className={styles.timelineList}>{logs.map((log, index) => <div key={`${log.sentAt}-${index}`}><strong>{log.subject}</strong><span>{log.sent}/{log.total} sent, {log.failed} failed</span><span>{new Date(log.sentAt).toLocaleString("id-ID")}</span></div>)}</div></details><details className={styles.createPanel} onToggle={(event) => { if (event.currentTarget.open) loadBlastStorage(); }}><summary><i className="ti ti-settings" /> Sender settings</summary><div className={styles.formGrid}><label className={styles.field}><span>Sender name</span><input value={fromName} onChange={(event) => setFromName(event.target.value)} /></label><label className={styles.field}><span>Sender email</span><input type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} /></label><button className={styles.primaryButton} onClick={saveSettings} type="button">Save settings</button></div></details></div>{message ? <p className={styles.formMessage}>{message}</p> : null}</div>;
}
