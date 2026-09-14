type ClassValue = string | number | null | undefined | false;

/** Tiny classnames helper — no dependency needed for what this app does. */
export function cn(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}
