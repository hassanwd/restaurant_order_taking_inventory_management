"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, ShoppingCart, Sun } from "lucide-react";
import { currency, initials } from "@/lib/format";
import { OUTLET } from "@/data/settings";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCartCount, selectCartTotals } from "@/store/selectors";
import { toggleSidebar, toggleTheme } from "@/store/slices/uiSlice";
import { pageTitle } from "./navigation";

/** Rendered by the server layout so the heading is part of the first HTML. */
export default function Topbar({ serverTime }: { serverTime: string }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.ui.theme);
  const cartCount = useAppSelector(selectCartCount);
  const totals = useAppSelector(selectCartTotals);

  const title = pageTitle(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Open menu"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-fg-muted transition-all duration-150 hover:border-accent hover:text-accent active:scale-90 lg:hidden"
        >
          <Menu className="size-4.5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight text-fg">
            {title}
          </h1>
          <p className="truncate text-[11px] text-fg-muted">
            Server rendered · {serverTime} UTC
          </p>
        </div>

        <button
          type="button"
          onClick={() => dispatch(toggleTheme())}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-fg-muted transition-all duration-150 hover:border-accent hover:text-accent active:scale-90"
        >
          {theme === "light" ? (
            <Moon className="size-4.5" aria-hidden />
          ) : (
            <Sun className="size-4.5" aria-hidden />
          )}
        </button>

        <Link
          href="/order/new"
          className="hidden items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-card active:translate-y-0 active:scale-[0.98] sm:flex"
        >
          <span className="relative grid place-items-center" aria-hidden>
            <ShoppingCart className="size-4.5 text-fg-muted" />
            {cartCount > 0 ? (
              <span className="absolute -right-2 -top-2 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">
                {cartCount}
              </span>
            ) : null}
          </span>
          <span className="leading-tight">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-fg-subtle">
              Current order
            </span>
            <span className="block text-sm font-bold tabular-nums text-fg">
              {currency(totals.total)}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 py-1.5 pl-1.5 pr-3">
          <span className="grid size-8 place-items-center rounded-lg bg-ink-900 text-xs font-bold text-white dark:bg-white dark:text-ink-900">
            {initials(OUTLET.cashier)}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-xs font-bold text-fg">{OUTLET.cashier}</span>
            <span className="block text-[10px] text-fg-muted">Cashier</span>
          </span>
        </div>
      </div>
    </header>
  );
}
