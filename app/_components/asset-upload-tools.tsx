"use client";

import { createContentLibraryAssetAction, createDesignAssetAction } from "@/app/actions/asset-actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function AssetUploadTools({ mode }: { mode: "design" | "content" }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [pasted, setPasted] = useState<File[]>([]); const previews = useMemo(() => pasted.map((file) => URL.createObjectURL(file)), [pasted]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);
  function addFiles(files: File[]) { setPasted((current) => [...current, ...files.filter((file) => file.type.startsWith("image/"))].slice(0, 12)); }
  async function submit(formData: FormData) { const selected = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0); const files = [...selected, ...pasted].slice(0, 12); if (!files.length) { setMessage("Select, drop, or paste at least one image."); return; } setBusy(true); setMessage("Uploading images..."); try { const storagePaths: string[] = []; for (const file of files) { const signed = await fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: "design-assets", filename: file.name || `pasted-${Date.now()}.png`, contentType: file.type }) }); const prepared = await signed.json() as { key?: string; url?: string; error?: string }; if (!signed.ok || !prepared.key || !prepared.url) throw new Error(prepared.error || "Upload could not be prepared."); const uploaded = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file }); if (!uploaded.ok) throw new Error(`Upload failed for ${file.name}.`); storagePaths.push(prepared.key); } const labels = String(formData.get("labels") || "").split(",").map((item) => item.trim()).filter(Boolean); const input = Object.fromEntries(formData.entries()); delete input.files; if (mode === "design") await createDesignAssetAction({ ...input, storage_paths: storagePaths }); else await createContentLibraryAssetAction({ ...input, labels, storage_paths: storagePaths }); setMessage("Saved."); setPasted([]); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); } }
  return (
    <details className="rounded-lg border border-border bg-white">
      <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-bold text-[var(--purple-dark)]"><i className="ti ti-photo-plus" /> Upload {mode === "design" ? "design asset" : "content reference"}</summary>
      <form action={submit} className="grid gap-2.5 p-3.5 sm:grid-cols-2">
        {mode === "design" ? (
          <>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Name</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="nama" required /></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Category</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="kategori" required /></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Type</span><select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="tipe"><option value="assets">Asset</option><option value="references">Reference</option></select></label>
          </>
        ) : (
          <>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Platform</span><select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="platform"><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>LinkedIn</option></select></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Type</span><select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="jenis"><option>Carousel</option><option>Reels/Video</option><option>Single Image</option><option>Thread/Text</option></select></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Likes</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="likes" required type="number" /></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Labels</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="labels" placeholder="label, label" /></label>
            <label className="col-span-full grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Copywriting</span><textarea className="rounded-md border border-input px-2 py-1.5 text-xs font-normal normal-case text-foreground" name="copywriting" /></label>
          </>
        )}
        <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Source URL</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="link" /></label>
        <label className="col-span-full grid gap-2 rounded-lg border border-dashed border-input p-2.5 text-[10px] font-semibold text-muted-foreground uppercase" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles([...event.dataTransfer.files]); }} onPaste={(event) => addFiles([...event.clipboardData.files])} tabIndex={0}>
          <span>Images</span>
          <input accept="image/*" className="text-xs font-normal normal-case text-foreground" multiple name="files" type="file" />
          <small className="font-normal normal-case">Choose, drag, or paste images here. Up to 12.</small>
          {previews.length ? <div className="flex flex-wrap gap-1.5">{previews.map((url, index) => <img alt={`Pasted ${index + 1}`} className="h-12 w-12 rounded object-cover" key={url} src={url} />)}</div> : null}
        </label>
        <label className="col-span-full grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Notes</span><textarea className="rounded-md border border-input px-2 py-1.5 text-xs font-normal normal-case text-foreground" name="notes" /></label>
        <Button className="w-max" disabled={busy} type="submit">{busy ? "Uploading..." : "Save"}</Button>
        {message ? <p className="col-span-full text-[11px] text-muted-foreground">{message}</p> : null}
      </form>
    </details>
  );
}
