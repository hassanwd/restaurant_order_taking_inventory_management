import { twMerge } from "tailwind-merge";

type ClassValue = string | number | null | undefined | false;

/**
 * Classnames helper. Every primitive (`Input`, `Select`, …) ships a base className like `w-full`
 * that a caller's `className` is meant to override (e.g. a fixed `w-20` for a compact field). A
 * plain join leaves both classes in the string — since Tailwind utilities all have equal CSS
 * specificity, whichever one happens to come later in the generated stylesheet wins, not whichever
 * is passed last here, so the override could silently lose. `twMerge` resolves same-property
 * conflicts in author order instead, so a later class always beats an earlier one of the same kind.
 */
export function cn(...values: ClassValue[]) {
  return twMerge(values.filter(Boolean).join(" "));
}
