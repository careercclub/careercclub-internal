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

/** Prev/next pager reproducing the legacy `.pagination` control, for Tailwind-based components. */
export function Pagination({ page, totalPages, onChange, className }: { page: number; totalPages: number; onChange: (page: number) => void; className?: string }) {
  if (totalPages <= 1) return null;
  return (
    <div className={cn("flex items-center justify-center gap-2 pt-3", className)}>
      <Button disabled={page <= 0} onClick={() => onChange(Math.max(0, page - 1))} size="icon-sm" type="button" variant="outline"><i className="ti ti-chevron-left" /></Button>
      <span className="text-[11px] text-muted-foreground">Page {page + 1} / {totalPages}</span>
      <Button disabled={page >= totalPages - 1} onClick={() => onChange(Math.min(totalPages - 1, page + 1))} size="icon-sm" type="button" variant="outline"><i className="ti ti-chevron-right" /></Button>
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
      gray: "bg-[#f1efe8] text-[#5f5e5a]",
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
    <Card className={cn("gap-1 p-3.5", className)}>
      <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-xl font-bold" style={tone ? { color: tone } : undefined}>{value}</div>
    </Card>
  );
}

/** Search / select filter bar reproducing the legacy `.filter-bar`. */
export function FilterBar({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-3 flex flex-wrap items-center gap-1.5", className)} {...props} />;
}

export const filterFieldClass = "h-8 max-w-[160px] shrink-0 rounded-full border border-input bg-white px-2.5 text-xs";

/** Pill-shaped toggle button reproducing the legacy `.filter-bar-btn`. */
export function FilterPill({ active, className, ...props }: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-xs font-medium whitespace-nowrap",
        active ? "border-[var(--purple-mid)] bg-[var(--purple-mid)] text-white" : "border-input bg-white text-foreground",
        className
      )}
      {...props}
    />
  );
}
