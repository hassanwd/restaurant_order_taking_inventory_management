"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export default function QuantityStepper({
  value,
  onChange,
  size = "md",
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
  min?: number;
  max?: number;
}) {
  const button = size === "sm" ? "size-7" : "size-9";
  const iconSize = size === "sm" ? "size-3" : "size-3.5";

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-xl border border-line bg-surface-2 p-1",
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
        className={cn(
          button,
          "grid cursor-pointer place-items-center rounded-lg text-fg-muted transition-all duration-150 hover:bg-surface-3 hover:text-accent active:scale-90",
        )}
      >
        <Minus className={iconSize} aria-hidden />
      </button>
      <span
        className={cn(
          "min-w-7 text-center font-bold tabular-nums text-fg",
          size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, value + 1))}
        className={cn(
          button,
          "grid cursor-pointer place-items-center rounded-lg bg-accent text-accent-fg transition-all duration-150 hover:bg-accent-hover active:scale-90",
        )}
      >
        <Plus className={iconSize} aria-hidden />
      </button>
    </div>
  );
}
