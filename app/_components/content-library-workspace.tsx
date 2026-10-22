"use client";

import {
  createContentLibraryAssetAction,
  deleteContentLibraryAssetAction,
  updateContentLibraryAssetAction,
} from "@/app/actions/asset-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiRecord } from "@/lib/api/_crud";
import { MAX_CONTENT_IMAGES, storedImagePaths } from "@/lib/content-library/payload";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StorageImage } from "./storage-image";
import { useRecordFocus } from "./use-record-focus";
import styles from "./content-library-workspace.module.css";

type LibraryType = "organic" | "ads";
type SortKey = "" | "views" | "likes" | "comments" | "shares";

const PLATFORMS = ["Instagram", "TikTok", "X", "Threads", "YouTube"];
const CONTENT_TYPES = ["Carousel", "Reels/Video", "Single Image", "Thread/Text"];
const PLATFORM_ICONS: Record<string, string> = {
  Instagram: "ti-brand-instagram",
  TikTok: "ti-brand-tiktok",
  X: "ti-brand-x",
  Threads: "ti-brand-threads",
  YouTube: "ti-brand-youtube",
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(number(value));
}

function rowLabels(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).map((item) => item.trim()).filter(Boolean) : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

const rowImages = storedImagePaths;

function rowType(row: ApiRecord): LibraryType {
  return text(row.tipe).toLowerCase() === "ads" ? "ads" : "organic";
}

function uniqueFiles(current: File[], incoming: File[], limit = MAX_CONTENT_IMAGES) {
  const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const result = [...current];
  for (const file of incoming) {
    if (!file.type.startsWith("image/")) continue;
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!seen.has(key)) {
      result.push(file);
      seen.add(key);
    }
    if (result.length >= limit) break;
  }
  return result;
}

export function ContentLibraryWorkspace({ rows }: { rows: ApiRecord[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const [activeType, setActiveType] = useState<LibraryType>("organic");
  const [platform, setPlatform] = useState("");
  const [contentType, setContentType] = useState("");
  const [label, setLabel] = useState("");
  const [sort, setSort] = useState<SortKey>("");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<ApiRecord | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [editing, setEditing] = useState<ApiRecord | null>(null);
  const [keptPaths, setKeptPaths] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [labelMissing, setLabelMissing] = useState(false);
  const [notice, setNotice] = useState("");

  const typeRows = useMemo(() => rows.filter((row) => rowType(row) === activeType), [rows, activeType]);
  const labelOptions = useMemo(
    () => [...new Set(typeRows.flatMap((row) => rowLabels(row.labels)))].sort((a, b) => a.localeCompare(b)),
    [typeRows],
  );
  const visibleRows = useMemo(() => {
    const filtered = typeRows.filter((row) => (
      (!platform || text(row.platform) === platform) &&
      (!contentType || text(row.jenis) === contentType) &&
      (!label || rowLabels(row.labels).includes(label))
    ));
    return sort ? [...filtered].sort((a, b) => number(b[sort]) - number(a[sort])) : filtered;
  }, [typeRows, platform, contentType, label, sort]);
  const previewUrls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls]);
  useEffect(() => {
    // Safe default: when the delete confirmation appears, focus "Cancel" so Enter never deletes by accident.
    if (confirmDelete) cancelDelete.current?.focus();
  }, [confirmDelete]);
  useEffect(() => {
    // Same safe default for discarding: Enter keeps the user's work.
    if (confirmDiscard) keepEditing.current?.focus();
  }, [confirmDiscard]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (addOpen || selected) return;
      const pasted = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith("image/"));
      if (!pasted.length) return;
      event.preventDefault();
      setEditing(null);
      setKeptPaths([]);
      setFiles((current) => uniqueFiles(current, pasted));
      setAddOpen(true);
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addOpen, selected]);

  // Search result opened: show the right tab without filters and open the content preview.
  useRecordFocus((id) => {
    const row = rows.find((item) => text(item.id) === id);
    if (!row || addOpen || text(selected?.id) === id) return;
    changeType(rowType(row));
    setSelected(row);
    setSelectedImage(0);
    setConfirmDelete(false);
    return true;
  });

  function changeType(value: LibraryType) {
    setActiveType(value);
    setPlatform("");
    setContentType("");
    setLabel("");
    setSort("");
  }

  const fileLimit = MAX_CONTENT_IMAGES - keptPaths.length;

  function openAdd() {
    setLabelMissing(false);
    setFormTouched(false);
    setConfirmDiscard(false);
    setEditing(null);
    setKeptPaths([]);
    setFiles([]);
    setSelectedLabels([]);
    setLabelDraft("");
    setError("");
    setAddOpen(true);
  }

  function openEdit(row: ApiRecord) {
    setLabelMissing(false);
    setFormTouched(false);
    setConfirmDiscard(false);
    setEditing(row);
    setKeptPaths(rowImages(row.storage_paths));
    setFiles([]);
    setSelectedLabels(rowLabels(row.labels));
    setLabelDraft("");
    setError("");
    setNotice("");
    setSelected(null);
    setConfirmDelete(false);
    setAddOpen(true);
  }

  function closePreview() {
    if (busy) return;
    setSelected(null);
    setConfirmDelete(false);
    setError("");
  }

  async function removeSelected() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await deleteContentLibraryAssetAction(text(selected.id));
      setSelected(null);
      setConfirmDelete(false);
      setNotice("Content deleted.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete content.");
    } finally {
      setBusy(false);
    }
  }

  // Unsaved work: any typed field, a new image, or images/labels changed from what was loaded.
  const originalImages = editing ? rowImages(editing.storage_paths) : [];
  const originalLabels = editing ? rowLabels(editing.labels) : [];
  const formDirty = formTouched
    || files.length > 0
    || keptPaths.join("\u0001") !== originalImages.join("\u0001")
    || selectedLabels.join("\u0001") !== originalLabels.join("\u0001");

  function requestCloseAdd() {
    if (busy) return;
    if (formDirty) { setConfirmDiscard(true); return; }
    closeAdd();
  }

  function closeAdd() {
    if (busy) return;
    setConfirmDiscard(false);
    setFormTouched(false);
    setAddOpen(false);
    setEditing(null);
    setKeptPaths([]);
    setFiles([]);
    setSelectedLabels([]);
    setLabelDraft("");
    setError("");
  }

  function addFiles(incoming: File[]) {
    setFiles((current) => uniqueFiles(current, incoming, fileLimit));
  }

  function addLabel(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setSelectedLabels((current) => current.some((item) => item.toLowerCase() === clean.toLowerCase()) ? current : [...current, clean]);
    setLabelMissing(false);
    setLabelDraft("");
  }

  async function submit(formData: FormData) {
    const link = text(formData.get("link")).trim();
    const likesRaw = text(formData.get("likes")).trim();
    if (!link) { setError("Content link is required."); return; }
    if (!likesRaw) { setError("Likes is required."); return; }
    if (!selectedLabels.length) { setError("Pick or create at least one label."); setLabelMissing(true); labelInput.current?.focus(); return; }

    setBusy(true);
    setError("");
    try {
      const storagePaths: string[] = [];
      for (const file of files) {
        const preparedResponse = await fetch("/api/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ area: "design-assets", filename: file.name || `content-${Date.now()}.png`, contentType: file.type }),
        });
        const prepared = await preparedResponse.json() as { key?: string; url?: string; error?: string };
        if (!preparedResponse.ok || !prepared.key || !prepared.url) throw new Error(prepared.error || "Could not prepare the upload.");
        const uploaded = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!uploaded.ok) throw new Error(`Upload failed for ${file.name}.`);
        storagePaths.push(prepared.key);
      }

      const values = {
        tipe: text(formData.get("tipe")),
        platform: text(formData.get("platform")),
        jenis: text(formData.get("jenis")),
        link,
        copywriting: text(formData.get("copywriting")),
        views: number(formData.get("views")),
        likes: number(likesRaw),
        comments: number(formData.get("comments")),
        shares: number(formData.get("shares")),
        labels: selectedLabels,
        notes: text(formData.get("notes")),
        storage_paths: storagePaths,
      };
      if (editing) await updateContentLibraryAssetAction(text(editing.id), { ...values, kept_storage_paths: keptPaths });
      else await createContentLibraryAssetAction(values);
      const savedType: LibraryType = values.tipe === "ads" ? "ads" : "organic";
      if (savedType !== activeType) changeType(savedType);
      setNotice(`${editing ? "Content saved" : "Content added"}${savedType !== activeType ? ` to ${savedType === "ads" ? "Ad Ideas" : "Organic Ideas"}` : ""}.`);
      setAddOpen(false);
      setEditing(null);
      setKeptPaths([]);
      setFiles([]);
      setSelectedLabels([]);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save content.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.pageHead}>
        <div>
          <span className={styles.eyebrow}>Marketing</span>
          <h1>Content Library</h1>
          <p>{visibleRows.length} {visibleRows.length === 1 ? "idea" : "ideas"}{label || platform || contentType ? " match the filters" : ` in ${activeType === "ads" ? "Ad Ideas" : "Organic Ideas"}`}</p>
        </div>
        <Button className={styles.addButton} onClick={openAdd} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add content</Button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="tablist" aria-label="Content library type">
          <button aria-selected={activeType === "organic"} className={activeType === "organic" ? styles.segmentActive : styles.segment} onClick={() => changeType("organic")} role="tab" type="button">Organic Ideas</button>
          <button aria-selected={activeType === "ads"} className={activeType === "ads" ? styles.segmentActive : styles.segment} onClick={() => changeType("ads")} role="tab" type="button">Ad Ideas</button>
        </div>
        <div className={styles.filterPills}>
          <label className={styles.filterPill}><span>Platform</span><select aria-label="Filter platform" onChange={(event) => setPlatform(event.target.value)} value={platform}><option value="">All</option>{PLATFORMS.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className={styles.filterPill}><span>Format</span><select aria-label="Filter format" onChange={(event) => { const value = event.target.value; setContentType(value); if (!sort && value) setSort(value === "Reels/Video" ? "views" : "likes"); }} value={contentType}><option value="">All</option>{CONTENT_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className={styles.filterPill}><span>Label</span><select aria-label="Filter label" onChange={(event) => setLabel(event.target.value)} value={label}><option value="">All</option>{labelOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className={styles.filterPill}><span>Sort</span><select aria-label="Sort content" onChange={(event) => setSort(event.target.value as SortKey)} value={sort}><option value="">Newest</option><option value="views">Most views</option><option value="likes">Most likes</option><option value="comments">Most comments</option><option value="shares">Most shares</option></select></label>
        </div>
        {notice ? <span className={styles.notice} role="status">{notice}</span> : null}
      </div>

      {visibleRows.length ? (
        <div className={styles.grid}>
          {visibleRows.map((row) => {
            const images = rowImages(row.storage_paths);
            const copy = text(row.copywriting);
            const labels = rowLabels(row.labels);
            const icon = PLATFORM_ICONS[text(row.platform)] || "ti-world";
            // The card shows the number the list is sorted by (likes by default).
            const metric = sort && sort !== "likes" ? sort : "likes";
            const metricIcon = { views: "ti-eye", likes: "ti-heart", comments: "ti-message", shares: "ti-share" }[metric];
            return (
              <article className={styles.tile} data-record-id={text(row.id)} key={text(row.id)}>
                <button className={styles.tileOpen} onClick={() => { setSelected(row); setSelectedImage(0); }} type="button" aria-label={`Open ${text(row.platform)} ${text(row.jenis)}`}>
                  <span className={styles.tileMedia}>
                    {images[0] ? <StorageImage area="design-assets" className={styles.tileImage} label={`${text(row.platform)} ${text(row.jenis)}`} objectKey={images[0]} /> : <span className={styles.tileText}>{copy || text(row.jenis) || "Content"}</span>}
                    <span className={styles.tilePlatform}><i className={`ti ${icon}`} aria-hidden="true" /> {text(row.platform) || "Platform"}</span>
                    {images.length > 1 ? <span className={styles.tileCount}><i className="ti ti-photo" aria-hidden="true" /> {images.length}</span> : null}
                  </span>
                  <span className={styles.tileBody}>
                    <b>{copy || text(row.jenis) || "Untitled content"}</b>
                    <span className={styles.tileMeta}>
                      {labels[0] ? <span className={styles.tileLabel}>{labels[0]}{labels.length > 1 ? ` +${labels.length - 1}` : ""}</span> : <span className={styles.tileKind}>{text(row.jenis)}</span>}
                      <span className={styles.tileMetric}><i className={`ti ${metricIcon}`} aria-hidden="true" /> {formatNumber(row[metric])}</span>
                    </span>
                  </span>
                </button>
                {row.link ? <a aria-label="Open content link" className={styles.tileLink} href={text(row.link)} rel="noreferrer" target="_blank"><i className="ti ti-external-link" aria-hidden="true" /></a> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <i className="ti ti-bookmark" />
          <strong>No content yet</strong>
          <span>Click Add content or press Ctrl+V.</span>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) requestCloseAdd(); else setAddOpen(true); }}>
        <DialogContent className={styles.addDialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle><i className={`ti ${editing ? "ti-pencil" : "ti-bookmark"}`} /> {editing ? "Edit content" : "Add content"}</DialogTitle>
            <DialogDescription className="sr-only">{editing ? "Change content that is already in the Content Library." : "Add new content to the Content Library."}</DialogDescription>
          </DialogHeader>
          <form action={submit} className={styles.form} key={editing ? text(editing.id) : "new"} onInput={() => { setFormTouched(true); setConfirmDiscard(false); }} onPaste={(event) => { event.stopPropagation(); addFiles([...event.clipboardData.files]); }}>
            {files.length || keptPaths.length ? (
              <div className={styles.filePreviewArea}>
                {keptPaths.map((key, index) => <div className={styles.filePreview} key={key}><StorageImage area="design-assets" label={`Image ${index + 1}`} objectKey={key} /><button aria-label={`Remove image ${index + 1}`} onClick={() => setKeptPaths((current) => current.filter((item) => item !== key))} type="button"><i className="ti ti-x" /></button></div>)}
                {previewUrls.map((url, index) => <div className={styles.filePreview} key={url}><Image alt={`Image ${keptPaths.length + index + 1}`} fill sizes="72px" src={url} unoptimized /><button aria-label={`Remove image ${keptPaths.length + index + 1}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><i className="ti ti-x" /></button></div>)}
                {fileLimit - files.length > 0 ? <button className={styles.addMoreFiles} onClick={() => fileInput.current?.click()} type="button"><i className="ti ti-plus" /> Add image</button> : null}
              </div>
            ) : (
              <button className={styles.dropzone} onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles([...event.dataTransfer.files]); }} type="button">
                <i className="ti ti-photos" />
                <strong>Click, drag &amp; drop, or Ctrl+V</strong>
                <span>Content screenshots, multiple files, optional</span>
              </button>
            )}
            <input accept="image/*" hidden multiple onChange={(event) => { addFiles([...(event.target.files || [])]); event.target.value = ""; }} ref={fileInput} type="file" />

            <fieldset className={styles.radioGroup}>
              <legend>Idea type</legend>
              <label><input defaultChecked={(editing ? rowType(editing) : activeType) === "organic"} name="tipe" type="radio" value="organic" /> Organic Ideas</label>
              <label><input defaultChecked={(editing ? rowType(editing) : activeType) === "ads"} name="tipe" type="radio" value="ads" /> Ad Ideas</label>
            </fieldset>

            <div className={styles.twoColumns}>
              <label><span>Platform</span><select defaultValue={editing ? text(editing.platform) || PLATFORMS[0] : PLATFORMS[0]} name="platform">{withCurrent(PLATFORMS, editing?.platform).map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Format</span><select defaultValue={editing ? text(editing.jenis) || CONTENT_TYPES[0] : CONTENT_TYPES[0]} name="jenis">{withCurrent(CONTENT_TYPES, editing?.jenis).map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>

            <label className={styles.field}><span>Content link <b>required</b></span><input defaultValue={text(editing?.link)} name="link" placeholder="https://..." required /></label>
            <label className={styles.field}><span>Copywriting <small>optional</small></span><textarea defaultValue={text(editing?.copywriting)} name="copywriting" placeholder="Caption or content text..." rows={3} /></label>

            <fieldset className={styles.engagement}>
              <legend>Engagement</legend>
              <label><span>Views</span><input defaultValue={editing ? number(editing.views) : undefined} min="0" name="views" placeholder="0" type="number" /></label>
              <label className={styles.requiredMetric}><span>Likes <b>required</b></span><input defaultValue={editing ? number(editing.likes) : undefined} min="0" name="likes" placeholder="0" required type="number" /></label>
              <label><span>Comments</span><input defaultValue={editing ? number(editing.comments) : undefined} min="0" name="comments" placeholder="0" type="number" /></label>
              <label><span>Shares</span><input defaultValue={editing ? number(editing.shares) : undefined} min="0" name="shares" placeholder="0" type="number" /></label>
            </fieldset>

            <div className={styles.labelField}>
              <span>Labels <b>required</b></span>
              {selectedLabels.length ? <div className={styles.selectedLabels}>{selectedLabels.map((value) => <span key={value}>{value}<button aria-label={`Remove label ${value}`} onClick={() => setSelectedLabels((current) => current.filter((item) => item !== value))} type="button">x</button></span>)}</div> : null}
              <div className={styles.labelInputRow}>
                <input aria-invalid={labelMissing || undefined} className={labelMissing ? styles.invalid : undefined} onChange={(event) => setLabelDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addLabel(labelDraft); } }} placeholder="Pick or create a label..." ref={labelInput} value={labelDraft} />
                <Button onClick={() => addLabel(labelDraft)} size="sm" type="button" variant="outline">Add label</Button>
              </div>
              {labelOptions.some((value) => !selectedLabels.includes(value)) ? <div className={styles.labelSuggestions}>{labelOptions.filter((value) => !selectedLabels.includes(value) && (!labelDraft || value.toLowerCase().includes(labelDraft.toLowerCase()))).slice(0, 8).map((value) => <button onClick={() => addLabel(value)} type="button" key={value}><i className="ti ti-tag" /> {value}</button>)}</div> : null}
            </div>

            <label className={styles.field}><span>Notes <small>optional</small></span><input defaultValue={text(editing?.notes)} name="notes" placeholder="Why this content stands out..." /></label>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            {confirmDiscard ? (
              <div className={styles.discardBar} role="alertdialog" aria-label="Discard unsaved changes">
                <span>Discard unsaved changes?</span>
                <Button onClick={() => setConfirmDiscard(false)} ref={keepEditing} size="sm" type="button" variant="outline">Keep editing</Button>
                <Button onClick={closeAdd} size="sm" type="button">Discard changes</Button>
              </div>
            ) : null}
            <DialogFooter className={styles.dialogFooter}>
              <Button disabled={busy} onClick={requestCloseAdd} type="button" variant="outline">Cancel</Button>
              <Button disabled={busy} type="submit">{busy ? "Saving..." : editing ? "Save content" : "Add content"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className={styles.previewDialog} showCloseButton={false}>
          {selected ? <ContentPreview onClose={closePreview} row={selected} imageIndex={selectedImage} setImageIndex={setSelectedImage}>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {confirmDelete ? (
              <div className={styles.confirmDelete} role="alertdialog" aria-label="Confirm delete content">
                <span>Delete this content? This cannot be undone.</span>
                <Button disabled={busy} onClick={() => setConfirmDelete(false)} ref={cancelDelete} size="sm" type="button" variant="outline">Cancel</Button>
                <Button disabled={busy} onClick={removeSelected} size="sm" type="button" variant="destructive">{busy ? "Deleting..." : "Yes, delete content"}</Button>
              </div>
            ) : (
              <div className={styles.previewActions}>
                {selected.link ? <Button asChild size="sm" variant="outline"><a href={text(selected.link)} rel="noreferrer" target="_blank"><i className="ti ti-external-link" /> Open content link</a></Button> : null}
                <Button disabled={busy} onClick={() => openEdit(selected)} size="sm" type="button" variant="outline"><i className="ti ti-pencil" /> Edit content</Button>
                <Button className={styles.deleteButton} disabled={busy} onClick={() => setConfirmDelete(true)} size="sm" type="button" variant="ghost"><i className="ti ti-trash" /> Delete content</Button>
              </div>
            )}
          </ContentPreview> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Keeps a legacy value (e.g. an old platform name) selectable when editing. */
function withCurrent(options: string[], current: unknown) {
  const value = text(current);
  return value && !options.includes(value) ? [...options, value] : options;
}

function ContentPreview({ row, imageIndex, setImageIndex, onClose, children }: { row: ApiRecord; imageIndex: number; setImageIndex: (value: number) => void; onClose: () => void; children: ReactNode }) {
  const images = rowImages(row.storage_paths);
  const icon = PLATFORM_ICONS[text(row.platform)] || "ti-world";
  const title = `${text(row.platform) || "Content"} ${text(row.jenis)}`.trim();
  const step = (delta: number) => setImageIndex((imageIndex + delta + images.length) % images.length);
  return (
    <div className={`${styles.previewLayout} ${images.length ? "" : styles.previewNoMedia}`} onKeyDown={(event) => { if (images.length > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); step(event.key === "ArrowLeft" ? -1 : 1); } }}>
      <button aria-label="Close" className={styles.previewClose} onClick={onClose} type="button"><i aria-hidden="true" className="ti ti-x" /></button>
      {images.length ? (
        <div className={styles.previewMediaColumn}>
          <div className={styles.previewMedia}>
            <StorageImage area="design-assets" fit="contain" key={images[imageIndex]} label={`${title}, image ${imageIndex + 1} of ${images.length}`} objectKey={images[imageIndex]} />
            {images.length > 1 ? <><button aria-label="Previous image" className={styles.previousImage} onClick={() => step(-1)} type="button"><i aria-hidden="true" className="ti ti-chevron-left" /></button><button aria-label="Next image" className={styles.nextImage} onClick={() => step(1)} type="button"><i aria-hidden="true" className="ti ti-chevron-right" /></button><span aria-live="polite">{imageIndex + 1} / {images.length}</span></> : null}
          </div>
          {images.length > 1 ? (
            <div className={styles.previewThumbs}>
              {images.map((key, index) => <button aria-current={index === imageIndex || undefined} aria-label={`Show image ${index + 1}`} key={key} onClick={() => setImageIndex(index)} type="button"><StorageImage area="design-assets" label={`Image ${index + 1}`} objectKey={key} /></button>)}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={styles.previewInfo}>
        <DialogHeader className={styles.previewHeader}>
          <DialogTitle><i aria-hidden="true" className={`ti ${icon}`} /> {text(row.platform) || "Content"}</DialogTitle>
          <DialogDescription>{text(row.jenis) || "Content Library"}</DialogDescription>
        </DialogHeader>
        <div className={styles.previewBody}>
          <div className={styles.previewMetrics}>
            <span><i aria-hidden="true" className="ti ti-eye" /> <strong>{number(row.views).toLocaleString("en-US")}</strong> Views</span>
            <span><i aria-hidden="true" className="ti ti-heart" /> <strong>{number(row.likes).toLocaleString("en-US")}</strong> Likes</span>
            <span><i aria-hidden="true" className="ti ti-message" /> <strong>{number(row.comments).toLocaleString("en-US")}</strong> Comments</span>
            <span><i aria-hidden="true" className="ti ti-share" /> <strong>{number(row.shares).toLocaleString("en-US")}</strong> Shares</span>
          </div>
          {rowLabels(row.labels).length ? <div className={styles.previewLabels}>{rowLabels(row.labels).map((value) => <span key={value}>{value}</span>)}</div> : null}
          {row.copywriting ? <section className={styles.previewSection}><h3>Copywriting</h3><p className={styles.previewCopy}>{text(row.copywriting)}</p></section> : null}
          {row.notes ? <section className={styles.previewSection}><h3>Notes</h3><p className={styles.previewNotes}>{text(row.notes)}</p></section> : null}
        </div>
        <div className={styles.previewFooter}>{children}</div>
      </div>
    </div>
  );
}
