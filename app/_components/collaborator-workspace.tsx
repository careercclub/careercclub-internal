"use client";

import { saveCollaboratorDetailsAction, updateCollaboratorPhotoAction } from "@/app/_actions/collaborator-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ApiRecord } from "@/lib/api/_crud";
import { filterPeople, initials, kindOf, listOf, peopleSummary, plural, services } from "@/lib/library/view";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useId, useState } from "react";
import { notify, notifyError } from "./app-dialog";
import g from "./library.module.css";
import s from "./page-kit.module.css";
import { StorageImage } from "./storage-image";
import { useRecordFocus } from "./use-record-focus";
import { compareText } from "@/lib/text/sort";
import { ShowMoreList } from "./ui-kit";

// Collaborators & advisors in the IJIS layout: one directory per kind, people as avatars,
// one status chip each. The profile popup saves the same fields as before.

type Tab = "collaborator" | "advisor" | "manage";
const ADVISOR_STATUSES = ["Pending", "Contacted", "Connected"];

function Avatar({ row, large = false }: { row: ApiRecord; large?: boolean }) {
  return (
    <span className={`${g.avatar} ${large ? g.avatarLarge : ""}`}>
      {row.foto_url ? <StorageImage area="collaborator-photos" className="h-full !min-h-0 w-full" label={String(row.nama || "")} objectKey={String(row.foto_url)} /> : <span aria-hidden="true">{initials(row.nama)}</span>}
    </span>
  );
}

export function CollaboratorWorkspace({ rows, management }: { rows: ApiRecord[]; management: ReactNode }) {
  const [tab, setTab] = useState<Tab>("collaborator");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const summary = peopleSummary(rows);
  const selected = rows.find((row) => String(row.id) === selectedId);
  const kind = tab === "advisor" ? "advisor" : "collaborator";
  const visible = filterPeople(rows, kind, query, status);
  const statuses = [...new Set(rows.filter((row) => kindOf(row) === kind).map((row) => String(row.status || "")).filter(Boolean))].sort(compareText);

  useRecordFocus((id) => {
    const row = rows.find((item) => String(item.id) === id);
    if (!row) return;
    setTab(kindOf(row)); setQuery(""); setStatus("");
    setSelectedId(id);
    return true;
  });
  const switchTab = (next: Tab) => { setTab(next); setStatus(""); };

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <h1>Collaborators</h1>
          <p>{plural(summary.collaborators, "collaborator")} · {plural(summary.advisors, "advisor")}{summary.privyMissing ? ` · ${summary.privyMissing} without Privy` : ""}</p>
        </div>
        <div className={s.headActions}><button className={s.ghost} onClick={() => switchTab("manage")} type="button"><i className="ti ti-user-plus" aria-hidden="true" /> Manage people</button></div>
      </header>

      <div aria-label="Views" className={s.segmented} role="tablist">
        <button aria-selected={tab === "collaborator"} className={tab === "collaborator" ? s.segmentActive : s.segment} onClick={() => switchTab("collaborator")} role="tab" type="button"><i className="ti ti-star" aria-hidden="true" /> Collaborators <span>{summary.collaborators}</span></button>
        <button aria-selected={tab === "advisor"} className={tab === "advisor" ? s.segmentActive : s.segment} onClick={() => switchTab("advisor")} role="tab" type="button"><i className="ti ti-bulb" aria-hidden="true" /> Advisors <span>{summary.advisors}</span></button>
        <button aria-selected={tab === "manage"} className={tab === "manage" ? s.segmentActive : s.segment} onClick={() => switchTab("manage")} role="tab" type="button"><i className="ti ti-table" aria-hidden="true" /> Manage data</button>
      </div>

      {tab === "manage" ? management : (
        <>
          <div className={s.toolbar}>
            <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label={`Search ${kind}s`} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${kind}s`} value={query} /></label>
            {kind === "collaborator" || statuses.length ? (
              <label className={s.filterPill}><span>Status</span>
                <select aria-label="Filter status" onChange={(e) => setStatus(e.target.value)} value={status}>
                  <option value="">All</option>
                  {kind === "collaborator" ? <option value="privy-missing">Privy not complete</option> : null}
                  {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          {visible.length ? (
            <ul aria-label={kind === "advisor" ? "Advisors" : "Collaborators"} className={g.people}>
              <ShowMoreList items={visible} step={24} inList>{(visibleItems) => visibleItems.map((row) => {
                const obligations = listOf(row.kewajiban).length;
                const offered = services(row.services);
                return (
                  <li key={String(row.id)}>
                    <button className={g.person} data-record-id={String(row.id)} onClick={() => setSelectedId(String(row.id))} type="button">
                      <span className={g.personTop}>
                        <Avatar row={row} />
                        <span className={g.personName}>
                          <b>{String(row.nama || "Untitled")}</b>
                          <small>{kind === "collaborator" ? String(row.rekening || "No bank account yet") : String(row.background || row.catatan || "No background yet")}</small>
                        </span>
                      </span>
                      <span className={g.personFacts}>
                        {kind === "collaborator" ? (row.privy ? <span className={s.chip}><i className="ti ti-shield-check" aria-hidden="true" /> Privy complete</span> : <span className={s.chipMuted}><i className="ti ti-shield" aria-hidden="true" /> Privy not complete</span>) : null}
                        {row.status ? <span className={s.chipMuted}>{String(row.status)}</span> : null}
                      </span>
                      {kind === "collaborator" ? (
                        <span className={g.personMeta}><span><b>{obligations}</b> obligation{obligations === 1 ? "" : "s"}</span><span><b>{offered.length}</b> service{offered.length === 1 ? "" : "s"}</span></span>
                      ) : offered.length ? <span className={g.personMeta}>{offered.slice(0, 2).map((item) => <span key={item.label}>{item.label}{item.rate ? <b> · {item.rate}</b> : null}</span>)}</span> : null}
                    </button>
                  </li>
                );
              })}</ShowMoreList>
            </ul>
          ) : (
            <div className={s.card}>
              <p className={s.empty}>{filterPeople(rows, kind).length ? `No ${kind}s match.` : `No ${kind}s yet.`}</p>
              {query || status ? <button className={s.ghost} onClick={() => { setQuery(""); setStatus(""); }} style={{ alignSelf: "center" }} type="button">Clear filters</button> : null}
            </div>
          )}
        </>
      )}
      {selected ? <ProfileDialog close={() => setSelectedId("")} row={selected} /> : null}
    </div>
  );
}

function ProfileDialog({ row, close }: { row: ApiRecord; close: () => void }) {
  const router = useRouter();
  const formId = useId(); const statusList = useId(); const photoInput = useId();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const kind = kindOf(row);
  const name = String(row.nama || "Untitled");

  async function photo(file: File) {
    if (!file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: "collaborator-photos", filename: file.name || `photo-${Date.now()}.png`, contentType: file.type }) });
      const signed = await response.json() as { key?: string; url?: string; error?: string };
      if (!response.ok || !signed.key || !signed.url) throw new Error(signed.error || "Upload could not be prepared.");
      const uploaded = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploaded.ok) throw new Error("The storage bucket rejected the upload.");
      await updateCollaboratorPhotoAction(String(row.id), signed.key);
      notify("Photo updated."); router.refresh();
    } catch (error) { notifyError(error, "Could not upload the photo."); } finally { setBusy(false); }
  }
  // onSubmit rather than a form action: a form action resets the fields, which would lose edits if saving fails.
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    try { await saveCollaboratorDetailsAction(String(row.id), formData); notify("Profile saved."); router.refresh(); close(); }
    catch (error) { notifyError(error, "Could not save the profile."); } finally { setSaving(false); }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open && !saving) close(); }} open>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[600px]" onPaste={(event) => { const file = event.clipboardData.files[0]; if (file) void photo(file); }}>
        <DialogHeader className="flex-row items-center gap-4 text-left">
          <label
            aria-label={busy ? "Uploading photo" : `Change photo of ${name}: click, drop or paste an image`}
            className={g.photo}
            htmlFor={photoInput}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void photo(file); }}
            tabIndex={0}
          >
            <Avatar large row={row} />
            <span className={g.photoBadge}><i aria-hidden="true" className={busy ? "ti ti-loader-2 animate-spin" : "ti ti-camera"} /></span>
          </label>
          <input accept="image/*" className="hidden" id={photoInput} onChange={(event) => { const file = event.target.files?.[0]; if (file) void photo(file); event.target.value = ""; }} type="file" />
          <div className="min-w-0">
            <span className={s.eyebrow}>{kind === "advisor" ? "Advisor" : "Collaborator"}</span>
            <DialogTitle className="truncate text-lg">{name}</DialogTitle>
            <DialogDescription>{busy ? "Uploading photo…" : "Click, drop or paste a photo to change it."}</DialogDescription>
          </div>
        </DialogHeader>
        <form className={g.formGrid} id={formId} onSubmit={save}>
          <label className={s.field}><span>Status</span><input className={s.input} defaultValue={String(row.status || "")} list={statusList} name="status" placeholder={kind === "advisor" ? "Pending, Contacted…" : "Active"} /><datalist id={statusList}>{(kind === "advisor" ? ADVISOR_STATUSES : ["Active", "Inactive"]).map((value) => <option key={value} value={value} />)}</datalist></label>
          <label className={s.field}><span>Bank account</span><input className={s.input} defaultValue={String(row.rekening || "")} name="rekening" placeholder="Bank · number · name" /></label>
          <label className={`${g.switchRow} ${g.wide}`}><input defaultChecked={Boolean(row.privy)} name="privy" type="checkbox" /> Privy complete</label>
          <label className={`${s.field} ${g.wide}`}><span>Background</span><textarea className={s.input} defaultValue={String(row.background || "")} name="background" rows={2} /></label>
          <label className={`${s.field} ${g.wide}`}><span>Obligations <small className={s.muted}>one per line</small></span><textarea className={s.input} defaultValue={listOf(row.kewajiban).join("\n")} name="kewajiban" rows={3} /></label>
          <label className={`${s.field} ${g.wide}`}><span>Services <small className={s.muted}>one per line: service | rate</small></span><textarea className={s.input} defaultValue={services(row.services).map((item) => item.rate ? `${item.label} | ${item.rate}` : item.label).join("\n")} name="services" rows={3} /></label>
          <label className={`${s.field} ${g.wide}`}><span>Notes</span><textarea className={s.input} defaultValue={String(row.catatan || "")} name="catatan" rows={2} /></label>
        </form>
        <DialogFooter sticky>
          <Button disabled={saving} onClick={close} type="button" variant="outline">Cancel</Button>
          <Button disabled={saving} form={formId} type="submit">{saving ? "Saving…" : "Save profile"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
