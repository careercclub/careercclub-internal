"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buildPaletteIndex, hiddenPathPredicate, iconForPath, searchPalette, type PaletteEntry } from "@/lib/navigation/palette-index";
import { recordDefinitions } from "@/lib/records/catalog";
import { moduleChildren } from "@/lib/records/links";
import { MIN_SEARCH_LENGTH, highlightParts, searchTerms, type SearchHit } from "@/lib/search/registry";
import { RECENT_STORAGE_KEY, addRecent, parseRecent, type RecentItem } from "@/lib/search/recent";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { enhancedNavSections } from "../_data/navigation-all";

type PaletteItem =
  | { kind: "page"; key: string; href: string; icon: string; title: string; detail: string; module: string }
  | { kind: "data" | "recent"; key: string; href: string; path: string; icon: string; title: string; detail: string; detailLabel: string; module: string };

function readRecent() {
  try { return parseRecent(window.localStorage.getItem(RECENT_STORAGE_KEY)); } catch { return []; }
}
function writeRecent(list: RecentItem[]) {
  try { window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list)); } catch { /* storage blocked: recent list is optional */ }
}

type DataState = { status: "idle" | "loading" | "done" | "error"; hits: SearchHit[] };

const PAGE_LIMIT_WITH_DATA = 5;
const GROUP_LABEL = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return <>{highlightParts(text, terms).map((part, index) => (part.match ? <strong className="font-semibold text-foreground" key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>))}</>;
}

function pageItem(entry: PaletteEntry): PaletteItem {
  return { kind: "page", key: `page:${entry.path}`, href: entry.path, icon: entry.icon, title: entry.title, detail: entry.path, module: entry.section };
}

export function CommandPalette({ hiddenSlugs = [], isAdmin = false }: { hiddenSlugs?: string[]; isAdmin?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [data, setData] = useState<DataState>({ status: "idle", hits: [] });
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => buildPaletteIndex(enhancedNavSections, Object.values(recordDefinitions), hiddenSlugs, moduleChildren(isAdmin)), [hiddenSlugs, isAdmin]);
  const isHidden = useMemo(() => hiddenPathPredicate(enhancedNavSections, hiddenSlugs), [hiddenSlugs]);
  const trimmed = query.trim();
  const searchingData = trimmed.length >= MIN_SEARCH_LENGTH;

  const pages = useMemo(() => {
    const found = searchPalette(entries, query);
    return (searchingData ? found.slice(0, PAGE_LIMIT_WITH_DATA) : found).map(pageItem);
  }, [entries, query, searchingData]);

  const records = useMemo<PaletteItem[]>(() => (searchingData ? data.hits : [])
    .filter((hit) => !isHidden(hit.path))
    .map((hit) => ({
      kind: "data",
      key: `data:${hit.key}:${hit.id}`,
      href: hit.href,
      path: hit.path,
      icon: iconForPath(enhancedNavSections, hit.path),
      title: hit.title,
      detail: hit.snippet || hit.module,
      detailLabel: hit.snippet ? hit.matchLabel : "",
      module: hit.module,
    })), [data.hits, isHidden, searchingData]);

  // Shown only while the search box is empty, so a returning user can reopen what they had.
  const recents = useMemo<PaletteItem[]>(() => (trimmed ? [] : recent)
    .filter((item) => !isHidden(item.path))
    .map((item) => ({ ...item, kind: "recent", key: `recent:${item.href}`, icon: iconForPath(enhancedNavSections, item.path) })), [recent, isHidden, trimmed]);

  const items = useMemo(() => [...recents, ...pages, ...records], [recents, pages, records]);
  const terms = useMemo(() => searchTerms(query), [query]);

  // One way to open the palette (button, Ctrl+K, Radix): always starts from an empty box
  // with the latest "Recently opened", whichever way it was opened.
  function openPalette() {
    setQuery("");
    setActive(0);
    setData({ status: "idle", hits: [] });
    setRecent(readRecent());
    setOpen(true);
  }
  const shortcut = useRef({ open, openPalette });
  useEffect(() => { shortcut.current = { open, openPalette }; });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (shortcut.current.open) setOpen(false);
        else shortcut.current.openPalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Search data on the server, debounced; an older response never overwrites a newer query.
  useEffect(() => {
    if (!open || trimmed.length < MIN_SEARCH_LENGTH) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setData((current) => ({ status: "loading", hits: current.hits }));
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((result: { hits?: SearchHit[] }) => setData({ status: "done", hits: result.hits || [] }))
        .catch(() => { if (!controller.signal.aborted) setData({ status: "error", hits: [] }); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, trimmed]);

  // Keep the highlighted row visible while arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    if (item.kind !== "page") {
      const next = addRecent(readRecent(), { href: item.href, path: item.path, title: item.title, detail: item.detail, detailLabel: item.detailLabel, module: item.module });
      writeRecent(next);
      setRecent(next);
    }
    setOpen(false);
    router.push(item.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((current) => (items.length ? (current + 1) % items.length : 0)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => (items.length ? (current - 1 + items.length) % items.length : 0)); }
    else if (event.key === "Enter") { event.preventDefault(); go(items[active]); }
  }

  function renderItem(item: PaletteItem, index: number) {
    return (
      <button
        type="button"
        key={item.key}
        id={`palette-option-${index}`}
        role="option"
        aria-selected={index === active}
        tabIndex={-1}
        data-index={index}
        data-kind={item.kind}
        onClick={() => go(item)}
        onMouseMove={() => setActive(index)}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${index === active ? "bg-accent" : ""}`}
      >
        <i className={`ti ${item.icon} text-muted-foreground`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm"><Highlighted terms={terms} text={item.title} /></span>
          <span className="block truncate text-xs text-muted-foreground">{item.kind !== "page" ? <>{item.detailLabel ? `${item.detailLabel}: ` : ""}<Highlighted terms={terms} text={item.detail} /></> : item.detail}</span>
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{item.module}</span>
      </button>
    );
  }

  const dataStatus = !searchingData ? null
    : data.status === "loading" && !records.length ? "Searching records…"
    : data.status === "error" ? "The record search failed. Try again."
    : data.status === "done" && !records.length ? "No matching records."
    : null;

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search anything"
        className="flex h-10 items-center gap-2 rounded-full border bg-background px-3.5 text-sm text-muted-foreground transition-colors hover:border-[var(--border-md)] sm:min-w-[260px]"
      >
        <i className="ti ti-search" aria-hidden="true" />
        <span className="hidden sm:inline">Search anything…</span>
        <kbd className="ml-auto hidden rounded-md border px-1.5 py-0.5 font-sans text-[11px] sm:inline">Ctrl K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(next) => { if (next) openPalette(); else setOpen(false); }}>
        <DialogContent
          guardUnsaved={false}
          showCloseButton={false}
          className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Search anything</DialogTitle>

          <div className="flex items-center gap-2 border-b px-3">
            <i className={`ti ${data.status === "loading" && searchingData ? "ti-loader-2 animate-spin" : "ti-search"} text-muted-foreground`} aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages or data: names, emails, notes…"
              aria-label="Search anything"
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls="palette-listbox"
              aria-autocomplete="list"
              aria-activedescendant={items[active] ? `palette-option-${active}` : undefined}
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-1" ref={listRef}>
            <div aria-label="Search results" id="palette-listbox" role="listbox">
              {recents.length ? (
                <div aria-labelledby="palette-group-recent" role="group">
                  <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <p className={GROUP_LABEL} id="palette-group-recent">Recently opened</p>
                    <button className="text-muted-foreground underline-offset-2 hover:underline" onClick={() => { writeRecent([]); setRecent([]); setActive(0); }} type="button"><span className="text-[10px]">Clear history</span></button>
                  </div>
                  {recents.map((item, index) => renderItem(item, index))}
                </div>
              ) : null}
              {pages.length ? (
                <div aria-labelledby="palette-group-pages" role="group">
                  {searchingData || recents.length ? <p className={`${GROUP_LABEL} px-3 pt-2 pb-1`} id="palette-group-pages">Halaman</p> : <span className="sr-only" id="palette-group-pages">Halaman</span>}
                  {pages.map((item, index) => renderItem(item, recents.length + index))}
                </div>
              ) : null}
              {searchingData && records.length ? (
                <div aria-labelledby="palette-group-data" role="group">
                  <p className={`${GROUP_LABEL} px-3 pt-2 pb-1`} id="palette-group-data">Data</p>
                  {records.map((item, index) => renderItem(item, recents.length + pages.length + index))}
                </div>
              ) : null}
            </div>
            {searchingData && !records.length ? <p className={`${GROUP_LABEL} px-3 pt-2 pb-1`}>Data</p> : null}
            {dataStatus ? <p className="px-3 py-3 text-xs text-muted-foreground" role="status">{dataStatus}</p> : null}
            {!pages.length && !searchingData ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matching pages.</p>
            ) : null}
            {!searchingData && trimmed ? (
              <p className="px-3 pb-2 text-[12px] text-muted-foreground">Type at least {MIN_SEARCH_LENGTH} letters to search records.</p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 border-t px-3 py-2 text-[10px] text-muted-foreground">
            <span className="hidden sm:inline">↑↓ pilih</span><span className="hidden sm:inline">↵ buka</span><span>{pages.length} halaman{searchingData ? ` · ${records.length} data` : ""}</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
