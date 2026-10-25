"use client";

import { deleteProspectAction, deleteProspectContactAction, loadProspectResearchAction } from "@/app/actions/mt-prospect-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ResearchRow } from "@/lib/api/mt-prospects";
import {
  activeYearsLabel, displayName, initials, isMissing, isPerson, linkHref, linkKind, monthList, shortLegalName, splitSteps, STATUS_HELP, STATUS_LABEL,
  type ContactRow, type ProspectRow,
} from "@/lib/mt-prospects/view";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { confirmAction, notify } from "./app-dialog";
import { ContactForm } from "./mt-prospects-forms";
import s from "./mt-prospects.module.css";
import { guard } from "./safe-action";
import { formatDay } from "@/lib/text/date";

const REQUIREMENT_FIELDS: Array<[string, string]> = [
  ["roles", "Roles"], ["education", "Education"], ["gpa", "GPA"], ["majors", "Majors"], ["placement", "Placement"], ["requirements", "Other requirements"],
  ["selectionSteps", "Selection steps"], ["duration", "Duration"], ["openMonth", "Opening month"], ["sourceLinks", "Sources"], ["notes", "Notes"],
];

/** Text with its web links made clickable. */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s;,)]+)/g);
  return <>{parts.map((part, index) => (/^https?:\/\//.test(part) ? <a href={part} key={index} rel="noopener noreferrer" target="_blank">{part.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}{part.length > 70 ? "…" : ""}</a> : part))}</>;
}

function Value({ value }: { value?: string }) {
  if (isMissing(value)) return <span className={s.missing}>Not found</span>;
  const steps = splitSteps(value || "");
  if (steps.length) return <ol className={s.steps}>{steps.map((step, index) => <li key={index}><span>{step}</span></li>)}</ol>;
  return <Linked text={value || ""} />;
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className={s.section}><div className={s.sectionHead}><h3>{title}</h3>{action}</div>{children}</section>;
}

export function ProspectDetail({ prospect, contacts, year, onClose, onEdit }: { prospect: ProspectRow; contacts: ContactRow[]; year: number; onClose: () => void; onEdit: () => void }) {
  const router = useRouter();
  const [research, setResearch] = useState<ResearchRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [contactForm, setContactForm] = useState<{ contact: ContactRow | null } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    loadProspectResearchAction(prospect.id).then((rows) => { if (live) setResearch(rows); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [prospect.id]);

  const name = displayName(prospect);
  const years = Object.keys(prospect.openings || {}).sort().reverse();
  const people = contacts.filter(isPerson);
  const inboxes = contacts.filter((contact) => !isPerson(contact));
  // Notes Claude added (Settings → Claude access) have their own shape: date, note, source.
  const claudeNotes = research?.filter((row) => row.origin === "Claude") || [];
  const updates = research?.filter((row) => row.kind === "update" && row.origin !== "Claude") || [];
  const requirements = research?.filter((row) => row.kind === "requirement" && row.origin !== "Claude") || [];
  const steps = research?.filter((row) => row.kind === "steps" && row.origin !== "Claude") || [];
  const prediction = prospect.prediction;

  async function removeCompany() {
    if (!(await confirmAction({ title: `Delete ${name}?`, message: "Its HR contacts, requirements and updates are deleted too. A company from the Excel file comes back on the next upload.", confirmLabel: "Delete company", danger: true }))) return;
    setBusy(true);
    const done = await guard(async () => { await deleteProspectAction(prospect.id); return true; }, "Could not delete the company.");
    setBusy(false);
    if (done) { notify(`${name} deleted.`); onClose(); router.refresh(); }
  }

  async function removeContact(contact: ContactRow) {
    if (!(await confirmAction({ title: `Delete ${contact.name}?`, message: `Removes this HR contact from ${name}.`, confirmLabel: "Delete contact", danger: true }))) return;
    const done = await guard(async () => { await deleteProspectContactAction(contact.id, contact.name); return true; }, "Could not delete the contact.");
    if (done) { notify("Contact deleted."); router.refresh(); }
  }

  return (
    <>
      <Dialog onOpenChange={(open) => { if (!open) onClose(); }} open>
        <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]" showCloseButton={false}>
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <span className={s.logo} aria-hidden="true">{initials(name)}</span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-extrabold leading-tight">{name}</DialogTitle>
              <DialogDescription className="mt-1 text-[13px]">{[shortLegalName(prospect.legal_name), prospect.industry].filter(Boolean).join(" · ") || "Company"}</DialogDescription>
            </div>
            {prospect.added_via === "claude" ? <span className={s.claudeChip}><i aria-hidden="true" className="ti ti-sparkles" />Added by Claude</span> : null}
            <span className={s.status} data-status={prospect.status} title={STATUS_HELP[prospect.status]}>{STATUS_LABEL[prospect.status]}</span>
            <button aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-[var(--bg)] hover:text-foreground" onClick={onClose} type="button"><i aria-hidden="true" className="ti ti-x" /></button>
          </div>

          <div className={`${s.detail} overflow-y-auto p-5`}>
            {prospect.status === "excluded" && prospect.exclusion_reason ? <div className={s.sourceNote}><i className="ti ti-info-circle" aria-hidden="true" />Taken off the active list: {prospect.exclusion_reason}</div> : null}

            {prediction ? (
              <Section title={`Prediction for ${year}`}>
                <div className={s.box}>
                  <dl className={s.facts}>
                    {([["priority", "Priority"], ["estimate", "Expected opening"], ["pattern", "Pattern"], ["basis", "Based on"], ["approach", "Suggested approach"], ["confidence", "Confidence"], ["notes", "Notes"]] as const).filter(([key]) => prediction[key]).map(([key, label]) => <FactRow key={key} label={label} value={prediction[key]} />)}
                  </dl>
                </div>
              </Section>
            ) : null}

            <Section title="Programme">
              <div className={s.box}>
                <p className={s.pre}>{prospect.program || "—"}</p>
                {(prospect.active_years || prospect.total_openings !== null || prospect.usual_months.length) ? (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">{[activeYearsLabel(prospect.active_years), prospect.total_openings !== null ? `${prospect.total_openings} openings recorded` : "", prospect.usual_months.length ? `usually ${monthList(prospect.usual_months)}` : ""].filter(Boolean).join(" · ")}</p>
                ) : null}
              </div>
            </Section>

            <Section title="When it opened">
              {years.length ? (
                <div className={s.box}>
                  <table className={s.yearTable}>
                    <thead><tr><th scope="col">Year</th><th scope="col">Months</th><th scope="col">Dates</th></tr></thead>
                    <tbody>{years.map((item) => <tr key={item}><th scope="row">{item}</th><td>{prospect.openings[item].label || monthList(prospect.openings[item].months) || "—"}</td><td>{prospect.openings[item].dates || "—"}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : <p className={s.panelNote}>No opening recorded yet.</p>}
            </Section>

            <Section action={<button className={s.ghostButton} onClick={() => setContactForm({ contact: null })} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add contact</button>} title={`HR contacts (${people.length})`}>
              {contacts.length ? (
                <ul className={s.listBox}>
                  {[...people, ...inboxes].map((contact) => {
                    const href = linkHref(contact.link); const kind = linkKind(contact.link); const person = isPerson(contact);
                    return (
                      <li className={s.contact} key={contact.id}>
                        <span className={s.avatar} aria-hidden="true">{person ? initials(contact.name) : <i className="ti ti-mail" />}</span>
                        <span className={s.rowText}><b>{person ? contact.name : "Recruitment inbox"}{contact.added_via === "claude" ? <span className={s.claudeMark} title="Added by Claude"><i aria-hidden="true" className="ti ti-sparkles" /><span className="sr-only">Added by Claude</span></span> : null}</b><small>{person ? contact.title || "—" : contact.link}</small></span>
                        <span className={s.contactActions}>
                          {href ? <a aria-label={kind === "email" ? `Email ${contact.name}` : `Open ${contact.name} on LinkedIn`} className={s.iconLink} href={href} rel="noopener noreferrer" target="_blank"><i className={`ti ${kind === "email" ? "ti-mail" : kind === "linkedin" ? "ti-brand-linkedin" : "ti-external-link"}`} aria-hidden="true" /></a> : null}
                          <button aria-label={`Edit contact ${contact.name}`} className={s.iconButton} onClick={() => setContactForm({ contact })} type="button"><i className="ti ti-pencil" aria-hidden="true" /></button>
                          <button aria-label={`Delete contact ${contact.name}`} className={s.iconButton} data-danger="" onClick={() => removeContact(contact)} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className={s.panelNote}>No HR contact yet.</p>}
            </Section>

            {research === null && !failed ? <p className={s.loading}>Loading requirements and updates…</p> : null}
            {failed ? <p className={s.panelNote}>Requirements and updates could not be loaded. Close and open the company again.</p> : null}

            {claudeNotes.length ? (
              <Section title={`Research notes from Claude (${claudeNotes.length})`}>
                <ul className={s.listBox}>
                  {[...claudeNotes].sort((a, b) => String(b.details.Date || "").localeCompare(String(a.details.Date || ""))).map((row) => (
                    <li className={s.claudeNote} key={row.id}>
                      <span className={s.claudeNoteHead}><i aria-hidden="true" className="ti ti-sparkles" />{row.details.Date ? formatDay(row.details.Date) : "No date"}{row.kind === "requirement" ? <span className={s.tagMuted}>Requirement</span> : row.kind === "steps" ? <span className={s.tagMuted}>Selection steps</span> : null}{row.program ? <span className={s.tagMuted}>{row.program}</span> : null}</span>
                      <p>{row.details.Note}</p>
                      <small>{row.details.Source ? <a href={row.details.Source} rel="noopener noreferrer" target="_blank">Source <i aria-hidden="true" className="ti ti-external-link" /></a> : null}{row.details.Source && row.details["Added by"] ? " · " : ""}{row.details["Added by"] || ""}</small>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {updates.length ? (
              <Section title={`Dates & status updates (${updates.length})`}>
                {updates.map((row) => (
                  <div className={s.box} key={row.id}>
                    <b>{row.program || "Programme"}</b>
                    <dl className={`${s.facts} mt-2`}>
                      <FactRow label="Opens" value={row.details.openDate} />
                      <FactRow label="Closes" value={row.details.closeDate} />
                      <FactRow label="Status" value={row.details.status} />
                      {row.details.requirement ? <FactRow label="Key requirement" value={row.details.requirement} /> : null}
                      {row.details.verification ? <FactRow label="Checked from" value={row.details.verification} /> : null}
                      {row.details.notes ? <FactRow label="Notes" value={row.details.notes} /> : null}
                    </dl>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{[row.origin, row.details.confidence ? `confidence ${row.details.confidence}` : ""].filter(Boolean).join(" · ")}</p>
                  </div>
                ))}
              </Section>
            ) : null}

            {requirements.length ? (
              <Section title={`Requirements & selection (${requirements.length})`}>
                {requirements.map((row, index) => (
                  <details className={s.research} key={row.id} open={index === 0}>
                    <summary><b>{row.program || "Programme"}</b>{row.details.referenceYear ? <span className={s.tagMuted}>{row.details.referenceYear.slice(0, 24)}</span> : null}{row.details.confidence ? <span className={s.tagMuted}>{row.details.confidence}</span> : null}<i className={`ti ti-chevron-down ${s.chevron}`} aria-hidden="true" /></summary>
                    <div>
                      <dl className={s.facts}>{REQUIREMENT_FIELDS.filter(([key]) => key in row.details).map(([key, label]) => <FactRow key={key} label={label} value={row.details[key]} />)}</dl>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">{[row.origin, row.details.sourceType].filter(Boolean).join(" · ")}</p>
                    </div>
                  </details>
                ))}
              </Section>
            ) : null}

            {steps.length ? (
              <Section title={`More selection steps (${steps.length})`}>
                {steps.map((row) => (
                  <div className={s.box} key={row.id}>
                    <b>{row.program || "Programme"}</b>
                    <div className="my-2"><Value value={row.details.steps} /></div>
                    <p className="text-xs text-[var(--text-muted)]">{[row.origin, row.details.verification, row.details.confidence].filter(Boolean).join(" · ")}</p>
                  </div>
                ))}
              </Section>
            ) : null}

            {prospect.notes ? <Section title="Notes"><div className={s.box}><p className={s.pre}><Linked text={prospect.notes} /></p></div></Section> : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
            <Button disabled={busy} onClick={removeCompany} type="button" variant="danger"><i aria-hidden="true" className="ti ti-trash" /> Delete company</Button>
            <Button onClick={onEdit} type="button"><i aria-hidden="true" className="ti ti-pencil" /> Edit company</Button>
          </div>
        </DialogContent>
      </Dialog>
      {contactForm ? <ContactForm companyName={name} contact={contactForm.contact} onClose={() => setContactForm(null)} prospectId={prospect.id} /> : null}
    </>
  );
}

function FactRow({ label, value }: { label: string; value?: string }) {
  return <><dt>{label}</dt><dd><Value value={value} /></dd></>;
}
