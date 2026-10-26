"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  current = 1,
  total = 8,
  onChange,
  className,
}: {
  current?: number;
  total?: number;
  onChange?: (page: number) => void;
  className?: string;
}) {
  const pages = Array.from({ length: total }, (_, i) => i + 1).filter(
    (page) =>
      page === 1 ||
      page === total ||
      (page >= current - 1 && page <= current + 1),
  );

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center justify-center gap-2", className)}
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={current === 1}
        onClick={() => onChange?.(current - 1)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-[13px] font-medium text-ink transition-colors hover:bg-soft disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Previous</span>
      </button>
      {pages.map((page, index) => {
        const prev = pages[index - 1];
        const gap = prev && page - prev > 1;
        return (
          <span key={page} className="flex items-center gap-2">
            {gap ? <span className="px-1 text-muted">…</span> : null}
            <button
              type="button"
              aria-current={page === current ? "page" : undefined}
              onClick={() => onChange?.(page)}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full text-[13px] font-medium transition-all duration-200",
                page === current
                  ? "bg-primary text-white shadow-[0_8px_18px_-10px_rgba(253,70,70,0.9)]"
                  : "border border-line bg-white text-ink hover:bg-soft",
              )}
            >
              {page}
            </button>
          </span>
        );
      })}
      <button
        type="button"
        aria-label="Next page"
        disabled={current >= total}
        onClick={() => onChange?.(current + 1)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-[13px] font-medium text-ink transition-colors hover:bg-soft disabled:opacity-40"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
