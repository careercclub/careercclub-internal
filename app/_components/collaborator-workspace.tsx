"use client";

import { saveCollaboratorDetailsAction, updateCollaboratorPhotoAction } from "@/app/actions/collaborator-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { StorageImage } from "./storage-image";
import { Pill } from "./ui-kit";

function array(value: unknown) { if (Array.isArray(value)) return value; if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } } return []; }
function initials(value: unknown) { return String(value || "?").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
const ADVISOR_STATUS_TONE: Record<string, "blue" | "gray" | "green"> = { Connected: "blue", Pending: "gray", Contacted: "green" };

export function CollaboratorWorkspace({ rows, management }: { rows: ApiRecord[]; management: ReactNode }) {
  const router = useRouter(); const [tab, setTab] = useState<"collaborator" | "advisor" | "manage">("collaborator"); const [selectedId, setSelectedId] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const visible = rows.filter((row) => tab === "manage" || row.tipe === tab); const selected = rows.find((row) => String(row.id) === selectedId);
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
            <button className="text-left" key={String(row.id)} onClick={() => setSelectedId(String(row.id))} type="button">
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
          {!visible.length ? <div className="col-span-full grid place-items-center py-10 text-center text-muted-foreground"><i className="ti ti-users mb-2 text-2xl" /><span>Belum ada data.</span></div> : null}
        </div>
      ) : management}
      {selected ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-5" onMouseDown={() => setSelectedId("")}>
          <Card className="w-full max-w-xl gap-3 p-4.5" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div><span className="text-[10px] text-muted-foreground">{String(selected.tipe || "collaborator")}</span><h2 className="text-lg font-bold">{String(selected.nama || "Untitled")}</h2><p className="text-[11px] text-muted-foreground">{String(selected.status || "No status")}</p></div>
              <button onClick={() => setSelectedId("")} type="button"><i className="ti ti-x" /></button>
            </div>
            <label
              className="grid cursor-pointer place-items-center gap-1 rounded-lg border border-dashed border-border bg-[var(--bg)] p-6 text-center text-muted-foreground"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void photo(file); }}
              onPaste={(event) => { const file = event.clipboardData.files[0]; if (file) void photo(file); }}
              tabIndex={0}
            >
              <i className="ti ti-camera text-xl" /><span className="text-xs">{busy ? "Uploading..." : "Click, drop, or paste a new photo"}</span>
              <input accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void photo(file); }} type="file" />
            </label>
            {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}
            <form action={saveCollaboratorDetailsAction.bind(null, String(selected.id))} className="grid gap-2.5 sm:grid-cols-2">
              <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Status</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" defaultValue={String(selected.status || "")} name="status" /></label>
              <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Bank account</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" defaultValue={String(selected.rekening || "")} name="rekening" /></label>
              <label className="col-span-full flex items-center gap-2 text-[12px] font-medium text-foreground"><input defaultChecked={Boolean(selected.privy)} name="privy" type="checkbox" /> Privy complete</label>
              <label className="col-span-full grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Background</span><textarea className="rounded-md border border-input px-2 py-1.5 text-xs font-normal normal-case text-foreground" defaultValue={String(selected.background || "")} name="background" /></label>
              <label className="col-span-full grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Obligations, one per line</span><textarea className="rounded-md border border-input px-2 py-1.5 text-xs font-normal normal-case text-foreground" defaultValue={array(selected.kewajiban).map(String).join("\n")} name="kewajiban" /></label>
              <label className="col-span-full grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Services, label | rate</span><textarea className="rounded-md border border-input px-2 py-1.5 text-xs font-normal normal-case text-foreground" defaultValue={array(selected.services).map((item) => typeof item === "object" && item ? `${String((item as Record<string, unknown>).label || "")} | ${String((item as Record<string, unknown>).rate || "")}` : String(item)).join("\n")} name="services" /></label>
              <label className="col-span-full grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Notes</span><textarea className="rounded-md border border-input px-2 py-1.5 text-xs font-normal normal-case text-foreground" defaultValue={String(selected.catatan || "")} name="catatan" /></label>
              <Button className="w-max" type="submit">Save profile</Button>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
