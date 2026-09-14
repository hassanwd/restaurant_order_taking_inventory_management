"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

/**
 * The one picker used everywhere a user chooses exactly one option from a
 * small fixed set — order type, payment method, which document to print.
 * Every instance shares the same shape, border, active colour and press
 * motion; only `size` adapts to the space available.
 */

const sizes = {
  sm: "gap-1.5 px-3 py-1.5 text-xs",
  md: "gap-2 px-4 py-3 text-sm",
};

const iconSizes = {
  sm: "size-3.5",
  md: "size-4",
};

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  equalWidth = true,
  hideLabelOnMobile = false,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Segments share the row equally. Off for a control that should hug its content. */
  equalWidth?: boolean;
  /** Collapse to icon-only below `sm:` — for tight toolbars. */
  hideLabelOnMobile?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-xl border font-bold transition-all duration-150 active:scale-[0.97]",
              sizes[size],
              equalWidth && "flex-1",
              active
                ? "border-accent bg-accent text-accent-fg shadow-card"
                : "border-line bg-surface-2 text-fg-muted hover:border-accent hover:text-accent",
            )}
          >
            <Icon className={iconSizes[size]} aria-hidden />
            <span className={hideLabelOnMobile ? "hidden sm:inline" : undefined}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
