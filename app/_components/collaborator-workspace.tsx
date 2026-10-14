"use client";

import { saveCollaboratorDetailsAction, updateCollaboratorPhotoAction } from "@/app/actions/collaborator-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { StorageImage } from "./storage-image";
import { Pill } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";

function array(value: unknown) { if (Array.isArray(value)) return value; if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } } return []; }
function initials(value: unknown) { return String(value || "?").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
const fieldLabel = "grid gap-1 text-xs font-medium text-foreground";
const fieldInput = "h-9 rounded-md border border-input bg-white px-2.5 text-sm font-normal";
const fieldArea = "min-h-20 rounded-md border border-input bg-white px-2.5 py-2 text-sm font-normal";
const ADVISOR_STATUS_TONE: Record<string, "blue" | "gray" | "green"> = { Connected: "blue", Pending: "gray", Contacted: "green" };

export function CollaboratorWorkspace({ rows, management }: { rows: ApiRecord[]; management: ReactNode }) {
  const router = useRouter(); const [tab, setTab] = useState<"collaborator" | "advisor" | "manage">("collaborator"); const [selectedId, setSelectedId] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const visible = rows.filter((row) => tab === "manage" || row.tipe === tab); const selected = rows.find((row) => String(row.id) === selectedId);
  useRecordFocus((id) => {
    const row = rows.find((item) => String(item.id) === id);
    if (!row) return;
    setTab(row.tipe === "advisor" ? "advisor" : "collaborator");
    setSelectedId(id);
    return true;
  });
  async function photo(file: File) { if (!selected) return; setBusy(true); setMessage("Uploading photo..."); try { const response = await fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: "collaborator-photos", filename: file.name || `photo-${Date.now()}.png`, contentType: file.type }) }); const signed = await response.json() as { key?: string; url?: string; error?: string }; if (!response.ok || !signed.key || !signed.url) throw new Error(signed.error || "Upload could not be prepared."); const uploaded = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file }); if (!uploaded.ok) throw new Error("R2 rejected the upload."); await updateCollaboratorPhotoAction(String(selected.id), signed.key); setMessage("Photo updated."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); } }

  return (
    <div className="grid gap-3.5">
      <Tabs onValueChange={(value) => setTab(value as typeof tab)} value={tab}>
        <TabsList variant="line">
          <TabsTrigger value="collaborator"><i className="ti ti-star" /> Collaborators ({rows.filter((row) => row.tipe === "collaborator").length})</TabsTrigger>
          <TabsTrigger value="advisor"><i className="ti ti-bulb" /> Advisors ({rows.filter((row) => row.tipe === "advisor").length})</TabsTrigger>
          <TabsTrigger value="manage">Add &amp; manage</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab !== "manage" ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((row) => (
            <button className="text-left" data-record-id={String(row.id)} key={String(row.id)} onClick={() => setSelectedId(String(row.id))} type="button">
              <Card className="gap-2.5 p-3.5">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-[var(--bg)] text-[13px] font-medium text-[#0c447c]">
                    {row.foto_url ? <StorageImage area="collaborator-photos" label={String(row.nama)} objectKey={String(row.foto_url)} /> : <span>{initials(row.nama)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5"><strong className="text-[13px] font-medium">{String(row.nama || "Untitled")}</strong>{row.tipe === "collaborator" && row.privy ? <Pill tone="amber"><i className="ti ti-shield-check" /> Privy</Pill> : null}{row.tipe === "advisor" && row.status ? <Pill tone={ADVISOR_STATUS_TONE[String(row.status)] || "gray"}>{String(row.status)}</Pill> : null}</div>
                    <span className="text-[11px] text-muted-foreground">{row.tipe === "collaborator" ? String(row.rekening || "No bank account") : String(row.background || row.catatan || "No advisor background")}</span>
                  </div>
                </div>
                {row.tipe === "collaborator" ? (
                  <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                    <span>{array(row.kewajiban).length} obligations</span>&middot;<span>{array(row.services).length} services</span>
                  </div>
                ) : null}
              </Card>
            </button>
          ))}
          {!visible.length ? <div className="col-span-full grid place-items-center py-10 text-center text-muted-foreground"><i className="ti ti-users mb-2 text-2xl" /><span>No collaborators yet.</span></div> : null}
        </div>
      ) : management}
      <Dialog onOpenChange={(open) => { if (!open) setSelectedId(""); }} open={Boolean(selected)}>
        {selected ? (
          <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
            <DialogHeader className="flex-row items-center gap-3 border-b border-border px-5 pt-5 pb-4 pr-12 text-left">
              <label
                aria-label={busy ? "Uploading photo" : "Change photo: click, drop or paste an image"}
                className="group relative grid size-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-[var(--bg)] text-lg font-bold text-muted-foreground"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void photo(file); }}
                onPaste={(event) => { const file = event.clipboardData.files[0]; if (file) void photo(file); }}
                tabIndex={0}
              >
                {selected.foto_url ? <StorageImage area="collaborator-photos" className="h-full !min-h-0 w-full" label={String(selected.nama)} objectKey={String(selected.foto_url)} /> : <span>{initials(selected.nama)}</span>}
                <span className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><i aria-hidden="true" className={busy ? "ti ti-loader-2 animate-spin" : "ti ti-camera"} /></span>
                <input accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void photo(file); }} type="file" />
              </label>
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground capitalize">{String(selected.tipe || "collaborator")}</span>
                <DialogTitle className="truncate text-lg">{String(selected.nama || "Untitled")}</DialogTitle>
                <DialogDescription className="text-xs">{busy ? "Uploading photo…" : message || "Click the photo to change it."}</DialogDescription>
              </div>
            </DialogHeader>
            <form action={saveCollaboratorDetailsAction.bind(null, String(selected.id))} className="flex min-h-0 flex-1 flex-col">
              <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
                <label className={fieldLabel}><span>Status</span><input className={fieldInput} defaultValue={String(selected.status || "")} name="status" /></label>
                <label className={fieldLabel}><span>Bank account</span><input className={fieldInput} defaultValue={String(selected.rekening || "")} name="rekening" /></label>
                <label className="col-span-full flex items-center gap-2 text-sm font-medium text-foreground"><input defaultChecked={Boolean(selected.privy)} name="privy" type="checkbox" /> Privy complete</label>
                <label className={`${fieldLabel} col-span-full`}><span>Background</span><textarea className={fieldArea} defaultValue={String(selected.background || "")} name="background" /></label>
                <label className={`${fieldLabel} col-span-full`}><span>Obligations <span className="font-normal text-muted-foreground">(one per line)</span></span><textarea className={fieldArea} defaultValue={array(selected.kewajiban).map(String).join("\n")} name="kewajiban" /></label>
                <label className={`${fieldLabel} col-span-full`}><span>Services <span className="font-normal text-muted-foreground">(one per line: label | rate)</span></span><textarea className={fieldArea} defaultValue={array(selected.services).map((item) => typeof item === "object" && item ? `${String((item as Record<string, unknown>).label || "")} | ${String((item as Record<string, unknown>).rate || "")}` : String(item)).join("\n")} name="services" /></label>
                <label className={`${fieldLabel} col-span-full`}><span>Notes</span><textarea className={fieldArea} defaultValue={String(selected.catatan || "")} name="catatan" /></label>
              </div>
              <DialogFooter className="border-t border-border px-5 py-3">
                <Button onClick={() => setSelectedId("")} type="button" variant="outline">Cancel</Button>
                <Button type="submit">Save profile</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
