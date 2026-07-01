"use client";

import { useEffect, useState } from "react";
import styles from "../record-manager.module.css";

type StorageArea = "uploads" | "collaborator-photos" | "design-assets" | "task-attachments";

function normalizeObjectKey(value: string, area?: StorageArea) {
  const key = value.trim();
  if (!key || /^https?:\/\//i.test(key)) return key;
  const withoutLeadingSlash = key.replace(/^\/+/, "");
  if (/^(uploads|collaborator-photos|design-assets|task-attachments)\//.test(withoutLeadingSlash)) {
    return withoutLeadingSlash;
  }
  return area ? `${area}/${withoutLeadingSlash}` : withoutLeadingSlash;
}

export function StorageImage({ objectKey, label, area }: { objectKey: string; label: string; area?: StorageArea }) {
  const normalizedKey = normalizeObjectKey(objectKey, area);
  const [resolved, setResolved] = useState({ key: "", url: "" });
  const url = normalizedKey.startsWith("http")
    ? normalizedKey
    : resolved.key === normalizedKey ? resolved.url : "";
  useEffect(() => {
    if (!normalizedKey || normalizedKey.startsWith("http")) return;
    const controller = new AbortController();
    fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "download", key: normalizedKey }), signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Image unavailable")))
      .then((result: { url?: string }) => setResolved({ key: normalizedKey, url: result.url || "" }))
      .catch(() => {
        if (!controller.signal.aborted) setResolved({ key: normalizedKey, url: "" });
      });
    return () => controller.abort();
  }, [normalizedKey]);
  return <div aria-label={label} className={styles.storageImage} role="img" style={url ? { backgroundImage: `url("${url.replaceAll('"', '%22')}")` } : undefined}>{url ? null : <i className="ti ti-photo-off" aria-hidden="true" />}</div>;
}
