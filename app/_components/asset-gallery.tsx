"use client";

import { sendDesignAssetToLibraryAction } from "@/app/actions/asset-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useState, useTransition } from "react";
import { StorageImage } from "./storage-image";
import styles from "../record-manager.module.css";

type Props = { rows: ApiRecord[]; titleField: string; categoryField?: string; imageFields: string[]; canSendToLibrary?: boolean };

function firstImage(row: ApiRecord, fields: string[]) {
  for (const field of fields) {
    const value = row[field];
    if (Array.isArray(value) && value.length) return String(value[0]);
    if (typeof value === "string" && value) return value;
  }
  return "";
}

export function AssetGallery({ rows, titleField, categoryField, imageFields, canSendToLibrary = false }: Props) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = useMemo(() => rows.filter((row) => !query || `${row[titleField]} ${categoryField ? row[categoryField] : ""}`.toLowerCase().includes(query.toLowerCase())), [rows, query, titleField, categoryField]);
  function sendToLibrary(id: string) {
    setMessage("");
    startTransition(async () => {
      try {
        await sendDesignAssetToLibraryAction(id);
        setMessage("Asset added to the content library.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Asset could not be copied.");
      }
    });
  }
  return <div className={styles.toolStack}><div className={styles.filterBar}><input placeholder="Search gallery" value={query} onChange={(event) => setQuery(event.target.value)} />{message ? <span className={styles.formMessage}>{message}</span> : null}</div><div className={styles.galleryGrid}>{visible.map((row) => { const image = firstImage(row, imageFields); return <article key={String(row.id)}>{image ? <StorageImage objectKey={image} label={String(row[titleField] || "Asset")} /> : <div className={styles.storageImage}><i className="ti ti-photo-off" /></div>}<div><strong>{String(row[titleField] || "Untitled")}</strong>{categoryField ? <span>{String(row[categoryField] || "Uncategorized")}</span> : null}{canSendToLibrary ? <button className={styles.secondaryButton} disabled={pending} onClick={() => sendToLibrary(String(row.id))} type="button"><i className="ti ti-library-plus" /> Add to library</button> : null}</div></article>; })}</div></div>;
}
