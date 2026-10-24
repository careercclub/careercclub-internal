import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Slices `items` into pages. Framework-agnostic — usable from Tailwind or CSS-module components alike. */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = React.useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = React.useMemo(() => items.slice(safePage * pageSize, safePage * pageSize + pageSize), [items, safePage, pageSize]);
  return { pageItems, page: safePage, setPage, totalPages };
}

/**
 * Long lists show their first `step` items, then "Show N more · M left". One pattern for every
 * gallery, board column and timeline, so a module with hundreds of rows stays a normal page.
 * Give it a `key` built from the filters so a new search starts from the top again.
 */
export function ShowMoreList<T>({ items, step = 24, noun = "", inList = false, children }: { items: T[]; step?: number; noun?: string; inList?: boolean; children: (visible: T[]) => React.ReactNode }) {
  const [count, setCount] = React.useState(step);
  const visible = items.length > count ? items.slice(0, count) : items;
  const left = items.length - visible.length;
  const next = Math.min(step, left);
  const button = left > 0 ? (
    <button className="mx-auto mt-3 flex min-h-9 items-center gap-2 rounded-full border border-[var(--border-md)] bg-[var(--white)] px-4 text-[13px] font-semibold text-[var(--purple-dark)] hover:border-[var(--purple-mid)]" onClick={() => setCount((current) => current + step)} type="button">
      <i aria-hidden="true" className="ti ti-chevron-down" /> Show {next} more{noun ? ` ${noun}` : ""} <span className="font-normal text-[var(--text-muted)]">· {left} left</span>
    </button>
  ) : null;
  return <>{children(visible)}{button ? (inList ? <li className="flex list-none">{button}</li> : button) : null}</>;
}

/** A "?" that holds the longer explanation of a view, so the page keeps one short line (or none). */
export function HelpTip({ label = "How this works", children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span className="relative inline-flex" ref={ref}>
      <button aria-expanded={open} aria-label={label} className="grid size-7 place-items-center rounded-full border border-[var(--border-md)] bg-[var(--white)] text-[13px] font-bold text-[var(--purple-dark)] hover:border-[var(--purple-mid)]" onClick={() => setOpen((value) => !value)} type="button">?</button>
      {open ? <span className="absolute top-9 right-0 z-30 w-[min(300px,80vw)] rounded-xl border border-[var(--border)] bg-[var(--white)] p-3 text-[13px] leading-relaxed text-[var(--text)] shadow-[0_12px_32px_rgba(20,33,44,0.14)]" role="note">{children}</span> : null}
    </span>
  );
}

/** Prev/next pager reproducing the legacy `.pagination` control, for Tailwind-based components. */
export function Pagination({ page, totalPages, onChange, className }: { page: number; totalPages: number; onChange: (page: number) => void; className?: string }) {
  if (totalPages <= 1) return null;
  return (
    <div className={cn("flex items-center justify-center gap-2 pt-3", className)}>
      <Button aria-label="Previous page" disabled={page <= 0} onClick={() => onChange(Math.max(0, page - 1))} size="icon-sm" type="button" variant="outline"><i className="ti ti-chevron-left" /></Button>
      <span className="text-xs text-muted-foreground">Page {page + 1} / {totalPages}</span>
      <Button aria-label="Next page" disabled={page >= totalPages - 1} onClick={() => onChange(Math.min(totalPages - 1, page + 1))} size="icon-sm" type="button" variant="outline"><i className="ti ti-chevron-right" /></Button>
    </div>
  );
}

/** Colored status pill reproducing the legacy `.pill .pill-*` classes, built on shadcn Badge. */
const pillVariants = cva("rounded-full border-0 font-medium", {
  variants: {
    tone: {
      green: "bg-[var(--green-bg)] text-[var(--green)]",
      amber: "bg-[var(--amber-bg)] text-[var(--amber)]",
      purple: "bg-[var(--purple-light)] text-[var(--purple-mid)]",
      blue: "bg-[var(--blue-bg)] text-[var(--blue)]",
      red: "bg-[var(--red-bg)] text-[var(--red)]",
      gray: "bg-[var(--surface-2)] text-[var(--text-muted)]",
      coral: "bg-[var(--coral-bg)] text-[var(--coral)]",
      pink: "bg-[var(--pink-bg)] text-[var(--pink)]",
      teal: "bg-[var(--teal-bg)] text-[var(--teal)]",
    },
  },
  defaultVariants: { tone: "gray" },
});

export function Pill({ tone, className, ...props }: React.ComponentProps<"span"> & VariantProps<typeof pillVariants>) {
  return <Badge className={cn(pillVariants({ tone }), className)} {...props} />;
}

/** Grid of small metric cards reproducing the legacy `.stats-grid` / `.stat-card`. */
export function StatsGrid({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4", className)} {...props} />;
}

export function StatCard({ label, value, tone, className }: { label: string; value: React.ReactNode; tone?: string; className?: string }) {
  return (
    <Card className={cn("gap-1 px-5 py-4", className)}>
      <div className="text-[13px] font-semibold text-muted-foreground">{label}</div>
      <div className="text-[28px] leading-tight font-extrabold tracking-tight" style={tone ? { color: tone } : undefined}>{value}</div>
    </Card>
  );
}

/** Search / select filter bar reproducing the legacy `.filter-bar`. */
export function FilterBar({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-3 flex flex-wrap items-center gap-1.5", className)} {...props} />;
}

export const filterFieldClass = "h-9 max-w-[180px] shrink-0 rounded-full border border-input bg-[var(--white)] px-3 text-[13px]";

/** Pill-shaped toggle button reproducing the legacy `.filter-bar-btn`. */
export function FilterPill({ active, className, ...props }: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap",
        active ? "border-[var(--text)] bg-[var(--text)] text-[var(--white)]" : "border-input bg-[var(--white)] text-foreground",
        className
      )}
      {...props}
    />
  );
}
