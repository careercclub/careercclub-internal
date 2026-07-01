"use client";

import { useEffect, useState } from "react";
import styles from "../record-manager.module.css";

export function StorageImage({ objectKey, label }: { objectKey: string; label: string }) {
  const [url, setUrl] = useState(objectKey.startsWith("http") ? objectKey : "");
  useEffect(() => {
    if (!objectKey || objectKey.startsWith("http")) return;
    const controller = new AbortController();
    fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "download", key: objectKey }), signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Image unavailable")))
      .then((result: { url?: string }) => setUrl(result.url || ""))
      .catch(() => setUrl(""));
    return () => controller.abort();
  }, [objectKey]);
  return <div aria-label={label} className={styles.storageImage} role="img" style={url ? { backgroundImage: `url("${url.replaceAll('"', '%22')}")` } : undefined}>{url ? null : <i className="ti ti-photo-off" aria-hidden="true" />}</div>;
}
