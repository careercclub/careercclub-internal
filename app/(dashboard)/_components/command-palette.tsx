"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buildPaletteIndex, searchPalette, type PaletteEntry } from "@/lib/navigation/palette-index";
import { recordDefinitions } from "@/lib/records/catalog";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { enhancedNavSections } from "../_data/navigation-all";

export function CommandPalette({ hiddenSlugs = [] }: { hiddenSlugs?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => buildPaletteIndex(enhancedNavSections, Object.values(recordDefinitions), hiddenSlugs), [hiddenSlugs]);
  const results = useMemo(() => searchPalette(entries, query), [entries, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Keep the highlighted row visible while arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(entry: PaletteEntry | undefined) {
    if (!entry) return;
    setOpen(false);
    router.push(entry.path);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((current) => (results.length ? (current + 1) % results.length : 0)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => (results.length ? (current - 1 + results.length) % results.length : 0)); }
    else if (event.key === "Enter") { event.preventDefault(); go(results[active]); }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cari halaman"
        className="hidden items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent sm:flex"
      >
        <i className="ti ti-search" aria-hidden="true" />
        <span>Cari halaman…</span>
        <kbd className="ml-3 rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px]">Ctrl K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setQuery(""); setActive(0); } }}>
        <DialogContent
          showCloseButton={false}
          className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Cari halaman</DialogTitle>

          <div className="flex items-center gap-2 border-b px-3">
            <i className="ti ti-search text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={onInputKeyDown}
              placeholder="Cari halaman, modul, atau master data…"
              aria-label="Cari halaman"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-1" ref={listRef}>
            {results.length ? results.map((entry, index) => (
              <button
                type="button"
                key={entry.path}
                data-index={index}
                onClick={() => go(entry)}
                onMouseMove={() => setActive(index)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${index === active ? "bg-accent" : ""}`}
              >
                <i className={`ti ${entry.icon} text-muted-foreground`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{entry.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{entry.path}</span>
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{entry.section}</span>
              </button>
            )) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Tidak ada halaman yang cocok.</p>
            )}
          </div>

          <div className="flex items-center gap-3 border-t px-3 py-2 text-[10px] text-muted-foreground">
            <span>↑↓ pilih</span><span>↵ buka</span><span>{results.length} halaman</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
