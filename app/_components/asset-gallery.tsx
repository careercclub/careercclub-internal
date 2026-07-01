"use client";

import { sendDesignAssetToLibraryAction } from "@/app/actions/asset-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { StorageImage } from "./storage-image";
import { FilterBar, filterFieldClass } from "./ui-kit";

type Props = { rows: ApiRecord[]; titleField: string; categoryField?: string; imageFields: string[]; canSendToLibrary?: boolean; upload?: ReactNode; manage: ReactNode };

function images(row: ApiRecord, fields: string[]) {
  const result: string[] = [];
  for (const field of fields) {
    const value = row[field];
    if (Array.isArray(value)) result.push(...value.map(String).filter(Boolean));
    else if (typeof value === "string" && value) { try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) result.push(...parsed.map(String).filter(Boolean)); else result.push(value); } catch { result.push(value); } }
  }
  return [...new Set(result)];
}
function display(value: unknown) { if (value === null || value === undefined || value === "") return ""; if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(" - "); if (typeof value === "object") return JSON.stringify(value); return String(value); }
function labels(value: unknown) { if (Array.isArray(value)) return value.map(String); if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return value.split(",").map((item) => item.trim()).filter(Boolean); } } return []; }

export function AssetGallery({ rows, titleField, categoryField, imageFields, canSendToLibrary = false, upload, manage }: Props) {
  const [tab, setTab] = useState<"gallery" | "manage">("gallery");
  const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [secondary, setSecondary] = useState(""); const [label, setLabel] = useState(""); const [sort, setSort] = useState("newest"); const [message, setMessage] = useState(""); const [transferId, setTransferId] = useState(""); const [selectedId, setSelectedId] = useState(""); const [imageIndex, setImageIndex] = useState(0); const [pending, startTransition] = useTransition();
  const categories = categoryField ? [...new Set(rows.map((row) => String(row[categoryField] || "Uncategorized")))].sort() : [];
  const secondaryField = rows.some((row) => row.jenis) ? "jenis" : rows.some((row) => row.tipe) ? "tipe" : ""; const secondaryOptions = secondaryField ? [...new Set(rows.map((row) => String(row[secondaryField] || "Unknown")))].sort() : []; const labelOptions = [...new Set(rows.flatMap((row) => labels(row.labels)))].sort();
  const visible = useMemo(() => rows.filter((row) => (!query || `${row[titleField]} ${categoryField ? row[categoryField] : ""} ${row.copywriting || ""}`.toLowerCase().includes(query.toLowerCase())) && (!category || String(categoryField ? row[categoryField] : "") === category) && (!secondary || String(row[secondaryField]) === secondary) && (!label || labels(row.labels).includes(label))).sort((a, b) => sort === "likes" ? Number(b.likes || 0) - Number(a.likes || 0) : sort === "views" ? Number(b.views || 0) - Number(a.views || 0) : String(b.created_at || "").localeCompare(String(a.created_at || ""))), [rows, query, category, secondary, label, sort, titleField, categoryField, secondaryField]);
  function sendToLibrary(formData: FormData) { const id = transferId; setMessage(""); startTransition(async () => { try { await sendDesignAssetToLibraryAction(id, Object.fromEntries(formData.entries())); setMessage("Asset added to the content library."); setTransferId(""); } catch (error) { setMessage(error instanceof Error ? error.message : "Asset could not be copied."); } }); }
  const transfer = rows.find((row) => String(row.id) === transferId); const selected = rows.find((row) => String(row.id) === selectedId); const selectedImages = selected ? images(selected, imageFields) : [];

  const groups = useMemo(() => {
    if (!categoryField) return [["All", visible]] as [string, ApiRecord[]][];
    const map = new Map<string, ApiRecord[]>();
    visible.forEach((row) => { const key = String(row[categoryField] || "Uncategorized"); map.set(key, [...(map.get(key) || []), row]); });
    return [...map.entries()];
  }, [visible, categoryField]);

  return (
    <div className="grid gap-3.5">
      <Tabs onValueChange={(value) => setTab(value as typeof tab)} value={tab}>
        <TabsList variant="line"><TabsTrigger value="gallery">Gallery</TabsTrigger><TabsTrigger value="manage">Manage data</TabsTrigger></TabsList>
        <TabsContent value="gallery">
          <div className="grid gap-3.5">
            {upload}
            <FilterBar>
              <input className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Search gallery" value={query} />
              {categoryField ? <select className={filterFieldClass} onChange={(event) => setCategory(event.target.value)} value={category}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select> : null}
              {secondaryField ? <select className={filterFieldClass} onChange={(event) => setSecondary(event.target.value)} value={secondary}><option value="">All types</option>{secondaryOptions.map((value) => <option key={value}>{value}</option>)}</select> : null}
              {labelOptions.length ? <select className={filterFieldClass} onChange={(event) => setLabel(event.target.value)} value={label}><option value="">All labels</option>{labelOptions.map((value) => <option key={value}>{value}</option>)}</select> : null}
              <select className={filterFieldClass} onChange={(event) => setSort(event.target.value)} value={sort}><option value="newest">Newest</option><option value="likes">Most liked</option><option value="views">Most viewed</option></select>
              {message ? <span className="text-[11px] text-muted-foreground">{message}</span> : null}
            </FilterBar>
            {visible.length ? groups.map(([groupName, items]) => (
              <div key={groupName}>
                {categoryField ? <div className="mb-2 flex items-center gap-2"><i className="ti ti-folder text-[var(--purple-accent)]" /><strong className="text-[13px] font-bold">{groupName}</strong><span className="text-[10px] text-muted-foreground">{items.length} item</span></div> : null}
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {items.map((row) => {
                    const rowImages = images(row, imageFields);
                    return (
                      <Card className="gap-0 overflow-hidden p-0" key={String(row.id)}>
                        <button className="relative block aspect-square w-full overflow-hidden bg-[var(--bg)]" onClick={() => { setSelectedId(String(row.id)); setImageIndex(0); }} type="button">
                          {rowImages[0] ? <StorageImage area="design-assets" label={String(row[titleField] || "Asset")} objectKey={rowImages[0]} /> : <div className="grid h-full w-full place-items-center"><i className="ti ti-photo-off text-2xl text-muted-foreground" /></div>}
                          {rowImages.length > 1 ? <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white"><i className="ti ti-library-photo" /> {rowImages.length}</span> : null}
                        </button>
                        <div className="grid gap-1 p-2.5">
                          <strong className="truncate text-[11px] font-semibold">{String(row[titleField] || "Untitled")}</strong>
                          <div className="flex flex-wrap gap-1">
                            {categoryField ? <span className="rounded bg-[var(--bg)] px-1.5 py-0.5 text-[9px] text-muted-foreground">{String(row[categoryField] || "Uncategorized")}</span> : null}
                            {secondaryField ? <span className="rounded bg-[var(--bg)] px-1.5 py-0.5 text-[9px] text-muted-foreground">{String(row[secondaryField] || "Unknown")}</span> : null}
                            {labels(row.labels).slice(0, 3).map((value) => <span className="rounded bg-[var(--bg)] px-1.5 py-0.5 text-[9px] text-muted-foreground" key={value}>{value}</span>)}
                          </div>
                          {row.likes !== undefined || row.views !== undefined ? <div className="flex gap-2 text-[9px] text-muted-foreground"><span>{Number(row.likes || 0).toLocaleString("id-ID")} likes</span><span>{Number(row.views || 0).toLocaleString("id-ID")} views</span></div> : null}
                          <div className="flex items-center justify-between gap-1.5">
                            {row.link ? <a className="text-[9px] text-[var(--purple-mid)]" href={String(row.link)} rel="noreferrer" target="_blank"><i className="ti ti-external-link" /> Source</a> : <span />}
                            {canSendToLibrary ? <button className="text-[9px] text-[var(--purple-mid)]" disabled={pending} onClick={() => setTransferId(String(row.id))} type="button"><i className="ti ti-library-plus" /> Add to library</button> : null}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )) : <div className="grid place-items-center gap-1 py-10 text-center text-muted-foreground"><i className="ti ti-photo-off text-2xl" /><strong className="text-foreground">No matching assets</strong></div>}
          </div>
        </TabsContent>
        <TabsContent value="manage">{manage}</TabsContent>
      </Tabs>
      {selected ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-5" onMouseDown={() => setSelectedId("")}>
          <Card className="w-full max-w-3xl gap-3 p-4.5" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div><span className="text-[10px] text-muted-foreground">{categoryField ? String(selected[categoryField] || "Uncategorized") : "Gallery item"}</span><h2 className="text-lg font-bold">{String(selected[titleField] || "Untitled")}</h2></div>
              <button onClick={() => setSelectedId("")} type="button"><i className="ti ti-x" /></button>
            </div>
            {selectedImages.length ? (
              <div className="relative overflow-hidden rounded-lg bg-[var(--bg)]">
                <StorageImage area="design-assets" label={String(selected[titleField] || "Asset")} objectKey={selectedImages[imageIndex]} />
                {selectedImages.length > 1 ? (
                  <>
                    <button className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white" onClick={() => setImageIndex((value) => (value - 1 + selectedImages.length) % selectedImages.length)} type="button"><i className="ti ti-chevron-left" /></button>
                    <button className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white" onClick={() => setImageIndex((value) => (value + 1) % selectedImages.length)} type="button"><i className="ti ti-chevron-right" /></button>
                    <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">{imageIndex + 1} / {selectedImages.length}</span>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {Object.entries(selected).filter(([key, value]) => !["id", "created_at", "updated_at", ...imageFields].includes(key) && display(value)).map(([key, value]) => <div className="rounded-lg bg-[var(--bg)] p-2" key={key}><span className="block text-[9px] text-muted-foreground uppercase">{key.replaceAll("_", " ")}</span><strong className="text-[11px] break-words">{display(value)}</strong></div>)}
            </div>
          </Card>
        </div>
      ) : null}
      {transfer ? (
        <Card className="gap-3 p-4">
          <div className="flex items-center justify-between"><div><span className="text-[10px] text-muted-foreground uppercase">Review library entry</span><h3 className="text-sm font-bold">{String(transfer[titleField] || "Untitled")}</h3></div><Button onClick={() => setTransferId("")} size="sm" type="button" variant="outline"><i className="ti ti-x" /> Cancel</Button></div>
          <form action={sendToLibrary} className="grid gap-2.5 sm:grid-cols-2">
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Platform</span><select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="platform"><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>LinkedIn</option></select></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Content type</span><select className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" name="jenis"><option>Carousel</option><option>Reels/Video</option><option>Single Image</option><option>Thread/Text</option></select></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Likes</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" min="0" name="likes" required type="number" /></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Comments</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" min="0" name="comments" type="number" /></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Shares</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" min="0" name="shares" type="number" /></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Views</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" min="0" name="views" type="number" /></label>
            <label className="col-span-full grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Copywriting</span><textarea className="rounded-md border border-input px-2 py-1.5 text-xs font-normal normal-case text-foreground" defaultValue={String(transfer.nama || "")} name="copywriting" /></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Labels</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" defaultValue={String(transfer.kategori || "")} name="labels" /></label>
            <label className="grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Source URL</span><input className="h-9 rounded-md border border-input px-2 text-xs font-normal normal-case text-foreground" defaultValue={String(transfer.link || "")} name="link" /></label>
            <label className="col-span-full grid gap-1 text-[10px] font-semibold text-muted-foreground uppercase"><span>Notes</span><textarea className="rounded-md border border-input px-2 py-1.5 text-xs font-normal normal-case text-foreground" defaultValue={String(transfer.notes || "")} name="notes" /></label>
            <Button className="w-max" disabled={pending} size="sm" type="submit">Add to content library</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
