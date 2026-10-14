"use client";

import { sendDesignAssetToLibraryAction } from "@/app/actions/asset-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import { recordDefinitions, type RecordDefinitionKey } from "@/lib/records/catalog";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { notify, notifyError } from "./app-dialog";
import { normalizeObjectKey, StorageImage } from "./storage-image";
import { FilterBar, filterFieldClass } from "./ui-kit";
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
function plural(count: number, noun: string) { return `${count} ${noun}${count === 1 ? "" : "s"}`; }

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

const fieldClass = "h-9 rounded-md border border-input bg-white px-2.5 text-sm text-foreground";
function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`grid gap-1 text-xs font-medium text-foreground ${wide ? "sm:col-span-2" : ""}`}>
      <span>{label}{required ? <span aria-hidden="true" className="text-[var(--red)]"> *</span> : null}</span>
      {children}
    </label>
  );
}

export function AssetGallery({ rows, titleField, categoryField, imageFields, definitionKey, canSendToLibrary = false, upload, manage }: Props) {
  const [tab, setTab] = useState<"gallery" | "manage">("gallery");
  const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [secondary, setSecondary] = useState(""); const [label, setLabel] = useState(""); const [sort, setSort] = useState("newest");
  const [transferId, setTransferId] = useState(""); const [selectedId, setSelectedId] = useState(""); const [imageIndex, setImageIndex] = useState(0); const [pending, startTransition] = useTransition();
  const categories = categoryField ? [...new Set(rows.map((row) => String(row[categoryField] || "Uncategorized")))].sort() : [];
  const secondaryField = rows.some((row) => row.jenis) ? "jenis" : rows.some((row) => row.tipe) ? "tipe" : ""; const secondaryOptions = secondaryField ? [...new Set(rows.map((row) => String(row[secondaryField] || "Unknown")))].sort() : []; const labelOptions = [...new Set(rows.flatMap((row) => labels(row.labels)))].sort();
  const visible = useMemo(() => rows.filter((row) => (!query || `${row[titleField]} ${categoryField ? row[categoryField] : ""} ${row.copywriting || ""}`.toLowerCase().includes(query.toLowerCase())) && (!category || String(categoryField ? row[categoryField] : "") === category) && (!secondary || String(row[secondaryField]) === secondary) && (!label || labels(row.labels).includes(label))).sort((a, b) => sort === "likes" ? Number(b.likes || 0) - Number(a.likes || 0) : sort === "views" ? Number(b.views || 0) - Number(a.views || 0) : String(b.created_at || "").localeCompare(String(a.created_at || ""))), [rows, query, category, secondary, label, sort, titleField, categoryField, secondaryField]);
  const fieldLabel = useMemo(() => {
    const fields = definitionKey ? (recordDefinitions[definitionKey].fields as readonly { name: string; label: string }[]) : [];
    const map = new Map(fields.map((field) => [field.name, field.label]));
    return (key: string) => map.get(key) || humanize(key);
  }, [definitionKey]);

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
    if (tab !== "gallery" || !rows.some((row) => String(row.id) === id)) return;
    setQuery(""); setCategory(""); setSecondary(""); setLabel("");
    openDetail(id);
    return true;
  });

  const groups = useMemo(() => {
    if (!categoryField) return [["All", visible]] as [string, ApiRecord[]][];
    const map = new Map<string, ApiRecord[]>();
    visible.forEach((row) => { const key = String(row[categoryField] || "Uncategorized"); map.set(key, [...(map.get(key) || []), row]); });
    return [...map.entries()];
  }, [visible, categoryField]);

  const details = selected ? Object.entries(selected).filter(([key, value]) => !HIDDEN_FIELDS.has(key) && key !== titleField && key !== categoryField && !imageFields.includes(key) && !isEmpty(value)) : [];
  const selectedTitle = selected ? String(selected[titleField] || "Untitled") : "";

  return (
    <div className="grid gap-3.5">
      <Tabs onValueChange={(value) => setTab(value as typeof tab)} value={tab}>
        <TabsList variant="line"><TabsTrigger value="gallery">Gallery</TabsTrigger><TabsTrigger value="manage">Manage data</TabsTrigger></TabsList>
        <TabsContent value="gallery">
          <div className="grid gap-3.5">
            {upload}
            <FilterBar>
              <input aria-label="Search gallery" className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Search gallery" value={query} />
              {categoryField ? <select aria-label="Category" className={filterFieldClass} onChange={(event) => setCategory(event.target.value)} value={category}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select> : null}
              {secondaryField ? <select aria-label="Type" className={filterFieldClass} onChange={(event) => setSecondary(event.target.value)} value={secondary}><option value="">All types</option>{secondaryOptions.map((value) => <option key={value}>{value}</option>)}</select> : null}
              {labelOptions.length ? <select aria-label="Label" className={filterFieldClass} onChange={(event) => setLabel(event.target.value)} value={label}><option value="">All labels</option>{labelOptions.map((value) => <option key={value}>{value}</option>)}</select> : null}
              <select aria-label="Sort" className={filterFieldClass} onChange={(event) => setSort(event.target.value)} value={sort}><option value="newest">Newest</option><option value="likes">Most liked</option><option value="views">Most viewed</option></select>
            </FilterBar>
            {visible.length ? groups.map(([groupName, items]) => (
              <section aria-label={categoryField ? groupName : "Gallery"} key={groupName}>
                {categoryField ? <h3 className="mb-2 flex items-center gap-2"><i aria-hidden="true" className="ti ti-folder text-[var(--purple-accent)]" /><strong className="text-[13px] font-bold">{groupName}</strong><span className="text-[11px] font-normal text-muted-foreground">{plural(items.length, "item")}</span></h3> : null}
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {items.map((row) => {
                    const rowImages = images(row, imageFields);
                    const title = String(row[titleField] || "Untitled");
                    return (
                      <Card className="min-w-0 gap-0 overflow-hidden p-0" data-record-id={String(row.id)} key={String(row.id)}>
                        <button aria-label={`Open ${title}`} className="relative block aspect-square w-full overflow-hidden bg-[var(--bg)]" data-record-open onClick={() => openDetail(String(row.id))} type="button">
                          {rowImages[0] ? <StorageImage area="design-assets" className="h-full" label={title} objectKey={rowImages[0]} /> : <div className="grid h-full w-full place-items-center"><i aria-hidden="true" className="ti ti-photo-off text-2xl text-muted-foreground" /></div>}
                          {rowImages.length > 1 ? <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white"><i aria-hidden="true" className="ti ti-library-photo" /> {rowImages.length}</span> : null}
                        </button>
                        <div className="grid gap-1.5 p-2.5">
                          <strong className="truncate text-xs font-semibold" title={title}>{title}</strong>
                          <div className="flex flex-wrap gap-1">
                            {categoryField ? <span className="rounded bg-[var(--bg)] px-1.5 py-0.5 text-[10px] text-muted-foreground">{String(row[categoryField] || "Uncategorized")}</span> : null}
                            {secondaryField ? <span className="rounded bg-[var(--bg)] px-1.5 py-0.5 text-[10px] text-muted-foreground">{String(row[secondaryField] || "Unknown")}</span> : null}
                            {labels(row.labels).slice(0, 3).map((value) => <span className="rounded bg-[var(--bg)] px-1.5 py-0.5 text-[10px] text-muted-foreground" key={value}>{value}</span>)}
                          </div>
                          {row.likes !== undefined || row.views !== undefined ? <div className="flex gap-2 text-[10px] text-muted-foreground"><span>{Number(row.likes || 0).toLocaleString("en-US")} likes</span><span>{Number(row.views || 0).toLocaleString("en-US")} views</span></div> : null}
                          {row.link || canSendToLibrary ? (
                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border pt-1.5 text-[11px] font-medium">
                              {row.link ? <a className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" href={String(row.link)} rel="noreferrer" target="_blank"><i aria-hidden="true" className="ti ti-external-link" /> Source</a> : <span />}
                              {canSendToLibrary ? <button className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--purple-mid)] hover:underline" disabled={pending} onClick={() => setTransferId(String(row.id))} type="button"><i aria-hidden="true" className="ti ti-library-plus" /> Add to library</button> : null}
                            </div>
                          ) : null}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )) : <div className="grid place-items-center gap-1 py-10 text-center text-muted-foreground"><i aria-hidden="true" className="ti ti-photo-off text-2xl" /><strong className="text-foreground">No matching assets</strong><span className="text-xs">Try another search or clear the filters.</span></div>}
          </div>
        </TabsContent>
        <TabsContent value="manage">{manage}</TabsContent>
      </Tabs>

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
            <DialogFooter className="mt-4 border-t border-border px-5 py-3">
              <Button onClick={() => setSelectedId("")} type="button" variant="outline">Close</Button>
              {selected.link ? <Button asChild variant="outline"><a href={String(selected.link)} rel="noreferrer" target="_blank"><i aria-hidden="true" className="ti ti-external-link" /> Open source</a></Button> : null}
              {canSendToLibrary ? <Button onClick={() => { const id = String(selected.id); setSelectedId(""); setTransferId(id); }} type="button"><i aria-hidden="true" className="ti ti-library-plus" /> Add to library</Button> : null}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog onOpenChange={(open) => { if (!open && !pending) setTransferId(""); }} open={Boolean(transfer)}>
        {transfer ? (
          <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader className="text-left">
              <DialogTitle>Add to content library</DialogTitle>
              <DialogDescription>{String(transfer[titleField] || "Untitled")} is copied into the content library with its images. Fields marked <span className="text-[var(--red)]">*</span> are required.</DialogDescription>
            </DialogHeader>
            <form action={sendToLibrary} className="grid gap-3 sm:grid-cols-2">
              <Field label="Library type" wide><select className={fieldClass} name="tipe"><option value="organic">Organic ideas</option><option value="ads">Ad ideas</option></select></Field>
              <Field label="Platform"><select className={fieldClass} name="platform"><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>LinkedIn</option></select></Field>
              <Field label="Content type"><select className={fieldClass} name="jenis"><option>Carousel</option><option>Reels/Video</option><option>Single Image</option><option>Thread/Text</option></select></Field>
              <Field label="Source URL" required wide><input className={`${fieldClass} invalid:[&:not(:placeholder-shown)]:border-[var(--red)]`} defaultValue={String(transfer.link || "")} name="link" placeholder="https://" required type="url" /></Field>
              <Field label="Likes" required><input className={fieldClass} inputMode="numeric" min="0" name="likes" required type="number" /></Field>
              <Field label="Views"><input className={fieldClass} inputMode="numeric" min="0" name="views" type="number" /></Field>
              <Field label="Comments"><input className={fieldClass} inputMode="numeric" min="0" name="comments" type="number" /></Field>
              <Field label="Shares"><input className={fieldClass} inputMode="numeric" min="0" name="shares" type="number" /></Field>
              <Field label="Copywriting" wide><textarea className={`${fieldClass} h-auto min-h-20 py-2`} defaultValue={String(transfer.nama || "")} name="copywriting" /></Field>
              <Field label="Labels" wide><input className={fieldClass} defaultValue={String(transfer.kategori || "")} name="labels" placeholder="Comma-separated" /></Field>
              <Field label="Notes" wide><textarea className={`${fieldClass} h-auto min-h-16 py-2`} defaultValue={String(transfer.notes || "")} name="notes" /></Field>
              <DialogFooter className="sm:col-span-2">
                <Button disabled={pending} onClick={() => setTransferId("")} type="button" variant="outline">Cancel</Button>
                <Button disabled={pending} type="submit">{pending ? "Adding…" : "Add to content library"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
