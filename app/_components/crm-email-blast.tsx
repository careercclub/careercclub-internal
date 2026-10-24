"use client";

import { bulkUpdateCrmBuyers } from "@/app/actions/crm-actions";
import type { DailyBlastCount, EmailBlastRecord } from "@/lib/api/email-blast";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { MonthlyOpenChart } from "./charts";
import s from "./email-blast.module.css";
import { askText, confirmAction } from "./app-dialog";
import { compareText } from "@/lib/text/sort";

type BlastTab = "compose" | "templates" | "history" | "settings";
type Segment = "all" | "has_email" | "belum_diblast" | "custom";
type Template = { name: string; subject: string; body: string };

const SEGMENT_LABELS: Array<[Segment, string]> = [
  ["all", "Everyone with an email"],
  ["has_email", "Has an email"],
  ["belum_diblast", "Never blasted"],
  ["custom", "Custom filter…"],
];

// Templates and the sender identity stay per-browser, matching legacy main. Only the
// blast log moved to PostgreSQL, because that is the figure the team reads together.
const TEMPLATE_KEY = "ccc_blast_templates";
const FROM_NAME_KEY = "ccc_blast_from_name";
const FROM_EMAIL_KEY = "ccc_blast_from_email";

function readStore<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function readText(key: string, fallback: string) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function writeStore(key: string, value: unknown) {
  try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch { /* private mode */ }
}

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
type Row = Record<string, unknown>;
function unique(rows: Row[], field: string) {
  return [...new Set(rows.map((row) => text(row[field])).filter(Boolean))].sort(compareText);
}
function escapeHtml(value: string) {
  return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] || character);
}
// The exact HTML that is sent; the preview shows the same markup.
function emailHtml(body: string) { return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>`; }
function dayLabel(day: string) { const [, month, date] = day.split("-"); return `${Number(date)}/${Number(month)}`; }

export function CrmEmailBlast({ rows, history, daily }: { rows: Row[]; history: EmailBlastRecord[]; daily: DailyBlastCount[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<BlastTab>("compose");
  const [segment, setSegment] = useState<Segment>("all");
  const [klasifikasi, setKlasifikasi] = useState("");
  const [industri, setIndustri] = useState("");
  const [tahap, setTahap] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [schedule, setSchedule] = useState("");
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<Template[]>(() => readStore<Template[]>(TEMPLATE_KEY, []));
  const [fromName, setFromName] = useState(() => readText(FROM_NAME_KEY, "CareerCclub"));
  const [fromEmail, setFromEmail] = useState(() => readText(FROM_EMAIL_KEY, ""));
  const [pending, start] = useTransition();
  const [invalid, setInvalid] = useState<"" | "subject" | "body">("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Mirrors legacy _blastGetRecipients: a valid email is always required, then the
  // segment narrows further.
  const recipients = useMemo(() => {
    let list = rows.filter((row) => text(row.email).includes("@"));
    if (segment === "belum_diblast") list = list.filter((row) => text(row.status) === "Belum diblast");
    if (segment === "custom") {
      if (klasifikasi) list = list.filter((row) => text(row.klasifikasi) === klasifikasi);
      if (industri) list = list.filter((row) => text(row.industri) === industri);
      if (tahap) list = list.filter((row) => text(row.tahap) === tahap);
    }
    return list;
  }, [rows, segment, klasifikasi, industri, tahap]);

  async function send() {
    if (!subject.trim()) { setInvalid("subject"); subjectRef.current?.focus(); return setMessage("Subject is required."); }
    if (!body.trim()) { setInvalid("body"); bodyRef.current?.focus(); return setMessage("Email body is required."); }
    setInvalid("");
    if (!recipients.length) return setMessage("No valid recipients (check the segment and that buyers have an email).");
    // Resend caps a request at 100 recipients, so send in batches of 100.
    const batches: Row[][] = [];
    for (let index = 0; index < recipients.length; index += 100) batches.push(recipients.slice(index, index + 100));
    if (!(await confirmAction({ title: `Send to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}?`, message: schedule ? `Scheduled for ${schedule}.` : "The email is sent now.", confirmLabel: schedule ? "Schedule email" : "Send email" }))) return;

    setMessage(`Sending to ${recipients.length} recipients…`);
    let sent = 0;
    let failed = 0;
    for (const batch of batches) {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: batch.map((row) => ({ email: text(row.email), name: text(row.name) })),
          subject,
          html: emailHtml(body),
          from_name: fromName || undefined,
          from_email: fromEmail || undefined,
          scheduled_at: schedule ? new Date(schedule).toISOString() : undefined,
          source: "crm",
          segment: segment === "custom" ? `custom:${[klasifikasi, industri, tahap].filter(Boolean).join("/") || "all"}` : segment,
        }),
      });
      const result = await response.json() as { sent?: number; failed?: number; error?: string };
      if (!response.ok) { setMessage(result.error || "Email blast failed."); return; }
      sent += result.sent || 0;
      failed += result.failed || 0;
    }

    // Legacy marks recipients as blasted, but only for an immediate send.
    if (!schedule && sent) {
      const ids = recipients.flatMap((row) => (Array.isArray(row.ids) ? row.ids.map(String) : [String(row.id)]));
      try { await bulkUpdateCrmBuyers(ids, "status", "Diblast"); } catch { /* status is a convenience, not the send */ }
    }
    setMessage(`Done. ${sent} sent${failed ? `, ${failed} failed` : ""}.`);
    setTab("history");
    router.refresh();
  }

  async function saveTemplate() {
    const name = await askText({ title: "Save as template", label: "Template name", submitLabel: "Save template" });
    if (!name) return;
    const next = [...templates.filter((template) => template.name !== name), { name, subject, body }];
    setTemplates(next);
    writeStore(TEMPLATE_KEY, next);
    setMessage(`Template "${name}" saved.`);
  }

  const totalSent = daily.reduce((sum, item) => sum + item.sent, 0);
  const busiest = daily.reduce((best, item) => (item.sent > best.sent ? item : best), { day: "", sent: 0 });
  const previewHtml = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#fff;font-size:14px;line-height:1.6;color:#14212c">${body.trim() ? emailHtml(body.replaceAll("{nama}", "Kak Sample")) : '<span style="color:#888;font-family:Arial,sans-serif">(email body is empty)</span>'}</body></html>`;
  const tabs: Array<[BlastTab, string]> = [["compose", "Compose"], ["templates", "Templates"], ["history", "History"], ["settings", "Sender"]];

  return (
    <div className={s.wrap}>
      <div className={s.subTabs} role="tablist" aria-label="Email blast">
        {tabs.map(([id, label]) => (
          <button aria-selected={tab === id} className={tab === id ? s.subTabActive : s.subTab} key={id} onClick={() => setTab(id)} role="tab" type="button">
            {label}{id === "templates" && templates.length ? <span>{templates.length}</span> : null}{id === "history" && history.length ? <span>{history.length}</span> : null}
          </button>
        ))}
      </div>

      {tab === "compose" ? (
        <div className={s.compose}>
          <div className={s.form}>
            <section className={s.card} aria-labelledby="crm-blast-to">
              <h3 id="crm-blast-to">Recipients</h3>
              <label className={s.field}><span>Segment</span>
                <select onChange={(event) => setSegment(event.target.value as Segment)} value={segment}>
                  {SEGMENT_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {segment === "custom" ? (
                <div className={s.row3}>
                  <label className={s.field}><span>Classification</span><select onChange={(event) => setKlasifikasi(event.target.value)} value={klasifikasi}><option value="">All</option>{unique(rows, "klasifikasi").map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label className={s.field}><span>Industry</span><select onChange={(event) => setIndustri(event.target.value)} value={industri}><option value="">All</option>{unique(rows, "industri").map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label className={s.field}><span>Stage</span><select onChange={(event) => setTahap(event.target.value)} value={tahap}><option value="">All</option>{unique(rows, "tahap").map((value) => <option key={value}>{value}</option>)}</select></label>
                </div>
              ) : null}
              <p className={s.recipients}><i className="ti ti-users" aria-hidden="true" /> {recipients.length} recipient{recipients.length === 1 ? "" : "s"}{!schedule ? " · marked Blasted after sending" : ""}</p>
            </section>

            <section className={s.card} aria-labelledby="crm-blast-email">
              <div className={s.cardHead}><h3 id="crm-blast-email">Email</h3><button className={s.ghost} onClick={saveTemplate} type="button"><i className="ti ti-bookmark" aria-hidden="true" /> Save as template</button></div>
              <label className={s.field}><span>Subject <b className={s.req}>*</b></span><input aria-invalid={invalid === "subject" || undefined} className={invalid === "subject" ? s.invalid : undefined} onChange={(event) => { setSubject(event.target.value); if (invalid === "subject") setInvalid(""); }} placeholder="Email subject" ref={subjectRef} value={subject} /></label>
              <label className={s.field}><span>Send at</span><input onChange={(event) => setSchedule(event.target.value)} type="datetime-local" value={schedule} /><small>Leave empty to send now</small></label>
              <label className={s.field}><span>Body <b className={s.req}>*</b></span><textarea aria-invalid={invalid === "body" || undefined} className={invalid === "body" ? s.invalid : undefined} onChange={(event) => { setBody(event.target.value); if (invalid === "body") setInvalid(""); }} placeholder="Write the email… use {nama} for each buyer's name." ref={bodyRef} rows={10} value={body} /><small>Tip: <code>{"{nama}"}</code> is replaced with each buyer&apos;s name.</small></label>
            </section>
          </div>

          <aside className={s.previewCol} aria-label="Email preview">
            <div className={s.previewHead}><b>Preview</b><span>{subject || "(no subject)"}</span></div>
            <iframe className={s.preview} sandbox="" srcDoc={previewHtml} title="Email preview" />
            <button className={s.send} disabled={pending} onClick={() => start(() => { void send(); })} type="button"><i className="ti ti-send" aria-hidden="true" /> {schedule ? `Schedule email to ${recipients.length}` : `Send email to ${recipients.length}`}</button>
            {message ? <p className={s.message} role="status">{message}</p> : null}
          </aside>
        </div>
      ) : null}

      {tab === "templates" ? (
        templates.length ? (
          <ul className={s.templates}>
            {templates.map((template) => (
              <li className={s.card} key={template.name}>
                <div className={s.cardHead}><h3>{template.name}</h3><button aria-label={`Delete template ${template.name}`} className={s.iconDanger} onClick={async () => { if (!(await confirmAction({ title: `Delete template "${template.name}"?`, message: "Saved on this device only.", confirmLabel: "Delete template", danger: true }))) return; const next = templates.filter((item) => item.name !== template.name); setTemplates(next); writeStore(TEMPLATE_KEY, next); }} type="button"><i className="ti ti-trash" aria-hidden="true" /></button></div>
                <p className={s.muted}>{template.subject || "(no subject)"}</p>
                <button className={s.ghost} onClick={() => { setSubject(template.subject); setBody(template.body); setTab("compose"); }} type="button">Use template</button>
              </li>
            ))}
          </ul>
        ) : <p className={s.empty}>No templates yet. Save one from Compose.</p>
      ) : null}

      {tab === "history" ? (
        <div className={s.form}>
          {message ? <p className={s.message} role="status">{message}</p> : null}
          <div className={s.row3}>
            <div className={s.card}><span className={s.muted}>Sent in 30 days</span><b className={s.big}>{totalSent}</b></div>
            <div className={s.card}><span className={s.muted}>Busiest day</span><b className={s.big}>{busiest.sent ? `${dayLabel(busiest.day)} · ${busiest.sent}` : "—"}</b></div>
            <div className={s.card}><span className={s.muted}>Blasts logged</span><b className={s.big}>{history.length}</b></div>
          </div>
          <section className={s.card} aria-labelledby="crm-blast-daily">
            <h3 id="crm-blast-daily">Emails sent per day</h3>
            <div style={{ height: 180 }}><MonthlyOpenChart counts={daily.map((item) => item.sent)} labels={daily.map((item) => dayLabel(item.day))} stepSize={0} /></div>
          </section>
          {history.length ? (
            <ul className={s.history}>
              {history.map((entry) => (
                <li key={entry.id}>
                  <span className={s.historyMain}>
                    <b>{entry.subject || "(no subject)"}</b>
                    <small>{String(entry.sent_at).slice(0, 16).replace("T", " ")} · segment {entry.segment || "all"} · {entry.source} · by {entry.actor_name || "—"}{entry.scheduled_at ? ` · scheduled ${String(entry.scheduled_at).slice(0, 16).replace("T", " ")}` : ""}</small>
                    {entry.errors?.length ? <small className={s.errorText}>{entry.errors.slice(0, 3).join(" · ")}</small> : null}
                  </span>
                  <span className={entry.failed_count ? s.historyFail : s.historyOk}>{entry.sent_count}/{entry.recipient_count} sent{entry.failed_count ? ` · ${entry.failed_count} failed` : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className={s.empty}>No email blasts sent yet.</p>}
        </div>
      ) : null}

      {tab === "settings" ? (
        <section className={`${s.card} ${s.settings}`} aria-labelledby="crm-blast-sender">
          <h3 id="crm-blast-sender">Sender</h3>
          <label className={s.field}><span>Sender name</span><input onChange={(event) => { setFromName(event.target.value); writeStore(FROM_NAME_KEY, event.target.value); }} value={fromName} /></label>
          <label className={s.field}><span>Sender email</span><input onChange={(event) => { setFromEmail(event.target.value); writeStore(FROM_EMAIL_KEY, event.target.value); }} placeholder="Leave empty to use the server default" type="email" value={fromEmail} /><small>Saved automatically on this device. The Resend API key stays on the server (RESEND_API_KEY) and never reaches the browser.</small></label>
        </section>
      ) : null}
    </div>
  );
}
