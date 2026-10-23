"use client";

import { sendDesignAssetToLibraryAction } from "@/app/actions/asset-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ApiRecord } from "@/lib/api/_crud";
import { recordDefinitions, type RecordDefinitionKey } from "@/lib/records/catalog";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { notify, notifyError } from "./app-dialog";
import { normalizeObjectKey, StorageImage } from "./storage-image";
import g from "./library.module.css";
import s from "./page-kit.module.css";
import { useRecordFocus } from "./use-record-focus";

type Props = {
  rows: ApiRecord[];
  titleField: string;
  categoryField?: string;
  imageFields: string[];
  /** The catalog table behind the gallery: gives the detail popup its field labels. */
  definitionKey?: RecordDefinitionKey;
  canSendToLibrary?: boolean;
  upload?: ReactNode;
  manage: ReactNode;
  /** Page heading; defaults to the catalog title. */
  title?: string;
};

const HIDDEN_FIELDS = new Set(["id", "created_at", "updated_at", "created_by", "updated_by"]);

/** Every image of a row, once — `storage_path` and `storage_paths` often name the same file in two spellings. */
export function images(row: ApiRecord, fields: string[]) {
  const result: string[] = [];
  for (const field of fields) {
    const value = row[field];
    if (Array.isArray(value)) result.push(...value.map(String).filter(Boolean));
    else if (typeof value === "string" && value) { try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) result.push(...parsed.map(String).filter(Boolean)); else result.push(value); } catch { result.push(value); } }
  }
  const seen = new Set<string>();
  return result.filter((key) => { const id = normalizeObjectKey(key, "design-assets").replace(/^(uploads|collaborator-photos|design-assets|task-attachments)\//, ""); if (seen.has(id)) return false; seen.add(id); return true; });
}
function labels(value: unknown) { if (Array.isArray(value)) return value.map(String); if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return value.split(",").map((item) => item.trim()).filter(Boolean); } } return []; }
function isEmpty(value: unknown) { return value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length); }
function humanize(key: string) { const text = key.replaceAll("_", " "); return text.charAt(0).toUpperCase() + text.slice(1); }
function plural(count: number, noun: string, many = `${noun}s`) { return `${count} ${count === 1 ? noun : many}`; }

function DetailValue({ value }: { value: unknown }) {
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (typeof value === "number") return <>{value.toLocaleString("en-US")}</>;
  if (Array.isArray(value)) return <>{value.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ")}</>;
  if (typeof value === "object" && value) return <>{JSON.stringify(value)}</>;
  const text = String(value);
  if (/^https?:\/\//i.test(text)) {
    const host = (() => { try { return new URL(text).hostname.replace(/^www\./, ""); } catch { return text; } })();
    return (
      <a className="inline-flex max-w-full items-center gap-1 text-[var(--purple-mid)] hover:underline" href={text} rel="noreferrer" target="_blank" title={text}>
        <span className="truncate">{host}{text.length > host.length + 12 ? "/…" : ""}</span>
        <i aria-hidden="true" className="ti ti-external-link shrink-0" />
      </a>
    );
  }
  return <span className="whitespace-pre-line">{text}</span>;
}

const fieldClass = s.input;
function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`${s.field} ${wide ? g.wide : ""}`}>
      <span>{label}{required ? <b aria-hidden="true" className={s.req}> *</b> : null}</span>
      {children}
    </label>
  );
}

export function AssetGallery({ rows, titleField, categoryField, imageFields, definitionKey, canSendToLibrary = false, upload, manage, title }: Props) {
  const [tab, setTab] = useState<"gallery" | "manage">("gallery");
  const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [secondary, setSecondary] = useState(""); const [label, setLabel] = useState(""); const [sort, setSort] = useState("newest");
  const [transferId, setTransferId] = useState(""); const [selectedId, setSelectedId] = useState(""); const [imageIndex, setImageIndex] = useState(0); const [pending, startTransition] = useTransition();
  const definition = definitionKey ? recordDefinitions[definitionKey] : null;
  const categories = categoryField ? [...new Set(rows.map((row) => String(row[categoryField] || "Uncategorized")))].sort() : [];
  const secondaryField = rows.some((row) => row.jenis) ? "jenis" : rows.some((row) => row.tipe) ? "tipe" : ""; const secondaryOptions = secondaryField ? [...new Set(rows.map((row) => String(row[secondaryField] || "Unknown")))].sort() : []; const labelOptions = [...new Set(rows.flatMap((row) => labels(row.labels)))].sort();
  const hasCounts = rows.some((row) => row.likes !== undefined || row.views !== undefined);
  const visible = useMemo(() => rows.filter((row) => (!query || `${row[titleField]} ${categoryField ? row[categoryField] : ""} ${row.copywriting || ""} ${row.notes || ""}`.toLowerCase().includes(query.toLowerCase())) && (!category || String(categoryField ? row[categoryField] || "Uncategorized" : "") === category) && (!secondary || String(row[secondaryField] || "Unknown") === secondary) && (!label || labels(row.labels).includes(label))).sort((a, b) => sort === "likes" ? Number(b.likes || 0) - Number(a.likes || 0) : sort === "views" ? Number(b.views || 0) - Number(a.views || 0) : sort === "name" ? String(a[titleField] || "").localeCompare(String(b[titleField] || "")) : String(b.created_at || "").localeCompare(String(a.created_at || ""))), [rows, query, category, secondary, label, sort, titleField, categoryField, secondaryField]);
  const fieldLabel = useMemo(() => {
    const fields = definitionKey ? (recordDefinitions[definitionKey].fields as readonly { name: string; label: string }[]) : [];
    const map = new Map(fields.map((field) => [field.name, field.label]));
    return (key: string) => map.get(key) || humanize(key);
  }, [definitionKey]);
  const typeLabel = (value: string) => ({ assets: "Asset", references: "Reference" } as Record<string, string>)[value] || value;
  const filtered = Boolean(query || category || secondary || label);

  function sendToLibrary(formData: FormData) {
    const id = transferId;
    startTransition(async () => {
      try { await sendDesignAssetToLibraryAction(id, Object.fromEntries(formData.entries())); notify("Asset added to the content library."); setTransferId(""); }
      catch (error) { notifyError(error, "Could not add the asset to the content library."); }
    });
  }
  const transfer = rows.find((row) => String(row.id) === transferId); const selected = rows.find((row) => String(row.id) === selectedId); const selectedImages = selected ? images(selected, imageFields) : [];
  const openDetail = (id: string) => { setSelectedId(id); setImageIndex(0); };
  const step = (delta: number) => setImageIndex((value) => (value + delta + selectedImages.length) % selectedImages.length);

  // Search result opened: show the asset's detail popup.
  useRecordFocus((id) => {
    if (!rows.some((row) => String(row.id) === id)) return;
    setTab("gallery"); setQuery(""); setCategory(""); setSecondary(""); setLabel("");
    openDetail(id);
    return true;
  });

  const groups = useMemo(() => {
    if (!categoryField) return [["All", visible]] as [string, ApiRecord[]][];
    const map = new Map<string, ApiRecord[]>();
    visible.forEach((row) => { const key = String(row[categoryField] || "Uncategorized"); map.set(key, [...(map.get(key) || []), row]); });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible, categoryField]);

  const details = selected ? Object.entries(selected).filter(([key, value]) => !HIDDEN_FIELDS.has(key) && key !== titleField && key !== categoryField && !imageFields.includes(key) && !isEmpty(value)) : [];
  const selectedTitle = selected ? String(selected[titleField] || "Untitled") : "";
  const imageCount = rows.reduce((sum, row) => sum + images(row, imageFields).length, 0);

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>{definition?.eyebrow || "Library"}</span>
          <h1>{title || definition?.title || "Gallery"}</h1>
          <p>{plural(rows.length, "item")}{categoryField ? ` in ${plural(categories.length, "category", "categories")}` : ""} · {plural(imageCount, "image")}</p>
        </div>
        {upload ? <div className={s.headActions}>{upload}</div> : null}
      </header>

      <div aria-label="Views" className={s.segmented} role="tablist">
        <button aria-selected={tab === "gallery"} className={tab === "gallery" ? s.segmentActive : s.segment} onClick={() => setTab("gallery")} role="tab" type="button"><i className="ti ti-layout-grid" aria-hidden="true" /> Gallery <span>{rows.length}</span></button>
        <button aria-selected={tab === "manage"} className={tab === "manage" ? s.segmentActive : s.segment} onClick={() => setTab("manage")} role="tab" type="button"><i className="ti ti-table" aria-hidden="true" /> Manage data</button>
      </div>

      {tab === "manage" ? manage : (
        <>
          <div className={s.toolbar}>
            <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search gallery" onChange={(event) => setQuery(event.target.value)} placeholder="Search gallery" value={query} /></label>
            {secondaryField ? <label className={s.filterPill}><span>Type</span><select aria-label="Type" onChange={(event) => setSecondary(event.target.value)} value={secondary}><option value="">All</option>{secondaryOptions.map((value) => <option key={value} value={value}>{typeLabel(value)}</option>)}</select></label> : null}
            {labelOptions.length ? <label className={s.filterPill}><span>Label</span><select aria-label="Label" onChange={(event) => setLabel(event.target.value)} value={label}><option value="">All</option>{labelOptions.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
            <label className={s.filterPill}><span>Sort</span><select aria-label="Sort" onChange={(event) => setSort(event.target.value)} value={sort}><option value="newest">Newest</option><option value="name">Name A–Z</option>{hasCounts ? <><option value="likes">Most liked</option><option value="views">Most viewed</option></> : null}</select></label>
          </div>
          {categoryField && categories.length > 1 ? (
            <div className={s.pills} role="group" aria-label="Category">
              {[["", "All categories", rows.length] as const, ...categories.map((value) => [value, value, rows.filter((row) => String(row[categoryField] || "Uncategorized") === value).length] as const)].map(([value, text, count]) => (
                <button aria-pressed={category === value} className={category === value ? s.pillOn : s.pill} key={text} onClick={() => setCategory(value)} type="button">{text} <span>{count}</span></button>
              ))}
            </div>
          ) : null}

          {visible.length ? groups.map(([groupName, items]) => (
            <section aria-label={categoryField ? groupName : "Gallery"} className={g.group} key={groupName}>
              {categoryField ? <header className={g.groupHead}><i aria-hidden="true" className="ti ti-folder" /><h2>{groupName}</h2><span>{plural(items.length, "item")}</span></header> : null}
              <ul className={g.assets}>
                {items.map((row) => {
                  const rowImages = images(row, imageFields);
                  const title = String(row[titleField] || "Untitled");
                  return (
                    <li className={g.asset} data-record-id={String(row.id)} key={String(row.id)}>
                      <button aria-label={`Open ${title}`} className={g.thumb} data-record-open onClick={() => openDetail(String(row.id))} type="button">
                        {rowImages[0] ? <StorageImage area="design-assets" className="h-full" label={title} objectKey={rowImages[0]} /> : <span className={g.noImage}><i aria-hidden="true" className="ti ti-photo-off" /></span>}
                        {rowImages.length > 1 ? <span className={g.multi}><i aria-hidden="true" className="ti ti-library-photo" /> {rowImages.length}</span> : null}
                      </button>
                      <div className={g.assetBody}>
                        <b title={title}>{title}</b>
                        {secondaryField || labels(row.labels).length ? (
                          <div className={g.tags}>
                            {secondaryField ? <span>{typeLabel(String(row[secondaryField] || "Unknown"))}</span> : null}
                            {labels(row.labels).slice(0, 3).map((value) => <span key={value}>{value}</span>)}
                          </div>
                        ) : null}
                        {row.likes !== undefined || row.views !== undefined ? <div className={g.counts}><span><b>{Number(row.likes || 0).toLocaleString("en-US")}</b> likes</span><span><b>{Number(row.views || 0).toLocaleString("en-US")}</b> views</span></div> : null}
                        {row.link || canSendToLibrary ? (
                          <div className={g.assetActions}>
                            {row.link ? <a href={String(row.link)} rel="noreferrer" target="_blank"><i aria-hidden="true" className="ti ti-external-link" /> Source</a> : <span />}
                            {canSendToLibrary ? <button disabled={pending} onClick={() => setTransferId(String(row.id))} type="button"><i aria-hidden="true" className="ti ti-library-plus" /> Add to library</button> : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )) : (
            <div className={s.card}>
              <p className={s.empty}>{rows.length ? "No matching items. Try another search or clear the filters." : "Nothing here yet."}</p>
              {filtered ? <button className={s.ghost} onClick={() => { setQuery(""); setCategory(""); setSecondary(""); setLabel(""); }} style={{ alignSelf: "center" }} type="button">Clear filters</button> : null}
            </div>
          )}
        </>
      )}

      <Dialog onOpenChange={(open) => { if (!open) setSelectedId(""); }} open={Boolean(selected)}>
        {selected ? (
          <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-3xl" onKeyDown={(event) => { if (selectedImages.length > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight") && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); step(event.key === "ArrowLeft" ? -1 : 1); } }}>
            <DialogHeader className="px-5 pt-5 pb-3 text-left">
              {categoryField ? <span className="text-xs text-muted-foreground">{String(selected[categoryField] || "Uncategorized")}</span> : null}
              <DialogTitle className="pr-8 text-lg leading-snug">{selectedTitle}</DialogTitle>
              <DialogDescription className="sr-only">Images and details of {selectedTitle}</DialogDescription>
            </DialogHeader>
            {selectedImages.length ? (
              <div className="px-5">
                <div className="relative overflow-hidden rounded-lg border border-border">
                  <StorageImage area="design-assets" fit="contain" key={selectedImages[imageIndex]} label={`${selectedTitle}, image ${imageIndex + 1} of ${selectedImages.length}`} objectKey={selectedImages[imageIndex]} />
                  {selectedImages.length > 1 ? (
                    <>
                      <button aria-label="Previous image" className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white hover:bg-black/75" onClick={() => step(-1)} type="button"><i aria-hidden="true" className="ti ti-chevron-left" /></button>
                      <button aria-label="Next image" className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white hover:bg-black/75" onClick={() => step(1)} type="button"><i aria-hidden="true" className="ti ti-chevron-right" /></button>
                      <span aria-live="polite" className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">{imageIndex + 1} / {selectedImages.length}</span>
                    </>
                  ) : null}
                </div>
                {selectedImages.length > 1 ? (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {selectedImages.map((key, index) => (
                      <button aria-current={index === imageIndex || undefined} aria-label={`Show image ${index + 1}`} className={`size-14 shrink-0 overflow-hidden rounded-md border-2 ${index === imageIndex ? "border-[var(--purple-mid)]" : "border-transparent opacity-70 hover:opacity-100"}`} key={key} onClick={() => setImageIndex(index)} type="button">
                        <StorageImage area="design-assets" className="h-full !min-h-0" label={`Image ${index + 1}`} objectKey={key} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mx-5 grid place-items-center gap-1 rounded-lg border border-dashed border-border py-8 text-sm text-muted-foreground"><i aria-hidden="true" className="ti ti-photo-off text-2xl" />No images uploaded</div>
            )}
            {details.length ? (
              <dl className="grid gap-x-6 gap-y-3 px-5 pt-4 sm:grid-cols-2">
                {details.map(([key, value]) => (
                  <div className={`min-w-0 ${key === "notes" || key === "deskripsi" ? "sm:col-span-2" : ""}`} key={key}>
                    <dt className="text-xs text-muted-foreground">{fieldLabel(key)}</dt>
                    <dd className="mt-0.5 text-sm font-medium break-words"><DetailValue value={value} /></dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <DialogFooter sticky className="bottom-0 mx-0 mt-4 mb-0 border-t border-border px-5 py-3">
              <Button onClick={() => setSelectedId("")} type="button" variant="outline">Close</Button>
              {selected.link ? <Button asChild variant="outline"><a href={String(selected.link)} rel="noreferrer" target="_blank"><i aria-hidden="true" className="ti ti-external-link" /> Open source</a></Button> : null}
              {canSendToLibrary ? <Button onClick={() => { const id = String(selected.id); setSelectedId(""); setTransferId(id); }} type="button"><i aria-hidden="true" className="ti ti-library-plus" /> Add to library</Button> : null}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog onOpenChange={(open) => { if (!open && !pending) setTransferId(""); }} open={Boolean(transfer)}>
        {transfer ? (
          <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
            <DialogHeader className="border-b border-border px-6 pt-6 pb-4 pr-12 text-left">
              <DialogTitle>Add to content library</DialogTitle>
              <DialogDescription>{String(transfer[titleField] || "Untitled")} is copied into the content library with its images. Fields marked <span className="text-[var(--red)]">*</span> are required.</DialogDescription>
            </DialogHeader>
            <form action={sendToLibrary} className="flex min-h-0 flex-1 flex-col">
              <div className={`${g.formGrid} min-h-0 flex-1 overflow-y-auto px-6 py-4`}>
              <Field label="Library type" wide><select className={fieldClass} name="tipe"><option value="organic">Organic ideas</option><option value="ads">Ad ideas</option></select></Field>
              <Field label="Platform"><select className={fieldClass} name="platform"><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>LinkedIn</option></select></Field>
              <Field label="Content type"><select className={fieldClass} name="jenis"><option>Carousel</option><option>Reels/Video</option><option>Single Image</option><option>Thread/Text</option></select></Field>
              <Field label="Source URL" required wide><input className={fieldClass} defaultValue={String(transfer.link || "")} name="link" placeholder="https://" required type="url" /></Field>
              <Field label="Likes" required><input className={fieldClass} inputMode="numeric" min="0" name="likes" required type="number" /></Field>
              <Field label="Views"><input className={fieldClass} inputMode="numeric" min="0" name="views" type="number" /></Field>
              <Field label="Comments"><input className={fieldClass} inputMode="numeric" min="0" name="comments" type="number" /></Field>
              <Field label="Shares"><input className={fieldClass} inputMode="numeric" min="0" name="shares" type="number" /></Field>
              <Field label="Copywriting" wide><textarea className={`${fieldClass} h-auto min-h-20 py-2`} defaultValue={String(transfer.nama || "")} name="copywriting" /></Field>
              <Field label="Labels" wide><input className={fieldClass} defaultValue={String(transfer.kategori || "")} name="labels" placeholder="Comma-separated" /></Field>
              <Field label="Notes" wide><textarea className={`${fieldClass} h-auto min-h-16 py-2`} defaultValue={String(transfer.notes || "")} name="notes" /></Field>
              </div>
              <DialogFooter className="border-t border-border px-6 py-3">
                <Button disabled={pending} onClick={() => setTransferId("")} type="button" variant="outline">Cancel</Button>
                <Button disabled={pending} type="submit">{pending ? "Adding…" : "Add to library"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
