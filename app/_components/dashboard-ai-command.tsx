"use client";

import { createManagedRecord } from "@/app/actions/record-actions";
import type { RecordDefinitionKey } from "@/lib/records/catalog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../record-manager.module.css";

const modules = { ticket: { label: "Ticket", definition: "tickets", kind: "ticket" }, task: { label: "Program task", definition: "tasks", kind: "task" }, carousel: { label: "Carousel plan", definition: "carousel_plans", kind: "carousel" }, voucher: { label: "Voucher", definition: "vouchers", kind: "voucher" }, partnership: { label: "B2B partner", definition: "partners", kind: "partnership" } } as const;
type ModuleKey = keyof typeof modules;
type ModuleSelection = ModuleKey | "auto";
function value(input: unknown) { if (input === null || input === undefined) return ""; return typeof input === "object" ? JSON.stringify(input) : String(input); }

export function DashboardAiCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [module, setModule] = useState<ModuleSelection>("auto");
  const [source, setSource] = useState("");
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function parse() {
    setBusy(true); setMessage("Memproses...");
    try {
      const kind = module === "auto" ? "dashboard" : modules[module].kind;
      const response = await fetch("/api/ai/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, text: source }) });
      const result = await response.json() as { data?: Record<string, unknown>; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Tidak bisa memproses perintah.");
      if (module === "auto") {
        const aliases: Record<string, ModuleKey> = { ticket: "ticket", tickets: "ticket", task: "task", tasks: "task", carousel: "carousel", voucher: "voucher", partnership: "partnership", b2b: "partnership" };
        const target = aliases[String(result.data.module || "").toLowerCase()];
        if (!target || !result.data.data || typeof result.data.data !== "object") throw new Error("AI tidak menemukan modul tujuan yang didukung.");
        setModule(target); setParsed(result.data.data as Record<string, unknown>);
      } else setParsed(result.data);
      setMessage("Cek field hasil ekstraksi sebelum menyimpan.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Gagal memproses dengan AI."); } finally { setBusy(false); }
  }
  async function save(formData: FormData) {
    if (module === "auto") return;
    setBusy(true); setMessage("");
    try { await createManagedRecord(modules[module].definition as RecordDefinitionKey, formData); setParsed(null); setSource(""); setMessage(`${modules[module].label} tersimpan.`); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Record tidak bisa disimpan."); } finally { setBusy(false); }
  }
  const label = module === "auto" ? "record" : modules[module].label.toLowerCase();
  return (
    <section className={styles.aiCommand}>
      <header style={{ cursor: "pointer" }} onClick={() => setOpen((v) => !v)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((v) => !v); }}>
        <div><i className="ti ti-sparkles" /><div><strong>Input dengan AI</strong><span>Ubah teks operasional jadi record database yang bisa direview.</span></div></div>
        <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
      </header>
      {open ? (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <select value={module} onChange={(event) => { setModule(event.target.value as ModuleSelection); setParsed(null); }}>
              <option value="auto">Deteksi otomatis</option>
              {Object.entries(modules).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
            </select>
          </div>
          <div className={styles.aiCommandInput}>
            <textarea placeholder={`Tulis ${label} dalam Bahasa Indonesia atau Inggris...`} value={source} onChange={(event) => setSource(event.target.value)} />
            <button className={styles.primaryButton} disabled={busy || !source.trim()} onClick={parse}><i className="ti ti-wand" /> Parse</button>
          </div>
          {parsed && module !== "auto" ? (
            <form action={save} className={styles.aiPreview}>
              {Object.entries(parsed).filter(([, fieldValue]) => fieldValue !== null && fieldValue !== undefined && fieldValue !== "").map(([key, fieldValue]) => (
                <label key={key}><span>{key.replaceAll("_", " ")}</span>{String(fieldValue).length > 80 ? <textarea name={key} value={value(fieldValue)} onChange={(event) => setParsed({ ...parsed, [key]: event.target.value })} /> : <input name={key} value={value(fieldValue)} onChange={(event) => setParsed({ ...parsed, [key]: event.target.value })} />}</label>
              ))}
              <button className={styles.primaryButton} disabled={busy}><i className="ti ti-device-floppy" /> Simpan {modules[module].label}</button>
            </form>
          ) : null}
          {message ? <p className={styles.formMessage}>{message}</p> : null}
        </>
      ) : null}
    </section>
  );
}
