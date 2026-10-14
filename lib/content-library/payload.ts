// Shared rules for Content Library items. Every write path (tambah, edit,
// kirim dari Design Assets) builds its row through these functions so the
// validation stays identical everywhere.

export const MAX_CONTENT_IMAGES = 12;

export type ContentLibraryPayload = {
  tipe: "organic" | "ads";
  platform: string;
  jenis: string;
  link: string;
  copywriting: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  labels: string[];
  notes: string;
};

export function contentType(value: unknown): "organic" | "ads" {
  return String(value || "").toLowerCase() === "ads" ? "ads" : "organic";
}

export function contentLabels(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.map(String) : String(value || "").split(",");
  const result: string[] = [];
  for (const label of raw.map((item) => item.trim()).filter(Boolean)) {
    if (!result.some((item) => item.toLowerCase() === label.toLowerCase())) result.push(label);
  }
  return result;
}

export function nonNegative(value: unknown, field: string): number {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${field} must be 0 or more.`);
  return parsed;
}

export function buildContentLibraryPayload(input: Record<string, unknown>): ContentLibraryPayload {
  const link = String(input.link || "").trim();
  const labels = contentLabels(input.labels);
  if (!link) throw new Error("Content link is required.");
  if (input.likes === "" || input.likes === null || input.likes === undefined) throw new Error("Likes is required.");
  if (!labels.length) throw new Error("Pick or create at least one label.");
  return {
    tipe: contentType(input.tipe),
    platform: String(input.platform || "Instagram"),
    jenis: String(input.jenis || "Carousel"),
    link,
    copywriting: String(input.copywriting || ""),
    views: nonNegative(input.views, "Views"),
    likes: nonNegative(input.likes, "Likes"),
    comments: nonNegative(input.comments, "Comments"),
    shares: nonNegative(input.shares, "Shares"),
    labels,
    notes: String(input.notes || ""),
  };
}

/** Normalises the stored storage_paths column (array, JSON string, or single key). */
export function storedImagePaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [value];
  } catch {
    return [value];
  }
}

/** Only freshly uploaded keys from the design-assets area are accepted as new images. */
export function uploadedImagePaths(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter((key) => key.startsWith("design-assets/")) : [];
}

/**
 * Final image list for an edit: images the user kept (must already belong to
 * this item, so nobody can attach someone else's key) followed by new uploads.
 */
export function resolveEditedImagePaths(existing: unknown, kept: unknown, added: unknown): string[] {
  const current = storedImagePaths(existing);
  const keptList = Array.isArray(kept) ? kept.map(String).filter((key) => current.includes(key)) : [];
  const result: string[] = [];
  for (const key of [...keptList, ...uploadedImagePaths(added)]) {
    if (!result.includes(key)) result.push(key);
  }
  if (result.length > MAX_CONTENT_IMAGES) throw new Error(`Up to ${MAX_CONTENT_IMAGES} images per content.`);
  return result;
}
