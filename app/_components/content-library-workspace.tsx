"use client";

import { createContentLibraryAssetAction } from "@/app/actions/asset-actions";
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
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { StorageImage } from "./storage-image";
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

function rowImages(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [value];
  } catch {
    return [value];
  }
}

function rowType(row: ApiRecord): LibraryType {
  return text(row.tipe).toLowerCase() === "ads" ? "ads" : "organic";
}

function uniqueFiles(current: File[], incoming: File[]) {
  const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const result = [...current];
  for (const file of incoming) {
    if (!file.type.startsWith("image/")) continue;
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!seen.has(key)) {
      result.push(file);
      seen.add(key);
    }
    if (result.length === 12) break;
  }
  return result;
}

export function ContentLibraryWorkspace({ rows }: { rows: ApiRecord[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    function handlePaste(event: ClipboardEvent) {
      if (addOpen || selected) return;
      const pasted = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith("image/"));
      if (!pasted.length) return;
      event.preventDefault();
      setFiles((current) => uniqueFiles(current, pasted));
      setAddOpen(true);
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addOpen, selected]);

  function changeType(value: LibraryType) {
    setActiveType(value);
    setPlatform("");
    setContentType("");
    setLabel("");
    setSort("");
  }

  function openAdd() {
    setFiles([]);
    setSelectedLabels([]);
    setLabelDraft("");
    setError("");
    setAddOpen(true);
  }

  function closeAdd() {
    if (busy) return;
    setAddOpen(false);
    setFiles([]);
    setSelectedLabels([]);
    setLabelDraft("");
    setError("");
  }

  function addFiles(incoming: File[]) {
    setFiles((current) => uniqueFiles(current, incoming));
  }

  function addLabel(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setSelectedLabels((current) => current.some((item) => item.toLowerCase() === clean.toLowerCase()) ? current : [...current, clean]);
    setLabelDraft("");
  }

  async function submit(formData: FormData) {
    const link = text(formData.get("link")).trim();
    const likesRaw = text(formData.get("likes")).trim();
    if (!link) { setError("Link konten wajib diisi."); return; }
    if (!likesRaw) { setError("Likes wajib diisi."); return; }
    if (!selectedLabels.length) { setError("Pilih atau buat minimal satu label."); return; }

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
        if (!preparedResponse.ok || !prepared.key || !prepared.url) throw new Error(prepared.error || "Upload tidak dapat disiapkan.");
        const uploaded = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!uploaded.ok) throw new Error(`Upload gagal untuk ${file.name}.`);
        storagePaths.push(prepared.key);
      }

      await createContentLibraryAssetAction({
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
      });
      setNotice("Konten berhasil ditambahkan.");
      setAddOpen(false);
      setFiles([]);
      setSelectedLabels([]);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Konten gagal disimpan.");
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
        <select aria-label="Filter jenis" onChange={(event) => { const value = event.target.value; setContentType(value); if (!sort && value) setSort(value === "Reels/Video" ? "views" : "likes"); }} value={contentType}><option value="">Jenis</option>{CONTENT_TYPES.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter label" onChange={(event) => setLabel(event.target.value)} value={label}><option value="">Label</option>{labelOptions.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Urutkan konten" onChange={(event) => setSort(event.target.value as SortKey)} value={sort}><option value="">Urutkan</option><option value="views">Views</option><option value="likes">Likes</option><option value="comments">Comments</option><option value="shares">Shares</option></select>
        <span className={styles.filterSpacer} />
        {notice ? <span className={styles.notice}>{notice}</span> : null}
        <Button className={styles.addButton} onClick={openAdd} size="sm" type="button"><i className="ti ti-plus" /> Tambah</Button>
      </div>

      {visibleRows.length ? (
        <div className={styles.gallery}>
          {visibleRows.map((row) => {
            const images = rowImages(row.storage_paths);
            const copy = text(row.copywriting);
            const icon = PLATFORM_ICONS[text(row.platform)] || "ti-world";
            return (
              <article className={styles.card} key={text(row.id)}>
                <div className={styles.imageFrame}>
                  <button className={styles.imageButton} onClick={() => { setSelected(row); setSelectedImage(0); }} type="button" aria-label={`Buka ${text(row.platform)} ${text(row.jenis)}`}>
                    {images[0] ? <StorageImage area="design-assets" label={`${text(row.platform)} ${text(row.jenis)}`} objectKey={images[0]} /> : <span className={styles.imageEmpty}><i className="ti ti-file-text" /><small>{text(row.jenis)}</small></span>}
                    <span className={styles.platformBadge}><i className={`ti ${icon}`} /> {text(row.platform) || "Platform"}</span>
                    {images.length > 1 ? <span className={styles.imageCount}><i className="ti ti-photo" /> {images.length}</span> : null}
                  </button>
                  {row.link ? <a aria-label="Buka link sumber" className={styles.sourceOverlay} href={text(row.link)} rel="noreferrer" target="_blank"><i className="ti ti-external-link" /></a> : null}
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
          <strong>Belum ada konten</strong>
          <span>Klik Tambah atau Ctrl+V untuk tambah konten.</span>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) closeAdd(); else setAddOpen(true); }}>
        <DialogContent className={styles.addDialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle><i className="ti ti-bookmark" /> Tambah Konten</DialogTitle>
            <DialogDescription className="sr-only">Tambah item baru ke Content Library.</DialogDescription>
          </DialogHeader>
          <form action={submit} className={styles.form} onPaste={(event) => { event.stopPropagation(); addFiles([...event.clipboardData.files]); }}>
            {files.length ? (
              <div className={styles.filePreviewArea}>
                {previewUrls.map((url, index) => <div className={styles.filePreview} key={url}><Image alt={`Preview ${index + 1}`} fill sizes="72px" src={url} unoptimized /><button aria-label={`Hapus gambar ${index + 1}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><i className="ti ti-x" /></button></div>)}
                <button className={styles.addMoreFiles} onClick={() => fileInput.current?.click()} type="button"><i className="ti ti-plus" /> Tambah gambar</button>
              </div>
            ) : (
              <button className={styles.dropzone} onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles([...event.dataTransfer.files]); }} type="button">
                <i className="ti ti-photos" />
                <strong>Klik, drag &amp; drop, atau Ctrl+V</strong>
                <span>Screenshot konten, multi-file, opsional</span>
              </button>
            )}
            <input accept="image/*" hidden multiple onChange={(event) => { addFiles([...(event.target.files || [])]); event.target.value = ""; }} ref={fileInput} type="file" />

            <fieldset className={styles.radioGroup}>
              <legend>Tipe konten</legend>
              <label><input defaultChecked={activeType === "organic"} name="tipe" type="radio" value="organic" /> Organic Ideas</label>
              <label><input defaultChecked={activeType === "ads"} name="tipe" type="radio" value="ads" /> Ad Ideas</label>
            </fieldset>

            <div className={styles.twoColumns}>
              <label><span>Platform</span><select name="platform">{PLATFORMS.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Jenis konten</span><select name="jenis">{CONTENT_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>

            <label className={styles.field}><span>Link konten <b>wajib</b></span><input name="link" placeholder="https://..." required /></label>
            <label className={styles.field}><span>Copywriting <small>opsional</small></span><textarea name="copywriting" placeholder="Caption atau teks konten..." rows={3} /></label>

            <fieldset className={styles.engagement}>
              <legend>Engagement</legend>
              <label><span>Views</span><input min="0" name="views" placeholder="0" type="number" /></label>
              <label className={styles.requiredMetric}><span>Likes <b>wajib</b></span><input min="0" name="likes" placeholder="0" required type="number" /></label>
              <label><span>Comments</span><input min="0" name="comments" placeholder="0" type="number" /></label>
              <label><span>Shares</span><input min="0" name="shares" placeholder="0" type="number" /></label>
            </fieldset>

            <div className={styles.labelField}>
              <span>Labels <b>wajib</b></span>
              {selectedLabels.length ? <div className={styles.selectedLabels}>{selectedLabels.map((value) => <span key={value}>{value}<button aria-label={`Hapus label ${value}`} onClick={() => setSelectedLabels((current) => current.filter((item) => item !== value))} type="button">x</button></span>)}</div> : null}
              <div className={styles.labelInputRow}>
                <input onChange={(event) => setLabelDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addLabel(labelDraft); } }} placeholder="Pilih atau buat label..." value={labelDraft} />
                <Button onClick={() => addLabel(labelDraft)} size="sm" type="button" variant="outline">Tambah</Button>
              </div>
              {labelOptions.some((value) => !selectedLabels.includes(value)) ? <div className={styles.labelSuggestions}>{labelOptions.filter((value) => !selectedLabels.includes(value) && (!labelDraft || value.toLowerCase().includes(labelDraft.toLowerCase()))).slice(0, 8).map((value) => <button onClick={() => addLabel(value)} type="button" key={value}><i className="ti ti-tag" /> {value}</button>)}</div> : null}
            </div>

            <label className={styles.field}><span>Notes <small>opsional</small></span><input name="notes" placeholder="Kenapa konten ini menarik..." /></label>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <DialogFooter className={styles.dialogFooter}>
              <Button disabled={busy} onClick={closeAdd} type="button" variant="outline">Batal</Button>
              <Button disabled={busy} type="submit">{busy ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className={styles.previewDialog}>
          {selected ? <ContentPreview row={selected} imageIndex={selectedImage} setImageIndex={setSelectedImage} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
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
      {images.length ? <div className={styles.previewMedia}><StorageImage area="design-assets" label={`${text(row.platform)} ${text(row.jenis)}`} objectKey={images[imageIndex]} />{images.length > 1 ? <><button aria-label="Gambar sebelumnya" className={styles.previousImage} onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)} type="button"><i className="ti ti-chevron-left" /></button><button aria-label="Gambar berikutnya" className={styles.nextImage} onClick={() => setImageIndex((imageIndex + 1) % images.length)} type="button"><i className="ti ti-chevron-right" /></button><span>{imageIndex + 1} / {images.length}</span></> : null}</div> : null}
      {rowLabels(row.labels).length ? <div className={styles.previewLabels}>{rowLabels(row.labels).map((value) => <span key={value}>{value}</span>)}</div> : null}
      {row.copywriting ? <p className={styles.previewCopy}>{text(row.copywriting)}</p> : null}
      <div className={styles.previewMetrics}>
        <span><i className="ti ti-eye" /> <strong>{number(row.views).toLocaleString("id-ID")}</strong> Views</span>
        <span><i className="ti ti-heart" /> <strong>{number(row.likes).toLocaleString("id-ID")}</strong> Likes</span>
        <span><i className="ti ti-message" /> <strong>{number(row.comments).toLocaleString("id-ID")}</strong> Comments</span>
        <span><i className="ti ti-share" /> <strong>{number(row.shares).toLocaleString("id-ID")}</strong> Shares</span>
      </div>
      {row.notes ? <p className={styles.previewNotes}>{text(row.notes)}</p> : null}
      {row.link ? <Button asChild className={styles.openSource} size="sm" variant="outline"><a href={text(row.link)} rel="noreferrer" target="_blank"><i className="ti ti-external-link" /> Buka link konten</a></Button> : null}
    </>
  );
}
