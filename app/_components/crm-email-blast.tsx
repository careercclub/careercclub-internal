"use client";

import { bulkUpdateCrmBuyers } from "@/app/actions/crm-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import type { DailyBlastCount, EmailBlastRecord } from "@/lib/api/email-blast";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MonthlyOpenChart } from "./charts";
import styles from "./crm.module.css";

type BlastTab = "compose" | "templates" | "history" | "settings";
type Segment = "all" | "has_email" | "belum_diblast" | "custom";
type Template = { name: string; subject: string; body: string };

const SEGMENT_LABELS: Array<[Segment, string]> = [
  ["all", "Semua kontak"],
  ["has_email", "Punya email saja"],
  ["belum_diblast", "Belum pernah diblast"],
  ["custom", "Filter kustom…"],
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
function unique(rows: ApiRecord[], field: string) {
  return [...new Set(rows.map((row) => text(row[field])).filter(Boolean))].sort();
}
function escapeHtml(value: string) {
  return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] || character);
}
function dayLabel(day: string) { const [, month, date] = day.split("-"); return `${Number(date)}/${Number(month)}`; }

export function CrmEmailBlast({ rows, history, daily }: { rows: ApiRecord[]; history: EmailBlastRecord[]; daily: DailyBlastCount[] }) {
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
    if (!subject.trim()) return setMessage("Subject wajib diisi.");
    if (!body.trim()) return setMessage("Isi email tidak boleh kosong.");
    if (!recipients.length) return setMessage("Tidak ada penerima yang valid (cek segment & pastikan ada email).");
    // Resend caps a request at 100 recipients, so send in batches of 100.
    const batches: ApiRecord[][] = [];
    for (let index = 0; index < recipients.length; index += 100) batches.push(recipients.slice(index, index + 100));
    if (!window.confirm(`Kirim ke ${recipients.length} penerima?${schedule ? `\nDijadwalkan: ${schedule}` : "\nEmail akan dikirim sekarang."}`)) return;

    setMessage(`Mengirim ke ${recipients.length} penerima…`);
    let sent = 0;
    let failed = 0;
    for (const batch of batches) {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: batch.map((row) => ({ email: text(row.email), name: text(row.name) })),
          subject,
          html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>`,
          from_name: fromName || undefined,
          from_email: fromEmail || undefined,
          scheduled_at: schedule ? new Date(schedule).toISOString() : undefined,
          source: "crm",
          segment: segment === "custom" ? `custom:${[klasifikasi, industri, tahap].filter(Boolean).join("/") || "all"}` : segment,
        }),
      });
      const result = await response.json() as { sent?: number; failed?: number; error?: string };
      if (!response.ok) { setMessage(result.error || "Email blast gagal."); return; }
      sent += result.sent || 0;
      failed += result.failed || 0;
    }

    // Legacy marks recipients as blasted, but only for an immediate send.
    if (!schedule && sent) {
      const ids = recipients.flatMap((row) => (Array.isArray(row.ids) ? row.ids.map(String) : [String(row.id)]));
      try { await bulkUpdateCrmBuyers(ids, "status", "Diblast"); } catch { /* status is a convenience, not the send */ }
    }
    setMessage(`Selesai. ${sent} terkirim${failed ? `, ${failed} gagal` : ""}.`);
    setTab("history");
    router.refresh();
  }

  function saveTemplate() {
    const name = window.prompt("Nama template:")?.trim();
    if (!name) return;
    const next = [...templates.filter((template) => template.name !== name), { name, subject, body }];
    setTemplates(next);
    writeStore(TEMPLATE_KEY, next);
    setMessage(`Template "${name}" disimpan.`);
  }

  const totalSent = daily.reduce((sum, item) => sum + item.sent, 0);
  const busiest = daily.reduce((best, item) => (item.sent > best.sent ? item : best), { day: "", sent: 0 });

  return (
    <div className={styles.blastPanel}>
      <nav className={styles.tabRow}>
        {([["compose", "ti-send", "Compose & Kirim"], ["templates", "ti-bookmark", "Templates"], ["history", "ti-history", "History"], ["settings", "ti-settings", "Settings"]] as const).map(([id, icon, label]) => (
          <button className={tab === id ? `${styles.tab} ${styles.tabActive}` : styles.tab} key={id} onClick={() => setTab(id)} type="button">
            <i className={`ti ${icon}`} style={{ fontSize: 12 }} /> {label}
          </button>
        ))}
      </nav>

      {message ? <p className={styles.rowCount}>{message}</p> : null}

      {tab === "compose" ? (
        <div className={styles.blastForm}>
          <label>
            <span>Segment</span>
            <select onChange={(event) => setSegment(event.target.value as Segment)} value={segment}>
              {SEGMENT_LABELS.map(([value, label]) => <option key={value} value={value}>{label}{value === "all" ? ` (${rows.length})` : ""}</option>)}
            </select>
          </label>

          {segment === "custom" ? (
            <>
              <label><span>Klasifikasi</span><select onChange={(event) => setKlasifikasi(event.target.value)} value={klasifikasi}><option value="">Semua klasifikasi</option>{unique(rows, "klasifikasi").map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Industri</span><select onChange={(event) => setIndustri(event.target.value)} value={industri}><option value="">Semua industri</option>{unique(rows, "industri").map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Tahap</span><select onChange={(event) => setTahap(event.target.value)} value={tahap}><option value="">Semua tahap</option>{unique(rows, "tahap").map((value) => <option key={value}>{value}</option>)}</select></label>
            </>
          ) : null}

          <p className={styles.rowCount}><i className="ti ti-users" /> {recipients.length} penerima · gunakan <code>{"{nama}"}</code> untuk personalisasi</p>

          <label><span>Subject</span><input onChange={(event) => setSubject(event.target.value)} value={subject} /></label>
          <label><span>Jadwal kirim (opsional)</span><input onChange={(event) => setSchedule(event.target.value)} type="datetime-local" value={schedule} /></label>
          <label><span>Isi email</span><textarea onChange={(event) => setBody(event.target.value)} rows={10} value={body} /></label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={pending} onClick={() => start(() => { void send(); })} type="button">
              <i className="ti ti-send" /> {schedule ? "Jadwalkan" : "Kirim sekarang"}
            </button>
            <button className={styles.btn} onClick={saveTemplate} type="button"><i className="ti ti-bookmark" /> Simpan sebagai template</button>
          </div>
        </div>
      ) : null}

      {tab === "templates" ? (
        <div className={styles.blastForm}>
          {templates.length ? templates.map((template) => (
            <div key={template.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "0.5px solid var(--border)" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ fontSize: 12 }}>{template.name}</strong>
                <p className={styles.rowCount} style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{template.subject || "(tanpa subject)"}</p>
              </div>
              <button className={styles.btn} onClick={() => { setSubject(template.subject); setBody(template.body); setTab("compose"); }} type="button">Pakai</button>
              <button className={styles.btn} onClick={() => { const next = templates.filter((item) => item.name !== template.name); setTemplates(next); writeStore(TEMPLATE_KEY, next); }} style={{ color: "var(--red)" }} type="button"><i className="ti ti-trash" /></button>
            </div>
          )) : <p className={styles.rowCount}>Belum ada template. Simpan satu dari tab Compose.</p>}
        </div>
      ) : null}

      {tab === "history" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div className={styles.statsGrid} style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className={styles.statCard}><div className={styles.statLabel}>Terkirim 30 hari</div><div className={styles.statVal}>{totalSent}</div></div>
            <div className={styles.statCard}><div className={styles.statLabel}>Hari tersibuk</div><div className={styles.statVal} style={{ fontSize: 13 }}>{busiest.sent ? `${dayLabel(busiest.day)} · ${busiest.sent}` : "—"}</div></div>
            <div className={styles.statCard}><div className={styles.statLabel}>Blast tercatat</div><div className={styles.statVal}>{history.length}</div></div>
          </div>

          <section>
            <h3 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>Email terkirim per hari</h3>
            <div style={{ height: 180 }}>
              <MonthlyOpenChart counts={daily.map((item) => item.sent)} labels={daily.map((item) => dayLabel(item.day))} stepSize={0} />
            </div>
          </section>

          {history.length ? history.map((entry) => (
            <div key={entry.id} style={{ padding: "8px 0", borderBottom: "0.5px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 12 }}>{entry.subject || "(tanpa subject)"}</strong>
                <span className={styles.rowCount}>{String(entry.sent_at).slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className={styles.rowCount} style={{ margin: 0 }}>
                {entry.sent_count}/{entry.recipient_count} terkirim{entry.failed_count ? ` · ${entry.failed_count} gagal` : ""} · segment {entry.segment || "all"} · {entry.source} · oleh {entry.actor_name || "—"}
                {entry.scheduled_at ? ` · dijadwalkan ${String(entry.scheduled_at).slice(0, 16).replace("T", " ")}` : ""}
              </p>
              {entry.errors?.length ? <p className={styles.rowCount} style={{ margin: 0, color: "var(--red)" }}>{entry.errors.slice(0, 3).join(" · ")}</p> : null}
            </div>
          )) : <p className={styles.rowCount}>Belum ada riwayat blast.</p>}
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className={styles.blastForm}>
          <label><span>From name</span><input onChange={(event) => { setFromName(event.target.value); writeStore(FROM_NAME_KEY, event.target.value); }} value={fromName} /></label>
          <label><span>From email</span><input onChange={(event) => { setFromEmail(event.target.value); writeStore(FROM_EMAIL_KEY, event.target.value); }} placeholder="kosongkan untuk memakai default server" value={fromEmail} /></label>
          <p className={styles.rowCount}>
            API key Resend disimpan di server sebagai <code>RESEND_API_KEY</code> dan tidak pernah dikirim ke browser.
          </p>
        </div>
      ) : null}
    </div>
  );
}
