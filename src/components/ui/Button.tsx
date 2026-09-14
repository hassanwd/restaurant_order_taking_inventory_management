import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "light";
type Size = "sm" | "md" | "lg";

// Raises on hover, compresses on press — the "give" that makes a button feel
// clickable rather than just a coloured rectangle. `disabled:pointer-events-none`
// means every hover/active rule below is automatically inert while disabled.
const base =
  "relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold select-none " +
  "transition-[transform,box-shadow,background-color,color,border-color] duration-150 ease-out active:duration-75 " +
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-card hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-pop active:translate-y-0 active:scale-[0.97] active:shadow-card",
  secondary:
    "border border-line bg-surface text-fg shadow-card hover:-translate-y-0.5 hover:border-accent hover:text-accent hover:shadow-pop active:translate-y-0 active:scale-[0.97]",
  ghost:
    "text-fg-muted hover:bg-surface-3 hover:text-accent active:scale-[0.96] active:bg-surface-3",
  danger:
    "bg-danger-soft text-danger hover:-translate-y-0.5 hover:bg-danger hover:text-white hover:shadow-pop active:translate-y-0 active:scale-[0.97]",
  dark: "bg-ink-900 text-white shadow-card hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-pop active:translate-y-0 active:scale-[0.97] dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100",
  // For sitting on top of a colour/gradient surface (e.g. the dashboard hero) —
  // fixed white-on-ink regardless of the app theme, since the surface under it
  // doesn't change between light and dark mode either.
  light:
    "bg-white text-ink-900 shadow-card hover:-translate-y-0.5 hover:bg-ink-50 hover:shadow-pop active:translate-y-0 active:scale-[0.97]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-6 text-base",
};

export interface ButtonBaseProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children?: ReactNode;
}

export function buttonClass({ variant = "primary", size = "md", fullWidth }: ButtonBaseProps = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full");
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  ...props
}: ButtonBaseProps & ComponentProps<"button">) {
  return <button className={cn(buttonClass({ variant, size, fullWidth }), className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  ...props
}: ButtonBaseProps & ComponentProps<typeof Link>) {
  return <Link className={cn(buttonClass({ variant, size, fullWidth }), className)} {...props} />;
}
