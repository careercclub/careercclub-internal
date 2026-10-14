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
import { useEffect, useMemo, useRef, useState } from "react";
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
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(number(value));
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
      <header className={styles.header}>
        <h1>Content Library</h1>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Content library type">
        <button aria-selected={activeType === "organic"} className={activeType === "organic" ? styles.activeTab : ""} onClick={() => changeType("organic")} role="tab" type="button"><i className="ti ti-leaf" /> Organic Ideas</button>
        <button aria-selected={activeType === "ads"} className={activeType === "ads" ? styles.activeTab : ""} onClick={() => changeType("ads")} role="tab" type="button"><i className="ti ti-ad-2" /> Ad Ideas</button>
      </div>

      <div className={styles.filterBar}>
        <select aria-label="Filter platform" onChange={(event) => setPlatform(event.target.value)} value={platform}><option value="">Platform</option>{PLATFORMS.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter format" onChange={(event) => { const value = event.target.value; setContentType(value); if (!sort && value) setSort(value === "Reels/Video" ? "views" : "likes"); }} value={contentType}><option value="">Format</option>{CONTENT_TYPES.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter label" onChange={(event) => setLabel(event.target.value)} value={label}><option value="">Label</option>{labelOptions.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Sort content" onChange={(event) => setSort(event.target.value as SortKey)} value={sort}><option value="">Sort by</option><option value="views">Views</option><option value="likes">Likes</option><option value="comments">Comments</option><option value="shares">Shares</option></select>
        <span className={styles.filterSpacer} />
        {notice ? <span className={styles.notice} role="status">{notice}</span> : null}
        <Button className={styles.addButton} onClick={openAdd} size="sm" type="button"><i className="ti ti-plus" /> Add content</Button>
      </div>

      {visibleRows.length ? (
        <div className={styles.gallery}>
          {visibleRows.map((row) => {
            const images = rowImages(row.storage_paths);
            const copy = text(row.copywriting);
            const icon = PLATFORM_ICONS[text(row.platform)] || "ti-world";
            return (
              <article className={styles.card} data-record-id={text(row.id)} key={text(row.id)}>
                <div className={styles.imageFrame}>
                  <button className={styles.imageButton} onClick={() => { setSelected(row); setSelectedImage(0); }} type="button" aria-label={`Open ${text(row.platform)} ${text(row.jenis)}`}>
                    {images[0] ? <StorageImage area="design-assets" label={`${text(row.platform)} ${text(row.jenis)}`} objectKey={images[0]} /> : <span className={styles.imageEmpty}><i className="ti ti-file-text" /><small>{text(row.jenis)}</small></span>}
                    <span className={styles.platformBadge}><i className={`ti ${icon}`} /> {text(row.platform) || "Platform"}</span>
                    {images.length > 1 ? <span className={styles.imageCount}><i className="ti ti-photo" /> {images.length}</span> : null}
                  </button>
                  {row.link ? <a aria-label="Open content link" className={styles.sourceOverlay} href={text(row.link)} rel="noreferrer" target="_blank"><i className="ti ti-external-link" /></a> : null}
                </div>
                <div className={styles.cardBody}>
                  <strong className={styles.contentKind}>{text(row.jenis) || "Content"}</strong>
                  {rowLabels(row.labels).length ? <div className={styles.labelRow}>{rowLabels(row.labels).map((value) => <span key={value}>{value}</span>)}</div> : null}
                  {copy ? <p>{copy.length > 80 ? `${copy.slice(0, 80)}...` : copy}</p> : null}
                  <div className={styles.metrics}>
                    {number(row.views) ? <span><i className="ti ti-eye" /> {formatNumber(row.views)}</span> : null}
                    {number(row.likes) ? <span><i className="ti ti-heart" /> {formatNumber(row.likes)}</span> : null}
                    {number(row.comments) ? <span><i className="ti ti-message" /> {formatNumber(row.comments)}</span> : null}
                    {number(row.shares) ? <span><i className="ti ti-share" /> {formatNumber(row.shares)}</span> : null}
                  </div>
                </div>
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
        <DialogContent className={styles.previewDialog}>
          {selected ? <ContentPreview row={selected} imageIndex={selectedImage} setImageIndex={setSelectedImage} /> : null}
          {selected && error ? <p className={styles.error} role="alert">{error}</p> : null}
          {selected ? (
            confirmDelete ? (
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
            )
          ) : null}
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

function ContentPreview({ row, imageIndex, setImageIndex }: { row: ApiRecord; imageIndex: number; setImageIndex: (value: number) => void }) {
  const images = rowImages(row.storage_paths);
  const icon = PLATFORM_ICONS[text(row.platform)] || "ti-world";
  return (
    <>
      <DialogHeader className={styles.previewHeader}>
        <DialogTitle><i className={`ti ${icon}`} /> {text(row.platform) || "Content"}</DialogTitle>
        <DialogDescription>{text(row.jenis) || "Content Library"}</DialogDescription>
      </DialogHeader>
      {images.length ? <div className={styles.previewMedia}><StorageImage area="design-assets" label={`${text(row.platform)} ${text(row.jenis)}`} objectKey={images[imageIndex]} />{images.length > 1 ? <><button aria-label="Previous image" className={styles.previousImage} onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)} type="button"><i className="ti ti-chevron-left" /></button><button aria-label="Next image" className={styles.nextImage} onClick={() => setImageIndex((imageIndex + 1) % images.length)} type="button"><i className="ti ti-chevron-right" /></button><span>{imageIndex + 1} / {images.length}</span></> : null}</div> : null}
      {rowLabels(row.labels).length ? <div className={styles.previewLabels}>{rowLabels(row.labels).map((value) => <span key={value}>{value}</span>)}</div> : null}
      {row.copywriting ? <p className={styles.previewCopy}>{text(row.copywriting)}</p> : null}
      <div className={styles.previewMetrics}>
        <span><i className="ti ti-eye" /> <strong>{number(row.views).toLocaleString("id-ID")}</strong> Views</span>
        <span><i className="ti ti-heart" /> <strong>{number(row.likes).toLocaleString("id-ID")}</strong> Likes</span>
        <span><i className="ti ti-message" /> <strong>{number(row.comments).toLocaleString("id-ID")}</strong> Comments</span>
        <span><i className="ti ti-share" /> <strong>{number(row.shares).toLocaleString("id-ID")}</strong> Shares</span>
      </div>
      {row.notes ? <p className={styles.previewNotes}>{text(row.notes)}</p> : null}
    </>
  );
}
