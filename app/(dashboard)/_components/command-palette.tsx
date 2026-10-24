"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buildPaletteIndex, hiddenPathPredicate, iconForPath, searchPalette, type PaletteEntry } from "@/lib/navigation/palette-index";
import { recordDefinitions } from "@/lib/records/catalog";
import { moduleChildren } from "@/lib/records/links";
import { MIN_SEARCH_LENGTH, highlightParts, searchTerms, type SearchHit } from "@/lib/search/registry";
import { expandTerm } from "@/lib/search/synonyms";
import { RECENT_STORAGE_KEY, addRecent, parseRecent, type RecentItem } from "@/lib/search/recent";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { enhancedNavSections } from "../_data/navigation-all";

type PaletteItem =
  | { kind: "page"; key: string; href: string; icon: string; title: string; detail: string; module: string; action?: boolean }
  | { kind: "data" | "recent"; key: string; href: string; path: string; icon: string; title: string; detail: string; detailLabel: string; module: string; marks?: string[]; close?: boolean; credential?: boolean };

function readRecent() {
  try { return parseRecent(window.localStorage.getItem(RECENT_STORAGE_KEY)); } catch { return []; }
}
function writeRecent(list: RecentItem[]) {
  try { window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list)); } catch { /* storage blocked: recent list is optional */ }
}

type DataState = { status: "idle" | "loading" | "done" | "error"; hits: SearchHit[] };

const PAGE_LIMIT_WITH_DATA = 5;
const GROUP_LABEL = "flex items-center gap-1.5 px-3 pt-3 pb-1 text-[12px] font-bold text-[var(--text-muted)]";

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return <>{highlightParts(text, terms).map((part, index) => (part.match ? <mark className="rounded-[3px] bg-[var(--purple-light)] px-px font-semibold text-[var(--purple-dark)]" key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>))}</>;
}

function pageItem(entry: PaletteEntry): PaletteItem {
  return { kind: "page", key: `page:${entry.path}`, href: entry.path, icon: entry.icon, title: entry.title, detail: entry.hint || entry.path, module: entry.action ? "Action" : entry.section, action: entry.action };
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-grid min-w-5 place-items-center rounded-md border border-[var(--border-md)] bg-[var(--surface-2)] px-1 font-sans text-[12px] leading-5 text-[var(--text-muted)]">{children}</kbd>;
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
      marks: hit.marks,
      close: hit.close,
      credential: hit.credential,
    })), [data.hits, isHidden, searchingData]);
  // Records grouped by module, modules in the order of their best result.
  const recordGroups = useMemo(() => {
    const groups = new Map<string, PaletteItem[]>();
    for (const item of records) groups.set(item.module, [...(groups.get(item.module) || []), item]);
    return [...groups.entries()].map(([module, list]) => ({ module, icon: list[0].icon, items: list }));
  }, [records]);

  // Shown only while the search box is empty, so a returning user can reopen what they had.
  const recents = useMemo<PaletteItem[]>(() => (trimmed ? [] : recent)
    .filter((item) => !isHidden(item.path))
    .map((item) => ({ ...item, kind: "recent", key: `recent:${item.href}`, icon: iconForPath(enhancedNavSections, item.path) })), [recent, isHidden, trimmed]);

  const items = useMemo(() => [...recents, ...pages, ...recordGroups.flatMap((group) => group.items)], [recents, pages, recordGroups]);
  const terms = useMemo(() => searchTerms(query), [query]);
  // Pages highlight the typed words and their synonyms ("password" also marks "Logins").
  const pageMarks = useMemo(() => [...new Set(terms.flatMap(expandTerm))], [terms]);

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

  const [attempt, setAttempt] = useState(0);
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
  }, [open, trimmed, attempt]);

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
    const isActive = index === active;
    const marks = item.kind === "page" ? pageMarks : item.kind === "data" ? item.marks || terms : terms;
    const icon = item.kind === "data" && item.credential ? "ti-lock" : item.icon;
    return (
      <button
        type="button"
        key={item.key}
        id={`palette-option-${index}`}
        role="option"
        aria-selected={isActive}
        tabIndex={-1}
        data-index={index}
        data-kind={item.kind}
        onClick={() => go(item)}
        onMouseMove={() => setActive(index)}
        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${isActive ? "bg-[var(--surface-2)]" : ""}`}
      >
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg border ${isActive ? "border-[var(--purple-mid)] bg-[var(--purple-light)] text-[var(--purple-dark)]" : "border-[var(--border)] bg-[var(--white)] text-[var(--text-muted)]"}`}>
          <i className={`ti ${icon} text-[16px]`} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[var(--text)]" data-title=""><Highlighted terms={marks} text={item.title} /></span>
          <span className="block truncate text-[12px] text-[var(--text-muted)]">{item.kind !== "page" ? <>{item.detailLabel ? `${item.detailLabel}: ` : ""}<Highlighted terms={marks} text={item.detail} /></> : <Highlighted terms={marks} text={item.detail} />}</span>
        </span>
        {item.kind === "data" && item.credential ? <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 text-[12px] font-semibold text-[var(--text-muted)]">Login</span> : null}
        {item.kind === "data" && item.close ? <span className="shrink-0 rounded-full bg-[var(--amber-bg)] px-2 text-[12px] font-semibold text-[var(--amber)]" title="Spelled differently from what you typed">Close match</span> : null}
        {item.kind === "page" ? <span className="hidden shrink-0 text-[12px] text-[var(--text-muted)] sm:inline">{item.module}</span> : null}
        {item.kind === "recent" ? <span className="hidden shrink-0 text-[12px] text-[var(--text-muted)] sm:inline">{item.module}</span> : null}
        <span aria-hidden="true" className={`hidden shrink-0 sm:inline ${isActive ? "visible" : "invisible"}`}><Kbd>↵</Kbd></span>
      </button>
    );
  }

  const loadingRecords = searchingData && data.status === "loading" && !records.length;
  const failed = searchingData && data.status === "error";
  const nothing = searchingData && data.status === "done" && !records.length && !pages.length;

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
        <kbd className="ml-auto hidden rounded-md border px-1.5 py-0.5 font-sans text-xs sm:inline">Ctrl K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(next) => { if (next) openPalette(); else setOpen(false); }}>
        <DialogContent
          guardUnsaved={false}
          showCloseButton={false}
          className="top-[8px] w-[calc(100%-16px)] max-w-none translate-y-0 gap-0 overflow-hidden p-0 sm:top-[9%] sm:max-w-2xl"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Search anything</DialogTitle>

          <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4">
            <i className={`ti ${data.status === "loading" && searchingData ? "ti-loader-2 animate-spin" : "ti-search"} text-[18px] text-[var(--text-muted)]`} aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages, people, companies, links…"
              aria-label="Search anything"
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls="palette-listbox"
              aria-autocomplete="list"
              aria-activedescendant={items[active] ? `palette-option-${active}` : undefined}
              className="h-13 w-full bg-transparent text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--text-hint)]"
            />
            {query ? <button aria-label="Clear search" className="grid size-7 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]" onClick={() => { setQuery(""); setActive(0); }} type="button"><i aria-hidden="true" className="ti ti-x text-[15px]" /></button> : null}
            <span className="hidden sm:inline-grid"><Kbd>Esc</Kbd></span>
          </div>

          <div className="max-h-[min(62vh,540px)] overflow-y-auto p-1.5" ref={listRef}>
            <div aria-label="Search results" id="palette-listbox" role="listbox">
              {recents.length ? (
                <div aria-labelledby="palette-group-recent" role="group">
                  <div className="flex items-center justify-between pr-3">
                    <p className={GROUP_LABEL} id="palette-group-recent"><i aria-hidden="true" className="ti ti-history" />Recently opened</p>
                    <button className="pt-2 text-[12px] text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text)] hover:underline" onClick={() => { writeRecent([]); setRecent([]); setActive(0); }} type="button">Clear history</button>
                  </div>
                  {recents.map((item, index) => renderItem(item, index))}
                </div>
              ) : null}
              {pages.length ? (
                <div aria-labelledby="palette-group-pages" role="group">
                  <p className={GROUP_LABEL} id="palette-group-pages"><i aria-hidden="true" className="ti ti-layout-sidebar" />{trimmed ? "Pages & actions" : "Pages"}</p>
                  {pages.map((item, index) => renderItem(item, recents.length + index))}
                </div>
              ) : null}
              {searchingData ? recordGroups.map((group, groupIndex) => {
                const offset = recents.length + pages.length + recordGroups.slice(0, groupIndex).reduce((total, previous) => total + previous.items.length, 0);
                const id = `palette-group-data-${groupIndex}`;
                return (
                  <div aria-labelledby={id} key={group.module} role="group">
                    <p className={GROUP_LABEL} id={id}><i aria-hidden="true" className={`ti ${group.icon}`} />{group.module}<span className="font-normal text-[var(--text-hint)]">· {group.items.length}</span></p>
                    {group.items.map((item, index) => renderItem(item, offset + index))}
                  </div>
                );
              }) : null}
            </div>
            {loadingRecords ? (
              <div aria-label="Searching records" className="grid gap-1 px-2.5 py-2" role="status">
                {[0, 1, 2].map((row) => <div className="flex items-center gap-3 py-1" key={row}><span className="size-8 animate-pulse rounded-lg bg-[var(--surface-2)]" /><span className="grid flex-1 gap-1.5"><span className="h-3 w-2/5 animate-pulse rounded bg-[var(--surface-2)]" /><span className="h-2.5 w-3/5 animate-pulse rounded bg-[var(--surface-2)]" /></span></div>)}
              </div>
            ) : null}
            {failed ? (
              <div className="flex items-center justify-between gap-3 px-3 py-3 text-[13px] text-[var(--text-muted)]" role="alert">
                <span>Could not search the records.</span>
                <button className="rounded-full border border-[var(--border-md)] px-3 py-1 text-[12px] font-bold text-[var(--purple-dark)] hover:border-[var(--purple-mid)]" onClick={() => setAttempt((value) => value + 1)} type="button">Try again</button>
              </div>
            ) : null}
            {nothing || (!pages.length && !searchingData && trimmed) ? (
              <div className="grid justify-items-center gap-1 px-6 py-10 text-center" role="status">
                <i aria-hidden="true" className="ti ti-search-off text-[26px] text-[var(--text-hint)]" />
                <p className="m-0 text-[14px] font-semibold text-[var(--text)]">No results for “{trimmed}”</p>
                <p className="m-0 text-[12px] text-[var(--text-muted)]">{searchingData ? "Check the spelling, or try a name, email, company or link." : `Type at least ${MIN_SEARCH_LENGTH} letters to search records too.`}</p>
              </div>
            ) : null}
            {searchingData && data.status === "done" && !records.length && pages.length ? <p className="px-3 pt-2 pb-3 text-[12px] text-[var(--text-muted)]" role="status">No matching records.</p> : null}
            {!searchingData && trimmed && pages.length ? <p className="px-3 pt-2 pb-3 text-[12px] text-[var(--text-muted)]">Type at least {MIN_SEARCH_LENGTH} letters to search records.</p> : null}
          </div>

          <div className="flex items-center gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[12px] text-[var(--text-muted)]">
            <span className="hidden items-center gap-1 sm:inline-flex"><Kbd>↑</Kbd><Kbd>↓</Kbd> Move</span>
            <span className="hidden items-center gap-1 sm:inline-flex"><Kbd>↵</Kbd> Open</span>
            <span className="hidden items-center gap-1 sm:inline-flex"><Kbd>Esc</Kbd> Close</span>
            <span className="ml-auto">{pages.length} page{pages.length === 1 ? "" : "s"}{searchingData ? ` · ${records.length} record${records.length === 1 ? "" : "s"}` : ""}</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
