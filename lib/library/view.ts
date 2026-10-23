// Design Assets / Resources / Collaborators list rules (IJIS layout, Oct 2026). Pure: tested under `node --test`.

type Row = Record<string, unknown>;
const text = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

/** JSON array, real array or comma list → strings. */
export function listOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean); } catch { /* comma list */ }
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}
export function arrayOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
}
export const plural = (count: number, noun: string, many = `${noun}s`) => `${count} ${count === 1 ? noun : many}`;
export function initials(value: unknown) { return text(value || "?").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?"; }

// ---------- Resources ----------
export const isCredential = (row: Row) => text(row.tipe) === "credential";
export type ResourceFilter = { query?: string; kind?: "" | "link" | "credential"; category?: string };
export function filterResources<T extends Row>(rows: T[], f: ResourceFilter): T[] {
  const q = text(f.query).toLowerCase();
  return rows.filter((row) => {
    if (q && !`${text(row.kategori)} ${text(row.nama)} ${text(row.url)} ${text(row.email)} ${text(row.username)} ${text(row.notes)}`.toLowerCase().includes(q)) return false;
    if (f.kind === "credential" && !isCredential(row)) return false;
    if (f.kind === "link" && isCredential(row)) return false;
    if (f.category && (text(row.kategori) || "Other") !== f.category) return false;
    return true;
  });
}
/** Category order: alphabetical; inside a category by `urutan`. */
export function sortResources<T extends Row>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (text(a.kategori) || "Other").localeCompare(text(b.kategori) || "Other") || Number(a.urutan || 0) - Number(b.urutan || 0));
}
export function groupResources<T extends Row>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  rows.forEach((row) => { const key = text(row.kategori) || "Other"; map.set(key, [...(map.get(key) || []), row]); });
  return [...map.entries()];
}
/** Swap a resource with its neighbour inside the same category; returns null when it cannot move. */
export function moveResource<T extends Row>(rows: T[], id: string, direction: -1 | 1): T[] | null {
  const index = rows.findIndex((row) => String(row.id) === id);
  if (index < 0) return null;
  const category = text(rows[index].kategori) || "Other";
  const peers = rows.map((row, position) => ({ row, position })).filter(({ row }) => (text(row.kategori) || "Other") === category);
  const at = peers.findIndex(({ position }) => position === index);
  const target = peers[at + direction]?.position;
  if (target === undefined) return null;
  const next = [...rows]; [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function hostOf(url: unknown) { const value = text(url); if (!value) return ""; try { return new URL(/^https?:/i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, ""); } catch { return value.replace(/^https?:\/\//i, "").split("/")[0]; } }
export function hrefOf(url: unknown) { const value = text(url); return !value ? "" : /^https?:\/\//i.test(value) ? value : `https://${value}`; }

// ---------- Collaborators ----------
export const kindOf = (row: Row): "collaborator" | "advisor" => (text(row.tipe) === "advisor" ? "advisor" : "collaborator");
export function filterPeople<T extends Row>(rows: T[], kind: "collaborator" | "advisor", query = "", status = ""): T[] {
  const q = text(query).toLowerCase();
  return rows.filter((row) => kindOf(row) === kind
    && (!q || `${text(row.nama)} ${text(row.background)} ${text(row.catatan)} ${text(row.status)} ${listOf(row.kewajiban).join(" ")}`.toLowerCase().includes(q))
    && (!status || (status === "privy-missing" ? !row.privy : text(row.status) === status)));
}
export function peopleSummary(rows: Row[]) {
  const collaborators = rows.filter((row) => kindOf(row) === "collaborator");
  return { collaborators: collaborators.length, advisors: rows.length - collaborators.length, privyMissing: collaborators.filter((row) => !row.privy).length };
}
/** Services stored as [{label, rate}] or strings → display pairs. */
export function services(value: unknown): { label: string; rate: string }[] {
  return arrayOf(value).map((item) => (typeof item === "object" && item ? { label: text((item as Row).label), rate: text((item as Row).rate) } : { label: text(item), rate: "" })).filter((item) => item.label || item.rate);
}
