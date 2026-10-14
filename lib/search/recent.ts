// "Terakhir dibuka" in the Ctrl+K palette: data results the viewer opened recently.
// Kept in the viewer's own browser (a per-person convenience, not shared state).
// Pure helpers so the rules are testable; storage access stays in the component.

export type RecentItem = { href: string; path: string; title: string; detail: string; detailLabel: string; module: string };

export const RECENT_STORAGE_KEY = "ccc:search-recent";
export const RECENT_LIMIT = 5;

/** Newest first, no duplicates (same record opened twice moves to the top), capped. */
export function addRecent(list: RecentItem[], item: RecentItem, limit = RECENT_LIMIT): RecentItem[] {
  return [item, ...list.filter((entry) => entry.href !== item.href)].slice(0, limit);
}

/**
 * Reads stored JSON defensively: anything malformed is dropped instead of breaking the
 * palette, and only same-site paths are kept ("/x", never "//other-site" or "https://").
 */
export function parseRecent(raw: string | null | undefined): RecentItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is RecentItem => Boolean(entry)
      && typeof entry === "object"
      && ["href", "path", "title", "module"].every((key) => typeof (entry as Record<string, unknown>)[key] === "string")
      && /^\/(?!\/)/.test(String((entry as RecentItem).href)))
      .map((entry) => ({ ...entry, detail: String(entry.detail || ""), detailLabel: String(entry.detailLabel || "") }))
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}
