"use client";

import type { StorageArea } from "@/lib/storage/r2";
import { useId, useState } from "react";
import styles from "../record-manager.module.css";

type R2UploadFieldProps = {
  area: StorageArea;
  defaultValue: string;
  name: string;
};

type PresignedUpload = {
  key: string;
  url: string;
};

export function R2UploadField({ area, defaultValue, name }: R2UploadFieldProps) {
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState("");

  async function upload(file: File) {
    setStatus("Preparing upload...");

    try {
      const response = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "upload",
          area,
          filename: file.name,
          contentType: file.type,
        }),
      });

      const payload = (await response.json()) as PresignedUpload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not create upload URL.");

      setStatus("Uploading...");
      const uploadResponse = await fetch(payload.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("R2 rejected the upload.");
      setValue(payload.key);
      setStatus("Uploaded");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <div className={styles.uploadField}>
      <input name={name} value={value} onChange={(event) => setValue(event.target.value)} />
      <label className={styles.uploadButton} htmlFor={inputId}>
        <i className="ti ti-cloud-upload" aria-hidden="true" /> Upload
      </label>
      <input
        className={styles.fileInput}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {status ? <small>{status}</small> : null}
    </div>
  );
}
