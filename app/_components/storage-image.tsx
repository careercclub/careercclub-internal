"use client";

import { useEffect, useState } from "react";
import styles from "../record-manager.module.css";

type StorageArea = "uploads" | "collaborator-photos" | "design-assets" | "task-attachments";

export function normalizeObjectKey(value: string, area?: StorageArea) {
  const key = value.trim();
  if (!key || /^https?:\/\//i.test(key)) return key;
  const withoutLeadingSlash = key.replace(/^\/+/, "");
  if (/^(uploads|collaborator-photos|design-assets|task-attachments)\//.test(withoutLeadingSlash)) {
    return withoutLeadingSlash;
  }
  return area ? `${area}/${withoutLeadingSlash}` : withoutLeadingSlash;
}

type Props = {
  objectKey: string;
  label: string;
  area?: StorageArea;
  /** cover (default): fills a thumbnail, cropping the edges. contain: the whole image, letterboxed — for viewers. */
  fit?: "cover" | "contain";
  className?: string;
};

export function StorageImage({ objectKey, label, area, fit = "cover", className }: Props) {
  const normalizedKey = normalizeObjectKey(objectKey, area);
  const [resolved, setResolved] = useState({ key: "", url: "", failed: false });
  const [broken, setBroken] = useState("");
  const direct = normalizedKey.startsWith("http");
  const url = direct ? normalizedKey : resolved.key === normalizedKey ? resolved.url : "";
  const loading = !direct && resolved.key !== normalizedKey;
  const failed = (!direct && resolved.key === normalizedKey && (resolved.failed || !resolved.url)) || (url !== "" && broken === url);

  useEffect(() => {
    if (!normalizedKey || normalizedKey.startsWith("http")) return;
    const controller = new AbortController();
    fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "download", key: normalizedKey }), signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Image unavailable")))
      .then((result: { url?: string }) => setResolved({ key: normalizedKey, url: result.url || "", failed: !result.url }))
      .catch(() => {
        if (!controller.signal.aborted) setResolved({ key: normalizedKey, url: "", failed: true });
      });
    return () => controller.abort();
  }, [normalizedKey]);

  if (fit === "contain") {
    return (
      <div aria-busy={loading || undefined} className={`${styles.storageViewer} ${className || ""}`}>
        {failed ? (
          <div className={styles.storageFailed} role="img" aria-label={`${label}: image could not be loaded`}>
            <i className="ti ti-photo-x" aria-hidden="true" />
            <strong>Image could not be loaded</strong>
            <span>The file may have been moved or deleted.</span>
          </div>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs, not optimisable by next/image
          <img alt={label} onError={() => setBroken(url)} src={url} />
        ) : (
          <div className={styles.storageLoading} aria-label={`Loading ${label}`} role="img" />
        )}
      </div>
    );
  }

  return (
    <div aria-label={failed ? `${label}: image could not be loaded` : label} className={`${styles.storageImage} ${className || ""}`} role="img" style={url && !failed ? { backgroundImage: `url("${url.replaceAll('"', '%22')}")` } : undefined}>
      {url && !failed ? null : <i className={failed ? "ti ti-photo-x" : "ti ti-photo"} aria-hidden="true" />}
    </div>
  );
}
