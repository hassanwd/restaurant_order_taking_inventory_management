"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Builds a windowed page list with `null` standing in for an ellipsis. */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | null)[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push(null);
    result.push(page);
    previous = page;
  }
  return result;
}

const pageButton =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xs font-bold " +
  "transition-all duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100";

export default function Pagination({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-1", className)}
    >
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className={cn(pageButton, "border border-line text-fg-muted hover:border-accent hover:text-accent")}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>

      {pageWindow(page, pageCount).map((entry, index) =>
        entry === null ? (
          <span key={`ellipsis-${index}`} className="px-1 text-xs text-fg-subtle">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              pageButton,
              entry === page
                ? "bg-accent text-accent-fg shadow-card"
                : "text-fg-muted hover:bg-surface-3 hover:text-accent",
            )}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        className={cn(pageButton, "border border-line text-fg-muted hover:border-accent hover:text-accent")}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}
