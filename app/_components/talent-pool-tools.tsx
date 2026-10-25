"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useRef, useState } from "react";
import { askText, confirmAction } from "./app-dialog";
import s from "./email-blast.module.css";
import { DateTimeInput } from "./date-input";
import { facetOptions, filterCandidates, isBuyer } from "@/lib/talent-pool/view";

type Template = { name: string; subject: string; headerTitle: string; headerSub: string; headerColor: string; body: string; ctaText: string; ctaUrl: string; footer: string };
type Log = { subject: string; total: number; sent: number; failed: number; sentAt: string };
type BlastTab = "compose" | "templates" | "history" | "settings";

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
// Saved on this device only. This view mounts after a click (never server-rendered), so reading storage while initialising state is safe.
function readStore(key: string, fallback: string) { try { return typeof window === "undefined" ? fallback : localStorage.getItem(key) || fallback; } catch { return fallback; } }
function readJson<T>(key: string): T[] { try { const value = JSON.parse(readStore(key, "[]")); return Array.isArray(value) ? value : []; } catch { return []; } }
function writeStore(key: string, value: string | null) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage blocked: keep in memory */ } }
function escapeHtml(value: string) { return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] || character); }


export function TalentPoolTools({ rows }: { rows: ApiRecord[] }) {
  const [tab, setTab] = useState<BlastTab>("compose");
  const [segment, setSegment] = useState("all");
  const [cStatus, setCStatus] = useState("");
  const [cSumber, setCSumber] = useState("");
  const [cTier, setCTier] = useState("");
  const [subject, setSubject] = useState("");
  const [headerTitle, setHeaderTitle] = useState("CareerCclub");
  const [headerSub, setHeaderSub] = useState("");
  const [headerColor, setHeaderColor] = useState("#1554c0");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [footer, setFooter] = useState("© 2026 CareerCclub | careercclub.com");
  const [schedule, setSchedule] = useState("");
  const [fromName, setFromName] = useState(() => readStore("ccc_blast_from_name", "CareerCclub"));
  const [fromEmail, setFromEmail] = useState(() => readStore("ccc_blast_from_email", ""));
  const [templates, setTemplates] = useState<Template[]>(() => readJson("ccc_tp_blast_templates"));
  const [logs, setLogs] = useState<Log[]>(() => readJson("ccc_tp_blast_logs"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState<"" | "subject" | "body">("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);


  // Same options and matching as the Candidates filters (lib/talent-pool/view.ts facets).
  const statusOptions = useMemo(() => facetOptions(rows, "status").map(([value]) => value), [rows]);
  const sumberOptions = useMemo(() => facetOptions(rows, "source").map(([value]) => value), [rows]);
  const tierOptions = useMemo(() => facetOptions(rows, "tier").map(([value]) => value), [rows]);

  const recipients = useMemo(() => {
    let list = rows.filter((row) => text(row.email).includes("@"));
    if (segment === "beli") list = list.filter(isBuyer);
    else if (segment === "belum") list = list.filter((row) => !isBuyer(row));
    else if (segment === "custom") {
      list = filterCandidates(list, { facets: { status: cStatus, source: cSumber, tier: cTier } });
    }
    return list;
  }, [rows, segment, cStatus, cSumber, cTier]);

  function buildHtml(preview = false) {
    const nama = (value: string) => (preview ? value.replaceAll("{nama}", "Kak Sample") : value);
    const safeBody = nama(escapeHtml(body).replace(/\n/g, "<br>")) || "<span style=\"color:#888\">(email body is empty)</span>";
    const title = nama(escapeHtml(headerTitle) || "CareerCclub");
    const sub = nama(escapeHtml(headerSub));
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f7;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0"><tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">
      <tr><td style="background:${headerColor};border-radius:12px 12px 0 0;padding:32px 40px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#fff;margin-bottom:6px">${title}</div>
        ${sub ? `<div style="font-size:14px;color:rgba(255,255,255,0.75)">${sub}</div>` : ""}
      </td></tr>
      <tr><td style="background:#ffffff;padding:36px 40px">
        <div style="font-size:15px;line-height:1.7;color:#1a1a2e">${safeBody}</div>
        ${ctaText && ctaUrl ? `<div style="text-align:center;margin-top:28px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${headerColor};color:#fff;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(ctaText)}</a></div>` : ""}
      </td></tr>
      <tr><td style="background:#f4f4f7;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center">
        <div style="font-size:11px;color:#888">${escapeHtml(footer)}</div>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  }

  function applyTemplate(template: Template) {
    setSubject(template.subject); setHeaderTitle(template.headerTitle); setHeaderSub(template.headerSub);
    setHeaderColor(template.headerColor || "#1554c0"); setBody(template.body); setCtaText(template.ctaText);
    setCtaUrl(template.ctaUrl); setFooter(template.footer || "© 2026 CareerCclub | careercclub.com");
    setMessage(`Template "${template.name}" loaded.`);
  }

  async function saveTemplate() {
    const name = await askText({ title: "Save as template", label: "Template name", submitLabel: "Save template" });
    if (!name?.trim()) return;
    const next = [...templates, { name: name.trim(), subject, headerTitle, headerSub, headerColor, body, ctaText, ctaUrl, footer }];
    setTemplates(next); writeStore("ccc_tp_blast_templates", JSON.stringify(next)); setMessage(`Template "${name.trim()}" saved.`);
  }

  function deleteTemplate(index: number) {
    const next = templates.filter((_, itemIndex) => itemIndex !== index);
    setTemplates(next); writeStore("ccc_tp_blast_templates", JSON.stringify(next));
  }

  function saveSettings() {
    writeStore("ccc_blast_from_name", fromName || "CareerCclub");
    if (fromEmail) writeStore("ccc_blast_from_email", fromEmail); else writeStore("ccc_blast_from_email", null);
    setMessage("Sender saved on this device. The Resend API key stays on the server.");
  }

  async function send() {
    if (!subject.trim()) { setInvalid("subject"); setMessage("Subject is required."); subjectRef.current?.focus(); return; }
    if (!body.trim()) { setInvalid("body"); setMessage("Email body is required."); bodyRef.current?.focus(); return; }
    setInvalid("");
    const list = recipients.map((row) => ({ email: text(row.email), name: text(row.nama) })).filter((recipient) => recipient.email);
    if (!list.length) { setMessage("No recipients with a valid email."); return; }
    if (schedule && !Number.isFinite(new Date(schedule).getTime())) { setMessage("Send time is not valid."); return; }
    if (!(await confirmAction({ title: `Send to ${list.length} recipient${list.length === 1 ? "" : "s"}?`, message: schedule ? `Scheduled for ${schedule}.` : "The email is sent now.", confirmLabel: schedule ? "Schedule email" : "Send email" }))) return;

    setBusy(true); setMessage("Sending… please wait.");
    const html = buildHtml();
    const scheduledAt = schedule ? new Date(schedule).toISOString() : undefined;
    let sent = 0; let failed = 0;
    try {
      for (let offset = 0; offset < list.length; offset += 100) {
        const response = await fetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: list.slice(offset, offset + 100), subject, from_name: fromName, from_email: fromEmail || undefined, scheduled_at: scheduledAt, html, source: "talent-pool" }) });
        const result = await response.json() as { sent?: number; failed?: number; error?: string };
        if (!response.ok) throw new Error(result.error || "Email blast failed.");
        sent += result.sent || 0; failed += result.failed || 0;
      }
      const nextLogs = [{ subject, total: list.length, sent, failed, sentAt: scheduledAt || new Date().toISOString() }, ...logs].slice(0, 100);
      setLogs(nextLogs); writeStore("ccc_tp_blast_logs", JSON.stringify(nextLogs));
      setMessage(`${schedule ? "Scheduled" : "Sent"} ${sent}; failed ${failed}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Email blast failed."); }
    finally { setBusy(false); }
  }

  const tabs: Array<[BlastTab, string]> = [["compose", "Compose"], ["templates", `Templates`], ["history", "History"], ["settings", "Sender"]];
  const previewHtml = useMemo(() => buildHtml(true), [subject, headerTitle, headerSub, headerColor, body, ctaText, ctaUrl, footer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={s.wrap}>
      <div className={s.subTabs} role="tablist" aria-label="Email blast">
        {tabs.map(([key, labelText]) => (
          <button aria-selected={tab === key} className={tab === key ? s.subTabActive : s.subTab} key={key} onClick={() => setTab(key)} role="tab" type="button">
            {labelText}{key === "templates" && templates.length ? <span>{templates.length}</span> : null}{key === "history" && logs.length ? <span>{logs.length}</span> : null}
          </button>
        ))}
      </div>

      {tab === "compose" ? (
        <div className={s.compose}>
          <div className={s.form}>
            <section className={s.card} aria-labelledby="blast-to">
              <h3 id="blast-to">Recipients</h3>
              <label className={s.field}><span>Segment</span>
                <select onChange={(event) => setSegment(event.target.value)} value={segment}>
                  <option value="all">Everyone with an email</option>
                  <option value="beli">Buyers</option>
                  <option value="belum">Not a buyer</option>
                  <option value="custom">Custom filter…</option>
                </select>
              </label>
              {segment === "custom" ? (
                <div className={s.row3}>
                  <label className={s.field}><span>Status</span><select onChange={(event) => setCStatus(event.target.value)} value={cStatus}><option value="">All</option>{statusOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className={s.field}><span>Source</span><select onChange={(event) => setCSumber(event.target.value)} value={cSumber}><option value="">All</option>{sumberOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className={s.field}><span>Tier</span><select onChange={(event) => setCTier(event.target.value)} value={cTier}><option value="">All</option>{tierOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                </div>
              ) : null}
              <p className={s.recipients}><i className="ti ti-users" aria-hidden="true" /> {recipients.length} recipient{recipients.length === 1 ? "" : "s"}</p>
            </section>

            <section className={s.card} aria-labelledby="blast-email">
              <h3 id="blast-email">Email</h3>
              <label className={s.field}><span>Subject <b className={s.req}>*</b></span><input aria-invalid={invalid === "subject" || undefined} className={invalid === "subject" ? s.invalid : undefined} onChange={(event) => { setSubject(event.target.value); if (invalid === "subject") setInvalid(""); }} placeholder="Email subject" ref={subjectRef} value={subject} /></label>
              <div className={s.row2}>
                <label className={s.field}><span>Template</span>
                  <select onChange={(event) => { const template = templates[Number(event.target.value)]; if (template) applyTemplate(template); }} value="">
                    <option value="">{templates.length ? "Load a template" : "No templates yet"}</option>
                    {templates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}
                  </select>
                </label>
                <label className={s.field}><span>Send at</span><DateTimeInput aria-label="Send at" onValueChange={setSchedule} value={schedule} /><small>Leave empty to send now</small></label>
              </div>
            </section>

            <section className={s.card} aria-labelledby="blast-content">
              <div className={s.cardHead}><h3 id="blast-content">Content</h3><button className={s.ghost} onClick={saveTemplate} type="button"><i className="ti ti-bookmark" aria-hidden="true" /> Save as template</button></div>
              <div className={s.row2}>
                <label className={s.field}><span>Header title</span><input onChange={(event) => setHeaderTitle(event.target.value)} value={headerTitle} /></label>
                <label className={s.field}><span>Header subtitle</span><input onChange={(event) => setHeaderSub(event.target.value)} placeholder="Optional" value={headerSub} /></label>
              </div>
              <label className={s.colorField}><span>Header color</span><input onChange={(event) => setHeaderColor(event.target.value)} type="color" value={headerColor} /></label>
              <label className={s.field}><span>Body <b className={s.req}>*</b></span><textarea aria-invalid={invalid === "body" || undefined} className={invalid === "body" ? s.invalid : undefined} onChange={(event) => { setBody(event.target.value); if (invalid === "body") setInvalid(""); }} placeholder="Write the email… use {nama} for each recipient's name." ref={bodyRef} rows={7} value={body} /><small>Tip: <code>{"{nama}"}</code> is replaced with each recipient&apos;s name.</small></label>
              <div className={s.row2}>
                <label className={s.field}><span>Button text</span><input onChange={(event) => setCtaText(event.target.value)} placeholder="Optional" value={ctaText} /></label>
                <label className={s.field}><span>Button link</span><input onChange={(event) => setCtaUrl(event.target.value)} placeholder="https://…" value={ctaUrl} /></label>
              </div>
              <label className={s.field}><span>Footer</span><input onChange={(event) => setFooter(event.target.value)} value={footer} /></label>
            </section>
          </div>

          <aside className={s.previewCol} aria-label="Email preview">
            <div className={s.previewHead}><b>Preview</b><span>{subject || "(no subject)"}</span></div>
            <iframe className={s.preview} sandbox="" srcDoc={previewHtml} title="Email preview" />
            <button className={s.send} disabled={busy} onClick={send} type="button"><i className="ti ti-send" aria-hidden="true" /> {busy ? "Sending…" : schedule ? `Schedule email to ${recipients.length}` : `Send email to ${recipients.length}`}</button>
            {message ? <p className={s.message} role="status">{message}</p> : null}
          </aside>
        </div>
      ) : null}

      {tab === "templates" ? (
        templates.length ? (
          <ul className={s.templates}>
            {templates.map((template, index) => (
              <li className={s.card} key={`${template.name}-${index}`}>
                <div className={s.cardHead}><h3>{template.name}</h3><button aria-label={`Delete template ${template.name}`} className={s.iconDanger} onClick={async () => { if (await confirmAction({ title: `Delete template "${template.name}"?`, message: "Saved on this device only.", confirmLabel: "Delete template", danger: true })) deleteTemplate(index); }} type="button"><i className="ti ti-trash" aria-hidden="true" /></button></div>
                <p className={s.muted}>{template.subject || "(no subject)"}</p>
                <button className={s.ghost} onClick={() => { applyTemplate(template); setTab("compose"); }} type="button">Use template</button>
              </li>
            ))}
          </ul>
        ) : <p className={s.empty}>No templates yet. Save one from Compose.</p>
      ) : null}

      {tab === "history" ? (
        logs.length ? (
          <ul className={s.history}>
            {logs.map((log, index) => (
              <li key={`${log.sentAt}-${index}`}>
                <span className={s.historyMain}><b>{log.subject || "(no subject)"}</b><small>{new Date(log.sentAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></span>
                <span className={log.failed ? s.historyFail : s.historyOk}>{log.sent}/{log.total} sent{log.failed ? ` · ${log.failed} failed` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className={s.empty}>No email blasts sent yet.</p>
      ) : null}

      {tab === "settings" ? (
        <section className={`${s.card} ${s.settings}`} aria-labelledby="blast-sender">
          <h3 id="blast-sender">Sender</h3>
          <label className={s.field}><span>Sender name</span><input onChange={(event) => setFromName(event.target.value)} value={fromName} /></label>
          <label className={s.field}><span>Sender email</span><input onChange={(event) => setFromEmail(event.target.value)} placeholder="blast@yourdomain.com" type="email" value={fromEmail} /><small>Must be a domain verified in Resend. Leave empty to use the server default.</small></label>
          <button className={s.primary} onClick={saveSettings} type="button">Save sender</button>
          {message ? <p className={s.message} role="status">{message}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
