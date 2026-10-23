"use client";

import { createManagedRecord } from "@/app/actions/record-actions";
import type { RecordDefinitionKey } from "@/lib/records/catalog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../record-manager.module.css";

const modules = { ticket: { label: "Ticket", definition: "tickets", kind: "ticket" }, task: { label: "Program task", definition: "tasks", kind: "task" }, carousel: { label: "Carousel plan", definition: "carousel_plans", kind: "carousel" }, partnership: { label: "B2B partner", definition: "partners", kind: "partnership" } } as const;
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
    setBusy(true); setMessage("Reading…");
    try {
      const kind = module === "auto" ? "dashboard" : modules[module].kind;
      const response = await fetch("/api/ai/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, text: source }) });
      const result = await response.json() as { data?: Record<string, unknown>; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Tidak bisa memproses perintah.");
      if (module === "auto") {
        const aliases: Record<string, ModuleKey> = { ticket: "ticket", tickets: "ticket", task: "task", tasks: "task", carousel: "carousel", partnership: "partnership", b2b: "partnership" };
        const target = aliases[String(result.data.module || "").toLowerCase()];
        if (!target || !result.data.data || typeof result.data.data !== "object") throw new Error("The AI could not tell which module this belongs to. Try saying ticket, task or content plan.");
        setModule(target); setParsed(result.data.data as Record<string, unknown>);
      } else setParsed(result.data);
      setMessage("Cek field hasil ekstraksi sebelum menyimpan.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The AI could not read that. Try rephrasing it."); } finally { setBusy(false); }
  }
  async function save(formData: FormData) {
    if (module === "auto") return;
    setBusy(true); setMessage("");
    try { await createManagedRecord(modules[module].definition as RecordDefinitionKey, formData); setParsed(null); setSource(""); setMessage(`${modules[module].label} saved.`); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save."); } finally { setBusy(false); }
  }
  const label = module === "auto" ? "record" : modules[module].label.toLowerCase();
  return (
    <section className={styles.aiCommand}>
      <header style={{ cursor: "pointer" }} onClick={() => setOpen((v) => !v)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((v) => !v); }}>
        <div><i className="ti ti-sparkles" /><div><strong>Add with AI</strong><span>Paste a message; it becomes a ticket, task or plan you can review first.</span></div></div>
        <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
      </header>
      {open ? (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <select value={module} onChange={(event) => { setModule(event.target.value as ModuleSelection); setParsed(null); }}>
              <option value="auto">Detect automatically</option>
              {Object.entries(modules).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
            </select>
          </div>
          <div className={styles.aiCommandInput}>
            <textarea placeholder={`Type or paste the ${label} details, in Indonesian or English…`} value={source} onChange={(event) => setSource(event.target.value)} />
            <button className={styles.primaryButton} disabled={busy || !source.trim()} onClick={parse}><i className="ti ti-wand" /> Read text</button>
          </div>
          {parsed && module !== "auto" ? (
            <form action={save} className={styles.aiPreview}>
              {Object.entries(parsed).filter(([, fieldValue]) => fieldValue !== null && fieldValue !== undefined && fieldValue !== "").map(([key, fieldValue]) => (
                <label key={key}><span>{key.replaceAll("_", " ")}</span>{String(fieldValue).length > 80 ? <textarea name={key} value={value(fieldValue)} onChange={(event) => setParsed({ ...parsed, [key]: event.target.value })} /> : <input name={key} value={value(fieldValue)} onChange={(event) => setParsed({ ...parsed, [key]: event.target.value })} />}</label>
              ))}
              <button className={styles.primaryButton} disabled={busy}><i className="ti ti-device-floppy" /> Save {modules[module].label.toLowerCase()}</button>
            </form>
          ) : null}
          {message ? <p className={styles.formMessage}>{message}</p> : null}
        </>
      ) : null}
    </section>
  );
}
