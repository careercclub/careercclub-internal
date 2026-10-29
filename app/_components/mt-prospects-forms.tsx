"use client";

import { saveProspectAction, saveProspectContactAction } from "@/app/_actions/mt-prospect-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ImportSummary } from "@/lib/api/mt-prospects";
import { MONTHS, MONTHS_SHORT, STATUS_HELP, STATUS_LABEL, STATUSES, type ContactRow, type ProspectRow, type ProspectStatus } from "@/lib/mt-prospects/view";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { notify, notifyError } from "./app-dialog";
import s from "./mt-prospects.module.css";

/* ── Shared bits ── */

function FormDialog({ title, description, width = 560, children, footer, onClose }: { title: string; description: string; width?: number; children: ReactNode; footer: ReactNode; onClose: () => void }) {
  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose(); }} open>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0" showCloseButton={false} style={{ maxWidth: `min(${width}px, calc(100vw - 2rem))` }}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0"><DialogTitle className="text-base font-bold">{title}</DialogTitle><DialogDescription className="text-xs">{description}</DialogDescription></div>
          <button aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-[var(--bg)] hover:text-foreground" onClick={onClose} type="button"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={s.field} htmlFor={id}>
      <span>{label}{required ? <b aria-hidden="true" className={s.req}> *</b> : null}</span>
      {children}
      {error ? <small className={s.fieldError}>Fill in {label.toLowerCase()}.</small> : hint ? <small className={s.hint}>{hint}</small> : null}
    </label>
  );
}

function MonthPicker({ value, onChange, label }: { value: number[]; onChange: (months: number[]) => void; label: string }) {
  const toggle = (month: number) => onChange(value.includes(month) ? value.filter((item) => item !== month) : [...value, month].sort((a, b) => a - b));
  return <div aria-label={label} className={s.monthPicker} role="group">{MONTHS_SHORT.map((name, index) => <button aria-label={MONTHS[index]} aria-pressed={value.includes(index + 1)} key={name} onClick={() => toggle(index + 1)} type="button">{name}</button>)}</div>;
}

/** Focus the first invalid field of a form after the state that marks it has rendered. */
function focusFirst(form: HTMLFormElement | null) {
  window.requestAnimationFrame(() => form?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
}

/* ── Company ── */

type CompanyState = {
  brand: string; legal_name: string; status: ProspectStatus; industry: string; program: string;
  active_years: string; total_openings: string; usual_months: number[]; notes: string; exclusion_reason: string;
  openings: Record<string, { months: number[]; label: string; dates: string }>;
  prediction: { priority: string; estimate: string; approach: string; confidence: string };
};
const NEW_INDUSTRY = "__new__";

export function CompanyForm({ prospect, industries, year, onClose, onSaved }: { prospect: ProspectRow | null; industries: string[]; year: number; onClose: () => void; onSaved: (id: string | null) => void }) {
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const yearsShown = [...new Set([year, year - 1, year - 2, ...Object.keys(prospect?.openings || {}).map(Number)])].filter(Number.isFinite).sort((a, b) => b - a);
  const [form, setForm] = useState<CompanyState>(() => ({
    brand: prospect?.brand || "", legal_name: prospect?.legal_name || "", status: prospect?.status || "active", industry: prospect?.industry || "", program: prospect?.program || "",
    active_years: prospect?.active_years || "", total_openings: prospect?.total_openings === null || prospect?.total_openings === undefined ? "" : String(prospect.total_openings),
    usual_months: prospect?.usual_months || [], notes: prospect?.notes || "", exclusion_reason: prospect?.exclusion_reason || "",
    openings: Object.fromEntries(yearsShown.map((item) => [String(item), { months: prospect?.openings?.[String(item)]?.months || [], label: prospect?.openings?.[String(item)]?.label || "", dates: prospect?.openings?.[String(item)]?.dates || "" }])),
    prediction: { priority: prospect?.prediction?.priority || "", estimate: prospect?.prediction?.estimate || "", approach: prospect?.prediction?.approach || "", confidence: prospect?.prediction?.confidence || "" },
  }));
  const [newIndustry, setNewIndustry] = useState(Boolean(prospect?.industry && !industries.includes(prospect.industry)) || !industries.length);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<CompanyState>) => { setForm((current) => ({ ...current, ...patch })); setInvalid((current) => current.filter((key) => !(key in patch))); };
  const setOpening = (item: string, patch: Partial<CompanyState["openings"][string]>) => setForm((current) => ({ ...current, openings: { ...current.openings, [item]: { ...current.openings[item], ...patch } } }));
  const isNew = !prospect;
  const label = isNew ? "Add company" : "Save company";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = (["brand", "legal_name", "industry", "program"] as const).filter((key) => !form[key].trim());
    setInvalid(missing);
    if (missing.length) { focusFirst(formRef.current); return; }
    setSaving(true);
    try {
      // Emptying every prediction field clears the prediction; otherwise fields not on the form are kept.
      const prediction = Object.values(form.prediction).some((value) => value.trim()) ? { ...(prospect?.prediction || {}), ...form.prediction } : null;
      const result = await saveProspectAction(prospect?.id || null, { ...form, total_openings: form.total_openings, prediction });
      notify(isNew ? `${form.brand} added.` : "Company saved.");
      router.refresh();
      onSaved(isNew ? result.id : null);
    } catch (error) {
      notifyError(error, isNew ? "Could not add the company." : "Could not save the company.");
    } finally { setSaving(false); }
  }

  return (
    <FormDialog
      description={isNew ? "Fields marked * are required." : prospect?.source === "import" ? "From the Excel file. The next upload replaces edits made here." : "Added in the app · fields marked * are required."}
      footer={<><Button onClick={onClose} type="button" variant="outline">Cancel</Button><Button disabled={saving} form={`${id}-form`} type="submit">{saving ? "Saving…" : label}</Button></>}
      onClose={onClose}
      title={isNew ? "Add company" : `Edit ${prospect?.brand || prospect?.legal_name || "company"}`}
      width={640}
    >
      <form className={s.form} id={`${id}-form`} noValidate onSubmit={submit} ref={formRef}>
        <div className={s.grid2}>
          <Field error={invalid.includes("brand")} id={`${id}-brand`} label="Brand" required><input aria-invalid={invalid.includes("brand") || undefined} id={`${id}-brand`} onChange={(event) => set({ brand: event.target.value })} placeholder="e.g. Garudafood" required value={form.brand} /></Field>
          <Field error={invalid.includes("legal_name")} id={`${id}-legal`} label="Legal name" required><input aria-invalid={invalid.includes("legal_name") || undefined} id={`${id}-legal`} onChange={(event) => set({ legal_name: event.target.value })} placeholder="e.g. PT Garudafood Putra Putri Jaya Tbk" required value={form.legal_name} /></Field>
        </div>
        <div className={s.grid2}>
          <Field hint={STATUS_HELP[form.status]} id={`${id}-status`} label="Status" required><select id={`${id}-status`} onChange={(event) => set({ status: event.target.value as ProspectStatus })} required value={form.status}>{STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}</select></Field>
          <Field error={invalid.includes("industry")} id={`${id}-industry`} label="Industry" required>
            {newIndustry ? (
              <input aria-invalid={invalid.includes("industry") || undefined} id={`${id}-industry`} onChange={(event) => set({ industry: event.target.value })} placeholder="New industry" required value={form.industry} />
            ) : (
              <select aria-invalid={invalid.includes("industry") || undefined} id={`${id}-industry`} onChange={(event) => { if (event.target.value === NEW_INDUSTRY) { setNewIndustry(true); set({ industry: "" }); } else set({ industry: event.target.value }); }} required value={form.industry}>
                <option value="">Select industry</option>{industries.map((item) => <option key={item} value={item}>{item}</option>)}<option value={NEW_INDUSTRY}>New industry…</option>
              </select>
            )}
          </Field>
        </div>
        <Field error={invalid.includes("program")} hint="Programme name; add roles or variants on the next lines." id={`${id}-program`} label="Programme" required><textarea aria-invalid={invalid.includes("program") || undefined} id={`${id}-program`} onChange={(event) => set({ program: event.target.value })} placeholder="e.g. Management Trainee" required rows={3} value={form.program} /></Field>

        <details className={s.more} open={!isNew}>
          <summary>Opening months & more details <i className={`ti ti-chevron-down ${s.chevron}`} aria-hidden="true" /></summary>
          <div>
            {Object.keys(form.openings).sort().reverse().map((item) => (
              <div className={s.yearBlock} key={item}>
                <b>{item}</b>
                <MonthPicker label={`Months opened in ${item}`} onChange={(months) => setOpening(item, { months, label: months.length ? months.map((month) => MONTHS[month - 1]).join(", ") : "" })} value={form.openings[item].months} />
                <Field id={`${id}-dates-${item}`} label={`Dates in ${item}`}><textarea id={`${id}-dates-${item}`} onChange={(event) => setOpening(item, { dates: event.target.value })} placeholder="e.g. 8 May, closes 30 June" rows={2} value={form.openings[item].dates} /></Field>
              </div>
            ))}
            <div className={s.grid2}>
              <Field id={`${id}-years`} label="Years active"><input id={`${id}-years`} onChange={(event) => set({ active_years: event.target.value })} placeholder="e.g. 3 of 3" value={form.active_years} /></Field>
              <Field id={`${id}-total`} label="Openings recorded"><input id={`${id}-total`} inputMode="numeric" min={0} onChange={(event) => set({ total_openings: event.target.value.replace(/\D/g, "") })} value={form.total_openings} /></Field>
            </div>
            <div className={s.field}><span>Usually hires in</span><MonthPicker label="Usual months" onChange={(months) => set({ usual_months: months })} value={form.usual_months} /></div>
            {form.status === "predicted" || prospect?.prediction ? (
              <div className={s.grid2}>
                <Field id={`${id}-priority`} label="Priority"><input id={`${id}-priority`} onChange={(event) => setForm({ ...form, prediction: { ...form.prediction, priority: event.target.value } })} value={form.prediction.priority} /></Field>
                <Field id={`${id}-estimate`} label="Expected opening"><input id={`${id}-estimate`} onChange={(event) => setForm({ ...form, prediction: { ...form.prediction, estimate: event.target.value } })} value={form.prediction.estimate} /></Field>
                <Field id={`${id}-approach`} label="Suggested approach"><textarea id={`${id}-approach`} onChange={(event) => setForm({ ...form, prediction: { ...form.prediction, approach: event.target.value } })} rows={2} value={form.prediction.approach} /></Field>
                <Field id={`${id}-confidence`} label="Confidence"><input id={`${id}-confidence`} onChange={(event) => setForm({ ...form, prediction: { ...form.prediction, confidence: event.target.value } })} value={form.prediction.confidence} /></Field>
              </div>
            ) : null}
            {form.status === "excluded" ? <Field id={`${id}-reason`} label="Why it was taken off the list"><textarea id={`${id}-reason`} onChange={(event) => set({ exclusion_reason: event.target.value })} rows={2} value={form.exclusion_reason} /></Field> : null}
            <Field id={`${id}-notes`} label="Notes"><textarea id={`${id}-notes`} onChange={(event) => set({ notes: event.target.value })} rows={3} value={form.notes} /></Field>
          </div>
        </details>
      </form>
    </FormDialog>
  );
}

/* ── Contact ── */

export function ContactForm({ prospectId, companyName, contact, onClose }: { prospectId: string; companyName: string; contact: ContactRow | null; onClose: () => void }) {
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({ name: contact?.name || "", title: contact?.title || "", link: contact?.link || "" });
  const [invalid, setInvalid] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setInvalid((current) => current.filter((key) => !(key in patch))); };
  const isNew = !contact;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = (["name", "title", "link"] as const).filter((key) => !form[key].trim());
    setInvalid(missing);
    if (missing.length) { focusFirst(formRef.current); return; }
    setSaving(true);
    try {
      await saveProspectContactAction(prospectId, contact?.id || null, form);
      notify(isNew ? "Contact added." : "Contact saved.");
      router.refresh();
      onClose();
    } catch (error) { notifyError(error, isNew ? "Could not add the contact." : "Could not save the contact."); }
    finally { setSaving(false); }
  }

  return (
    <FormDialog
      description={contact?.source === "import" ? `${companyName} · from the Excel file. The next upload replaces edits made here.` : `${companyName} · fields marked * are required.`}
      footer={<><Button onClick={onClose} type="button" variant="outline">Cancel</Button><Button disabled={saving} form={`${id}-form`} type="submit">{saving ? "Saving…" : isNew ? "Add contact" : "Save contact"}</Button></>}
      onClose={onClose}
      title={isNew ? "Add contact" : `Edit ${contact?.name || "contact"}`}
    >
      <form className={s.form} id={`${id}-form`} noValidate onSubmit={submit} ref={formRef}>
        <Field error={invalid.includes("name")} id={`${id}-name`} label="Name" required><input aria-invalid={invalid.includes("name") || undefined} id={`${id}-name`} onChange={(event) => set({ name: event.target.value })} required value={form.name} /></Field>
        <Field error={invalid.includes("title")} id={`${id}-title`} label="Job title" required><input aria-invalid={invalid.includes("title") || undefined} id={`${id}-title`} onChange={(event) => set({ title: event.target.value })} placeholder="e.g. Talent Acquisition Lead" required value={form.title} /></Field>
        <Field error={invalid.includes("link")} id={`${id}-link`} label="LinkedIn or email" required><input aria-invalid={invalid.includes("link") || undefined} id={`${id}-link`} onChange={(event) => set({ link: event.target.value })} placeholder="https://linkedin.com/in/… or name@company.com" required value={form.link} /></Field>
      </form>
    </FormDialog>
  );
}

/* ── Import ── */

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState<"" | "checking" | "importing">("");
  const [error, setError] = useState("");
  // Only the latest chosen file's preview counts; an earlier, slower reply is ignored.
  const requestRef = useRef(0);

  async function send(mode: "preview" | "apply") {
    if (!file) return null;
    const body = new FormData(); body.set("file", file); body.set("mode", mode);
    const response = await fetch("/api/mt-prospects/import", { method: "POST", body });
    const result = await response.json().catch(() => ({})) as { summary?: ImportSummary; error?: string };
    if (!response.ok || !result.summary) throw new Error(result.error || "The file could not be read. Nothing was changed.");
    return result.summary;
  }

  function choose(next: File | null | undefined) {
    setSummary(null); setError("");
    if (!next) return;
    if (!/\.xlsx$/i.test(next.name)) { setFile(null); setError("Choose the MT list as an .xlsx file."); return; }
    setFile(next);
    setBusy("checking");
    const request = ++requestRef.current;
    const body = new FormData(); body.set("file", next); body.set("mode", "preview");
    fetch("/api/mt-prospects/import", { method: "POST", body })
      .then(async (response) => { const result = await response.json().catch(() => ({})) as { summary?: ImportSummary; error?: string }; if (!response.ok || !result.summary) throw new Error(result.error || "The file could not be read."); if (request === requestRef.current) setSummary(result.summary); })
      .catch((reason) => { if (request === requestRef.current) setError(reason instanceof Error ? reason.message : "The file could not be read."); })
      .finally(() => { if (request === requestRef.current) setBusy(""); });
  }

  async function apply() {
    setBusy("importing"); setError("");
    try {
      const result = await send("apply");
      const total = result ? result.companies.added + result.companies.updated : 0;
      notify(`MT list imported: ${total} companies.`);
      router.refresh();
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The import failed. Nothing was changed."); setBusy(""); }
  }

  const c = summary?.companies;
  return (
    <FormDialog
      description="Upload the “CCC List MT” workbook. You see what changes before anything is saved."
      footer={<><Button onClick={onClose} type="button" variant="outline">Cancel</Button><Button disabled={!summary || Boolean(busy)} onClick={apply} size="sm" type="button"><i aria-hidden="true" className="ti ti-file-spreadsheet" /> {busy === "importing" ? "Importing…" : "Import Excel"}</Button></>}
      onClose={onClose}
      title="Import Excel"
    >
      <div className={s.form}>
        <label className={s.dropZone} data-over={over} htmlFor={inputId} onDragLeave={() => setOver(false)} onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDrop={(event) => { event.preventDefault(); setOver(false); choose(event.dataTransfer.files?.[0]); }}>
          <i className="ti ti-file-spreadsheet" aria-hidden="true" />
          <b>{file ? file.name : "Choose or drop the .xlsx file"}</b>
          <span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · choose again to replace` : "Sheets read: Aktif, Pernah Buka, Lama, Prediksi, Kontak HR, Syarat Gabungan, Update Tgl & Status, Tahapan Tambahan"}</span>
          <input accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" id={inputId} onChange={(event) => choose(event.target.files?.[0])} type="file" />
        </label>
        {busy === "checking" ? <p className={s.loading} role="status">Reading the file…</p> : null}
        {error ? <p className={s.fieldError} role="alert">{error}</p> : null}
        {summary && c ? (
          <>
            <table className={s.summaryTable}>
              <tbody>
                <tr><th scope="row">Companies</th><td>{c.added + c.updated} in the file · {c.added} new · {c.updated} updated{c.removed ? ` · ${c.removed} removed (no longer in the file)` : ""}</td></tr>
                {c.keptFromApp ? <tr><th scope="row">Added in the app</th><td>{c.keptFromApp} kept as they are</td></tr> : null}
                {c.keptForAppContacts ? <tr><th scope="row">Kept for their contacts</th><td>{c.keptForAppContacts} no longer in the file but holding contacts added in the app, kept as app companies</td></tr> : null}
                <tr><th scope="row">HR contacts</th><td>{summary.contacts.toLocaleString("en-US")} (replace those from the last file; contacts added in the app stay)</td></tr>
                <tr><th scope="row">Requirements</th><td>{summary.research.requirement}</td></tr>
                <tr><th scope="row">Dates & status updates</th><td>{summary.research.update}</td></tr>
                <tr><th scope="row">Selection steps</th><td>{summary.research.steps}</td></tr>
                {summary.unmatched.length ? (
                  <tr><th scope="row">Not matched</th><td>{summary.unmatched.length === 1 ? "1 row names a company that is not in the company sheets and is skipped." : `${summary.unmatched.length} rows name a company that is not in the company sheets and are skipped.`}
                    <details><summary className={s.linkButton}>Show rows</summary><ul className={s.unmatched}>{summary.unmatched.slice(0, 50).map((item) => <li key={`${item.sheet}-${item.row}`}>{item.sheet}, row {item.row}: {item.label}</li>)}</ul></details>
                  </td></tr>
                ) : null}
              </tbody>
            </table>
            {summary.sameNameAsApp.length ? <p className={s.sourceNote}><i className="ti ti-info-circle" aria-hidden="true" />Also in the file, so they will show twice: {summary.sameNameAsApp.join(", ")}. Delete the copy added in the app after importing.</p> : null}
            {c.updated ? <p className={s.sourceNote}><i className="ti ti-info-circle" aria-hidden="true" />Edits made in the app to companies from the file are replaced by the file.</p> : null}
          </>
        ) : null}
      </div>
    </FormDialog>
  );
}

