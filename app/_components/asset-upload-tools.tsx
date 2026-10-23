"use client";

import { createContentLibraryAssetAction, createDesignAssetAction } from "@/app/actions/asset-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { notify } from "./app-dialog";
import g from "./library.module.css";
import s from "./page-kit.module.css";

const MAX_FILES = 12;

/** Header button + upload popup. Same storage flow as before: sign → PUT to R2 → create the record. */
export function AssetUploadTools({ mode, categories = [] }: { mode: "design" | "content"; categories?: string[] }) {
  const [open, setOpen] = useState(false);
  const noun = mode === "design" ? "design asset" : "content reference";
  return (
    <>
      <button className={s.primary} onClick={() => setOpen(true)} type="button"><i className="ti ti-photo-plus" aria-hidden="true" /> Upload {noun}</button>
      {open ? <UploadDialog categories={categories} close={() => setOpen(false)} mode={mode} noun={noun} /> : null}
    </>
  );
}

function UploadDialog({ mode, noun, categories, close }: { mode: "design" | "content"; noun: string; categories: string[]; close: () => void }) {
  const router = useRouter();
  const formId = useId(); const dropId = useId(); const listId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missingImages, setMissingImages] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  function addFiles(list: File[]) {
    const images = list.filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    setMissingImages(false);
    setFiles((current) => [...current, ...images].slice(0, MAX_FILES));
  }

  // onSubmit, not a form action: a React form action resets the fields, which would wipe what
  // was typed whenever the image check or an upload fails.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!files.length) { setMissingImages(true); document.getElementById(dropId)?.focus(); return; }
    setBusy(true); setError("");
    try {
      const storagePaths: string[] = [];
      for (const file of files) {
        const signed = await fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: "design-assets", filename: file.name || `pasted-${Date.now()}.png`, contentType: file.type }) });
        const prepared = await signed.json() as { key?: string; url?: string; error?: string };
        if (!signed.ok || !prepared.key || !prepared.url) throw new Error(prepared.error || "Upload could not be prepared.");
        const uploaded = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!uploaded.ok) throw new Error(`Upload failed for ${file.name}.`);
        storagePaths.push(prepared.key);
      }
      const input = Object.fromEntries(formData.entries());
      if (mode === "design") await createDesignAssetAction({ ...input, storage_paths: storagePaths });
      else await createContentLibraryAssetAction({ ...input, labels: String(formData.get("labels") || "").split(",").map((item) => item.trim()).filter(Boolean), storage_paths: storagePaths });
      notify(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} saved with ${files.length} image${files.length === 1 ? "" : "s"}.`);
      router.refresh(); close();
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); } finally { setBusy(false); }
  }

  return (
    <Dialog onOpenChange={(value) => { if (!value && !busy) close(); }} open>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[600px]" onPaste={(event) => addFiles([...event.clipboardData.files])}>
        <DialogHeader><DialogTitle>Upload {noun}</DialogTitle><DialogDescription>Fields marked * are required. You can also paste an image anywhere in this window.</DialogDescription></DialogHeader>
        <form className={g.formGrid} id={formId} onSubmit={submit}>
          {mode === "design" ? (
            <>
              <Field label="Name" required><input className={s.input} name="nama" required /></Field>
              <Field label="Category" required><input className={s.input} list={listId} name="kategori" required /><datalist id={listId}>{categories.map((value) => <option key={value} value={value} />)}</datalist></Field>
              <Field label="Type"><select className={s.input} name="tipe"><option value="assets">Asset</option><option value="references">Reference</option></select></Field>
            </>
          ) : (
            <>
              <Field label="Platform"><select className={s.input} name="platform"><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>LinkedIn</option></select></Field>
              <Field label="Content type"><select className={s.input} name="jenis"><option>Carousel</option><option>Reels/Video</option><option>Single Image</option><option>Thread/Text</option></select></Field>
              <Field label="Likes" required><input className={s.input} min="0" name="likes" required type="number" /></Field>
              <Field label="Labels"><input className={s.input} name="labels" placeholder="Comma-separated" /></Field>
              <Field label="Copywriting" wide><textarea className={s.input} name="copywriting" rows={3} /></Field>
            </>
          )}
          <Field label="Source URL"><input className={s.input} name="link" placeholder="https://" type="url" /></Field>
          <div className={`${s.field} ${g.wide}`}>
            <span>Images <b aria-hidden="true" className={s.req}>*</b></span>
            <label
              aria-describedby={missingImages ? `${dropId}-err` : undefined}
              aria-invalid={missingImages || undefined}
              className={`${g.dropzone} ${dragging ? g.dragging : ""} ${missingImages ? g.invalid : ""}`}
              id={dropId}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles([...event.dataTransfer.files]); }}
              tabIndex={0}
            >
              <i className="ti ti-photo-up" aria-hidden="true" />
              <b>Choose, drop or paste images</b>
              <span>{files.length ? `${files.length} of ${MAX_FILES} selected` : `Up to ${MAX_FILES} images`}</span>
              <input accept="image/*" aria-label="Images" multiple onChange={(event) => { addFiles([...(event.target.files || [])]); event.target.value = ""; }} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} type="file" />
            </label>
            {missingImages ? <p className={g.fieldError} id={`${dropId}-err`} role="alert">Add at least one image.</p> : null}
            {previews.length ? (
              <div className={g.previews}>
                {previews.map((url, index) => (
                  <figure key={url}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                    <img alt={`Selected image ${index + 1}`} src={url} />
                    <button aria-label={`Remove image ${index + 1}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
          <Field label="Notes" wide><textarea className={s.input} name="notes" rows={2} /></Field>
          {error ? <p className={`${g.fieldError} ${g.wide}`} role="alert">{error}</p> : null}
        </form>
        <DialogFooter sticky>
          <Button disabled={busy} onClick={close} type="button" variant="ghost">Cancel</Button>
          <Button disabled={busy} form={formId} type="submit">{busy ? "Uploading…" : `Save ${noun}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return <label className={`${s.field} ${wide ? g.wide : ""}`}><span>{label}{required ? <b aria-hidden="true" className={s.req}> *</b> : null}</span>{children}</label>;
}
