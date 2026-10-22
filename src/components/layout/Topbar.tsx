"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, UtensilsCrossed } from "lucide-react";
import { OUTLET } from "@/data/settings";
import type { SessionUser } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSidebarCollapsed, toggleSidebar, toggleTheme } from "@/store/slices/uiSlice";
import { pageTitle } from "./navigation";
import UserMenu from "./UserMenu";

const COLLAPSED_KEY = "ots.sidebar.collapsed";

const iconButton =
  "grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-line text-fg-muted transition-all duration-150 hover:border-accent hover:text-accent active:scale-90";

/**
 * The top bar, full width across the top: the logo and outlet name, the button that opens and
 * closes the sidebar, the theme toggle and the account menu. The page's own heading lives in the page; an off-screen <h1> keeps the title for
 * screen readers and the browser tab.
 */
export default function Topbar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.ui.theme);
  const collapsed = useAppSelector((state) => state.ui.sidebarCollapsed);

  // Remember a folded sidebar between visits (applied after hydration so server and client match).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSED_KEY) === "1") dispatch(setSidebarCollapsed(true));
    } catch {
      /* storage unavailable */
    }
  }, [dispatch]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    dispatch(setSidebarCollapsed(next));
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/* The logo lives in the header, so it is always visible — also when the sidebar is closed. */}
        <div className="flex min-w-0 shrink items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg shadow-card">
            <UtensilsCrossed className="size-5" aria-hidden />
          </span>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-bold text-fg">{OUTLET.name}</p>
            <p className="truncate text-[11px] text-fg-muted">{OUTLET.branch}</p>
          </div>
        </div>

        {/* Phones and tablets: opens the sidebar as a drawer. */}
        <button
          type="button"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Open menu"
          className={`${iconButton} lg:hidden`}
        >
          <Menu className="size-4.5" aria-hidden />
        </button>

        {/* Desktop: folds the sidebar away and brings it back. */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Open sidebar" : "Close sidebar"}
          className={`${iconButton} hidden lg:grid`}
        >
          <CollapseIcon className="size-4.5" aria-hidden />
        </button>

        <h1 className="sr-only">{pageTitle(pathname)}</h1>
        <div className="flex-1" />

        <button
          type="button"
          onClick={() => dispatch(toggleTheme())}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          className={iconButton}
        >
          {theme === "light" ? (
            <Moon className="size-4.5" aria-hidden />
          ) : (
            <Sun className="size-4.5" aria-hidden />
          )}
        </button>

        <UserMenu user={user} />
      </div>
    </header>
  );
}
