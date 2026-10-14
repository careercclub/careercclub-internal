// Search index for the Ctrl+K palette.
//
// The app already describes its own routes twice: the dashboard navigation covers
// top-level modules, and the record catalog owns every nested route. This builds the
// palette index from both rather than keeping a third list that would drift.
//
// The nav sections and catalog entries are passed in rather than imported so this
// stays free of runtime imports — the fixture test loads it directly under
// `node --test`, and it keeps lib/ from reaching back into app/.

export type PaletteEntry = { path: string; title: string; section: string; icon: string; hint: string };

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
