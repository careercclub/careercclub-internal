"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type Template = { name: string; subject: string; headerTitle: string; headerSub: string; headerColor: string; body: string; ctaText: string; ctaUrl: string; footer: string };
type Log = { subject: string; total: number; sent: number; failed: number; sentAt: string };
type BlastTab = "compose" | "templates" | "history" | "settings";

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function isBuyer(row: ApiRecord) { return Boolean(row.buyer_match) || Boolean(text(row.produk_dibeli)); }
function escapeHtml(value: string) { return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] || character); }
function options(rows: ApiRecord[], field: string) { return [...new Set(rows.map((row) => text(row[field]).trim()).filter(Boolean))].sort(); }

const card: CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "14px 16px" };
const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 };
const label: CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 };
const microLabel: CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--text-hint)", display: "block", marginBottom: 4 };
const input: CSSProperties = { width: "100%", padding: "7px 10px", border: "0.5px solid var(--border-md)", borderRadius: "var(--radius)", fontSize: 12, background: "var(--white)", color: "var(--text)", outline: "none" };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 12px", borderRadius: "var(--radius)", border: "0.5px solid var(--border-md)", background: "var(--white)", color: "var(--text)", fontSize: 11, fontWeight: 500, cursor: "pointer" };
const btnPrimary: CSSProperties = { ...btn, background: "var(--purple-mid)", borderColor: "var(--purple-mid)", color: "#fff" };

export function TalentPoolTools({ rows }: { rows: ApiRecord[] }) {
  const [tab, setTab] = useState<BlastTab>("compose");
  const [segment, setSegment] = useState("all");
  const [cStatus, setCStatus] = useState("");
  const [cSumber, setCSumber] = useState("");
  const [cTier, setCTier] = useState("");
  const [subject, setSubject] = useState("");
  const [headerTitle, setHeaderTitle] = useState("CareerCclub");
  const [headerSub, setHeaderSub] = useState("");
  const [headerColor, setHeaderColor] = useState("#2e2a7a");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [footer, setFooter] = useState("© 2026 CareerCclub | careercclub.com");
  const [schedule, setSchedule] = useState("");
  const [fromName, setFromName] = useState("CareerCclub");
  const [fromEmail, setFromEmail] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      setTemplates(JSON.parse(localStorage.getItem("ccc_tp_blast_templates") || "[]") as Template[]);
      setLogs(JSON.parse(localStorage.getItem("ccc_tp_blast_logs") || "[]") as Log[]);
      setFromName(localStorage.getItem("ccc_blast_from_name") || "CareerCclub");
      setFromEmail(localStorage.getItem("ccc_blast_from_email") || "");
    } catch { /* ignore unreadable storage */ }
  }, []);

  const statusOptions = useMemo(() => options(rows, "status"), [rows]);
  const sumberOptions = useMemo(() => options(rows, "sumber"), [rows]);
  const tierOptions = useMemo(() => options(rows, "campus_tier"), [rows]);

  const recipients = useMemo(() => {
    let list = rows.filter((row) => text(row.email).includes("@"));
    if (segment === "beli") list = list.filter(isBuyer);
    else if (segment === "belum") list = list.filter((row) => !isBuyer(row));
    else if (segment === "custom") {
      if (cStatus) list = list.filter((row) => text(row.status) === cStatus);
      if (cSumber) list = list.filter((row) => text(row.sumber) === cSumber);
      if (cTier) list = list.filter((row) => text(row.campus_tier) === cTier);
    }
    return list;
  }, [rows, segment, cStatus, cSumber, cTier]);

  function buildHtml(preview = false) {
    const nama = (value: string) => (preview ? value.replaceAll("{nama}", "Kak Sample") : value);
    const safeBody = nama(escapeHtml(body).replace(/\n/g, "<br>")) || "<span style=\"color:#888\">(isi email kosong)</span>";
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

  function preview() {
    const win = window.open("", "_blank");
    if (!win) { setMessage("Popup diblokir — izinkan popup untuk preview."); return; }
    win.document.write(buildHtml(true));
    win.document.close();
  }

  function applyTemplate(template: Template) {
    setSubject(template.subject); setHeaderTitle(template.headerTitle); setHeaderSub(template.headerSub);
    setHeaderColor(template.headerColor || "#2e2a7a"); setBody(template.body); setCtaText(template.ctaText);
    setCtaUrl(template.ctaUrl); setFooter(template.footer || "© 2026 CareerCclub | careercclub.com");
    setMessage(`Template "${template.name}" dimuat.`);
  }

  function saveTemplate() {
    const name = window.prompt("Nama template:");
    if (!name?.trim()) return;
    const next = [...templates, { name: name.trim(), subject, headerTitle, headerSub, headerColor, body, ctaText, ctaUrl, footer }];
    setTemplates(next); localStorage.setItem("ccc_tp_blast_templates", JSON.stringify(next)); setMessage(`Template "${name.trim()}" disimpan.`);
  }

  function deleteTemplate(index: number) {
    const next = templates.filter((_, itemIndex) => itemIndex !== index);
    setTemplates(next); localStorage.setItem("ccc_tp_blast_templates", JSON.stringify(next));
  }

  function saveSettings() {
    localStorage.setItem("ccc_blast_from_name", fromName || "CareerCclub");
    if (fromEmail) localStorage.setItem("ccc_blast_from_email", fromEmail); else localStorage.removeItem("ccc_blast_from_email");
    setMessage("Pengaturan pengirim tersimpan di device ini. RESEND_API_KEY tetap di server.");
  }

  async function send() {
    if (!subject.trim()) { setMessage("Subject wajib diisi."); return; }
    if (!body.trim()) { setMessage("Isi email tidak boleh kosong."); return; }
    const list = recipients.map((row) => ({ email: text(row.email), name: text(row.nama) })).filter((recipient) => recipient.email);
    if (!list.length) { setMessage("Tidak ada penerima dengan email valid."); return; }
    if (schedule && !Number.isFinite(new Date(schedule).getTime())) { setMessage("Jadwal kirim tidak valid."); return; }
    if (!window.confirm(`Kirim ke ${list.length} penerima?${schedule ? ` Dijadwalkan: ${schedule}` : " Email dikirim sekarang."}`)) return;

    setBusy(true); setMessage("Mengirim... mohon tunggu.");
    const html = buildHtml();
    const scheduledAt = schedule ? new Date(schedule).toISOString() : undefined;
    let sent = 0; let failed = 0;
    try {
      for (let offset = 0; offset < list.length; offset += 100) {
        const response = await fetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: list.slice(offset, offset + 100), subject, from_name: fromName, from_email: fromEmail || undefined, scheduled_at: scheduledAt, html, source: "talent-pool" }) });
        const result = await response.json() as { sent?: number; failed?: number; error?: string };
        if (!response.ok) throw new Error(result.error || "Blast gagal.");
        sent += result.sent || 0; failed += result.failed || 0;
      }
      const nextLogs = [{ subject, total: list.length, sent, failed, sentAt: scheduledAt || new Date().toISOString() }, ...logs].slice(0, 100);
      setLogs(nextLogs); localStorage.setItem("ccc_tp_blast_logs", JSON.stringify(nextLogs));
      setMessage(`${schedule ? "Dijadwalkan" : "Terkirim"} ${sent}; gagal ${failed}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Blast gagal."); }
    finally { setBusy(false); }
  }

  const tabs: Array<[BlastTab, string, string]> = [["compose", "ti-send", "Compose & Kirim"], ["templates", "ti-bookmark", "Templates"], ["history", "ti-history", "History"], ["settings", "ti-settings", "Settings"]];

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", gap: 2, borderBottom: "0.5px solid var(--border)", marginBottom: 16, overflowX: "auto" }}>
        {tabs.map(([key, icon, labelText]) => (
          <button key={key} onClick={() => setTab(key)} type="button" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", fontSize: 12, fontWeight: tab === key ? 600 : 500, color: tab === key ? "var(--purple-mid)" : "var(--text-muted)", background: "none", border: "none", borderBottom: `2px solid ${tab === key ? "var(--purple-mid)" : "transparent"}`, cursor: "pointer", whiteSpace: "nowrap" }}>
            <i className={`ti ${icon}`} /> {labelText}
          </button>
        ))}
      </div>

      {tab === "compose" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={card}>
              <div style={sectionTitle}><i className="ti ti-filter" style={{ color: "var(--purple-accent)" }} /> Target Penerima</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={label}>SEGMENT</label>
                  <select onChange={(event) => setSegment(event.target.value)} style={input} value={segment}>
                    <option value="all">Semua kontak dengan email</option>
                    <option value="beli">Sudah Beli</option>
                    <option value="belum">Belum Beli</option>
                    <option value="custom">Filter kustom...</option>
                  </select>
                </div>
                {segment === "custom" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <select onChange={(event) => setCStatus(event.target.value)} style={input} value={cStatus}><option value="">Semua status</option>{statusOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                    <select onChange={(event) => setCSumber(event.target.value)} style={input} value={cSumber}><option value="">Semua sumber</option>{sumberOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                    <select onChange={(event) => setCTier(event.target.value)} style={input} value={cTier}><option value="">Semua tier</option>{tierOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                  </div>
                ) : null}
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--purple-accent)", padding: "7px 10px", background: "var(--purple-light)", borderRadius: "var(--radius)" }}>
                  <i className="ti ti-users" /> {recipients.length} penerima
                </div>
              </div>
            </div>

            <div style={card}>
              <div style={sectionTitle}><i className="ti ti-mail" style={{ color: "var(--purple-accent)" }} /> Detail Email</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div><label style={label}>SUBJECT</label><input onChange={(event) => setSubject(event.target.value)} placeholder="Subject email..." style={input} value={subject} /></div>
                <div>
                  <label style={label}>TEMPLATE (opsional)</label>
                  <select onChange={(event) => { const template = templates[Number(event.target.value)]; if (template) applyTemplate(template); }} style={input} value="">
                    <option value="">— Pilih template —</option>
                    {templates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}
                  </select>
                </div>
                <div><label style={label}>JADWAL KIRIM (opsional)</label><input onChange={(event) => setSchedule(event.target.value)} type="datetime-local" style={input} value={schedule} /><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Kosongkan untuk kirim sekarang</div></div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ ...sectionTitle, justifyContent: "space-between" }}>
                <span><i className="ti ti-pencil" style={{ color: "var(--purple-accent)" }} /> Email Builder</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button onClick={preview} style={btn} type="button"><i className="ti ti-eye" /> Preview</button>
                  <button onClick={saveTemplate} style={btn} type="button"><i className="ti ti-bookmark" /> Simpan Template</button>
                </span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={microLabel}>HEADER</label>
                <input onChange={(event) => setHeaderTitle(event.target.value)} placeholder="Judul header email..." style={{ ...input, marginBottom: 5 }} value={headerTitle} />
                <input onChange={(event) => setHeaderSub(event.target.value)} placeholder="Subtitle (opsional)..." style={input} value={headerSub} />
                <div style={{ display: "flex", gap: 6, marginTop: 5, alignItems: "center" }}>
                  <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Warna header:</label>
                  <input onChange={(event) => setHeaderColor(event.target.value)} type="color" value={headerColor} style={{ width: 32, height: 28, border: "0.5px solid var(--border-md)", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={microLabel}>ISI EMAIL</label>
                <textarea onChange={(event) => setBody(event.target.value)} placeholder="Tulis isi email... Gunakan {nama} untuk personalisasi." rows={7} style={{ ...input, resize: "vertical", lineHeight: 1.6 }} value={body} />
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 5 }}>Tip: gunakan <code style={{ background: "var(--bg)", padding: "1px 4px", borderRadius: 3 }}>{"{nama}"}</code> untuk personalisasi otomatis per penerima.</div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={microLabel}>TOMBOL CTA (opsional)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <input onChange={(event) => setCtaText(event.target.value)} placeholder="Teks tombol" style={input} value={ctaText} />
                  <input onChange={(event) => setCtaUrl(event.target.value)} placeholder="https://..." style={input} value={ctaUrl} />
                </div>
              </div>
              <div>
                <label style={microLabel}>FOOTER</label>
                <input onChange={(event) => setFooter(event.target.value)} style={input} value={footer} />
              </div>
            </div>
            <button onClick={send} disabled={busy} style={{ ...btnPrimary, width: "100%", padding: 11, fontSize: 13, fontWeight: 600, opacity: busy ? 0.6 : 1 }} type="button">
              <i className="ti ti-send" /> {busy ? "Mengirim..." : "Kirim Email Blast"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "templates" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
          {!templates.length ? <div style={{ ...card, gridColumn: "1/-1", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Belum ada template. Simpan dari tab Compose.</div> : templates.map((template, index) => (
            <div style={card} key={`${template.name}-${index}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 13 }}>{template.name}</strong>
                <button onClick={() => deleteTemplate(index)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }} type="button"><i className="ti ti-trash" /></button>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--text-muted)" }}>{template.subject || "(tanpa subject)"}</p>
              <button onClick={() => { applyTemplate(template); setTab("compose"); }} style={btn} type="button"><i className="ti ti-arrow-right" /> Gunakan</button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "history" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!logs.length ? <div style={{ ...card, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Belum ada riwayat blast.</div> : logs.map((log, index) => (
            <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }} key={`${log.sentAt}-${index}`}>
              <div style={{ minWidth: 0 }}><strong style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.subject || "(tanpa subject)"}</strong><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(log.sentAt).toLocaleString("id-ID")}</span></div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{log.sent}/{log.total} terkirim · {log.failed} gagal</span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "settings" ? (
        <div style={{ ...card, maxWidth: 460 }}>
          <div style={sectionTitle}><i className="ti ti-settings" style={{ color: "var(--purple-accent)" }} /> Pengaturan Pengirim</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div><label style={label}>NAMA PENGIRIM</label><input onChange={(event) => setFromName(event.target.value)} style={input} value={fromName} /></div>
            <div><label style={label}>EMAIL PENGIRIM</label><input onChange={(event) => setFromEmail(event.target.value)} placeholder="blast@domainmu.com" type="email" style={input} value={fromEmail} /><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Harus domain terverifikasi di Resend. Kosongkan untuk pakai default server.</div></div>
            <button onClick={saveSettings} style={btnPrimary} type="button"><i className="ti ti-device-floppy" /> Simpan Pengaturan</button>
          </div>
        </div>
      ) : null}

      {message ? <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }} role="status">{message}</p> : null}
    </div>
  );
}
