"use client";

import { createManagedRecord } from "@/app/actions/record-actions";
import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import styles from "../record-manager.module.css";

type ParsedPainPoint = {
  komentar?: string;
  platform?: string;
  kategori?: string;
  username?: string;
};

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Could not read image."));
    reader.readAsDataURL(file);
  });

  return dataUrl.split(",")[1] || "";
}

export function PainPointAiParser({ categories }: { categories: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedPainPoint>({});
  const [status, setStatus] = useState("Drop, paste, or choose a social-media screenshot.");

  async function parse(file: File) {
    if (!file.type.startsWith("image/")) {
      setStatus("Only image screenshots are supported.");
      return;
    }

    setStatus("Reading screenshot...");
    try {
      const response = await fetch("/api/ai/parse-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: await fileToBase64(file),
          mediaType: file.type,
          categories,
        }),
      });
      const payload = (await response.json()) as ParsedPainPoint & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not parse screenshot.");
      setParsed(payload);
      setStatus("Parsed. Review the fields before saving.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Screenshot parsing failed.");
    }
  }

  function getClipboardImage(event: ClipboardEvent<HTMLDivElement>) {
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (image) {
      event.preventDefault();
      void parse(image);
    }
  }

  function getDroppedImage(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const image = Array.from(event.dataTransfer.files).find((file) => file.type.startsWith("image/"));
    if (image) void parse(image);
  }

  return (
    <details className={styles.createPanel} open>
      <summary><i className="ti ti-photo-ai" aria-hidden="true" /> Parse screenshot with AI</summary>
      <div
        className={styles.aiDropzone}
        tabIndex={0}
        onPaste={getClipboardImage}
        onDragOver={(event) => event.preventDefault()}
        onDrop={getDroppedImage}
      >
        <button className={styles.uploadButton} type="button" onClick={() => inputRef.current?.click()}>
          <i className="ti ti-camera" aria-hidden="true" /> Choose screenshot
        </button>
        <input
          className={styles.fileInput}
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void parse(file);
          }}
        />
        <span>{status}</span>
      </div>
      <form action={createManagedRecord.bind(null, "pain_points")} className={styles.formGrid}>
        <label className={styles.field}><span>Comment</span><textarea name="komentar" required rows={3} value={parsed.komentar || ""} onChange={(event) => setParsed({ ...parsed, komentar: event.target.value })} /></label>
        <label className={styles.field}><span>Platform</span><input name="platform" required value={parsed.platform || ""} onChange={(event) => setParsed({ ...parsed, platform: event.target.value })} /></label>
        <label className={styles.field}><span>Category</span><input name="kategori" list="pain-point-categories" required value={parsed.kategori || ""} onChange={(event) => setParsed({ ...parsed, kategori: event.target.value })} /><datalist id="pain-point-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist></label>
        <label className={styles.field}><span>Username</span><input name="username" value={parsed.username || ""} onChange={(event) => setParsed({ ...parsed, username: event.target.value })} /></label>
        <label className={styles.field}><span>Month</span><input name="bulan" placeholder="YYYY-MM" /></label>
        <label className={styles.field}><span>Source URL</span><input name="source_url" /></label>
        <input name="notes" type="hidden" value="" />
        <input name="labels" type="hidden" value="[]" />
        <button className={styles.primaryButton} type="submit">Save pain point</button>
      </form>
    </details>
  );
}
