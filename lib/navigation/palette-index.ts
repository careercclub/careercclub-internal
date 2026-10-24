// Search index for the Ctrl+K palette.
//
// The app already describes its own routes twice: the dashboard navigation covers
// top-level modules, and the record catalog owns every nested route. This builds the
// palette index from both rather than keeping a third list that would drift.
//
// The nav sections and catalog entries are passed in rather than imported so this
// stays free of runtime imports — the fixture test loads it directly under
// `node --test`, and it keeps lib/ from reaching back into app/.

import { closeWordIn, expandTerm, groupMatches } from "../search/synonyms.ts";

export type PaletteEntry = { path: string; title: string; section: string; icon: string; hint: string; action?: boolean };

/**
 * Places and actions that are not a page of their own but that people search for by name:
 * "password" should land on the Logins of Resources, "add ticket" should open the form.
 * Each one uses a link the page already understands.
 */
export const PALETTE_SHORTCUTS: ReadonlyArray<PaletteEntry> = [
  { path: "/resources?kind=credential", title: "Resources › Logins", section: "Internal", icon: "ti-lock", hint: "Passwords, logins and accounts the team shares" },
  { path: "/tickets?create=ticket", title: "Add ticket", section: "Actions", icon: "ti-plus", hint: "New ticket request to a division", action: true },
];

export type PaletteNavSection = {
  label: string;
  pages: ReadonlyArray<{ slug: string; title: string; path: string; icon: string; description: string }>;
};

export type PaletteRecord = { path: string; title: string; eyebrow: string; description: string };

/**
 * Hiding a module in Settings hides its sub-pages too, so neither page results nor
 * data results can route someone into a section they turned off. Shared by both.
 */
export function hiddenPathPredicate(sections: ReadonlyArray<PaletteNavSection>, hiddenSlugs: ReadonlyArray<string> = []) {
  const hidden = new Set(hiddenSlugs);
  const hiddenPaths = sections.flatMap((section) => section.pages).filter((page) => hidden.has(page.slug)).map((page) => page.path);
  // "/settings?tab=users" belongs to /settings just like "/settings/x" would.
  return (path: string) => hiddenPaths.some((parent) => path === parent || path.startsWith(`${parent}/`) || path.startsWith(`${parent}?`));
}

/** Icon of the nav module that owns a path (longest matching prefix), for data results. */
export function iconForPath(sections: ReadonlyArray<PaletteNavSection>, path: string, fallback = "ti-file-text") {
  const owner = sections.flatMap((section) => section.pages)
    .filter((page) => path === page.path || path.startsWith(`${page.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return owner?.icon || fallback;
}

export function buildPaletteIndex(
  sections: ReadonlyArray<PaletteNavSection>,
  records: ReadonlyArray<PaletteRecord>,
  hiddenSlugs: ReadonlyArray<string> = [],
  subPages: Readonly<Record<string, ReadonlyArray<{ href: string; label: string }>>> = {},
  shortcuts: ReadonlyArray<PaletteEntry> = PALETTE_SHORTCUTS,
): PaletteEntry[] {
  const navPages = sections.flatMap((section) => section.pages.map((page) => ({ page, section: section.label })));
  const isHidden = hiddenPathPredicate(sections, hiddenSlugs);

  const entries = new Map<string, PaletteEntry>();
  for (const { page, section } of navPages) {
    if (isHidden(page.path)) continue;
    entries.set(page.path, { path: page.path, title: page.title, section, icon: page.icon, hint: page.description });
  }
  // Sub-pages from the sidebar (incl. Settings sections), titled "Module › Page".
  for (const { page, section } of navPages) {
    for (const link of subPages[page.path] || []) {
      if (link.href === page.path || entries.has(link.href) || isHidden(link.href)) continue;
      entries.set(link.href, { path: link.href, title: `${page.title} › ${link.label}`, section, icon: page.icon, hint: link.label });
    }
  }
  // Nav entries are inserted first and win: a module's own page keeps its icon and
  // section rather than the catalog's generic ones.
  for (const record of records) {
    if (entries.has(record.path) || isHidden(record.path)) continue;
    entries.set(record.path, { path: record.path, title: record.title, section: record.eyebrow, icon: "ti-table", hint: record.description });
  }

  // A shortcut appears only next to its own page (a hidden or absent module has no shortcuts).
  for (const shortcut of shortcuts) {
    if (entries.has(shortcut.path) || isHidden(shortcut.path) || !entries.has(shortcut.path.split("?")[0])) continue;
    entries.set(shortcut.path, shortcut);
  }

  return [...entries.values()].sort((a, b) => a.section.localeCompare(b.section) || a.title.localeCompare(b.title));
}

// Lower is better; -1 means no match. Ranking by where the query hit keeps an exact
// title match above an incidental word in some description.
export function scorePaletteEntry(entry: PaletteEntry, query: string) {
  const title = entry.title.toLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (entry.path.toLowerCase().includes(query)) return 3;
  if (entry.section.toLowerCase().includes(query)) return 4;
  if (entry.hint.toLowerCase().includes(query)) return 5;
  // Word by word, with synonyms ("password" → Logins, "tiket" → Tickets), then close spellings.
  const groups = query.split(/\s+/).filter(Boolean).map(expandTerm);
  const rest = `${entry.path} ${entry.section} ${entry.hint}`.toLowerCase();
  if (groups.every((group) => groupMatches(title, group))) return 6;
  if (groups.every((group) => groupMatches(title, group) || groupMatches(rest, group))) return 7;
  if (groups.every((group) => groupMatches(title, group) || groupMatches(rest, group) || closeWordIn(`${title} ${entry.hint}`, group[0]))) return 8;
  return -1;
}

const depth = (path: string) => path.split("/").length;

export function searchPalette(entries: ReadonlyArray<PaletteEntry>, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...entries];
  return entries
    .map((entry) => ({ entry, rank: scorePaletteEntry(entry, trimmed) }))
    .filter((item) => item.rank >= 0)
    // Equal-scoring ties go to the shallower route, so "ticket" offers Tickets
    // before Ticket divisions. Alphabetical order alone gets this backwards.
    .sort((a, b) => a.rank - b.rank
      || depth(a.entry.path) - depth(b.entry.path)
      || a.entry.title.length - b.entry.title.length
      || a.entry.title.localeCompare(b.entry.title))
    .map((item) => item.entry);
}
