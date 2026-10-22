"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { OUTLET } from "@/data/settings";
import { ROLE_LABEL } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCartCount } from "@/store/selectors";
import { resetOrdersView, setSidebarOpen } from "@/store/slices/uiSlice";
import { isActive, navFor } from "./navigation";

export default function Sidebar({ user, openOrders }: { user: SessionUser; openOrders: number }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.sidebarOpen);
  const collapsed = useAppSelector((state) => state.ui.sidebarCollapsed);
  const cartCount = useAppSelector(selectCartCount);
  const items = navFor(user.role);

  const close = () => dispatch(setSidebarOpen(false));

  return (
    <>
      {open ? (
        <div
          className="fixed inset-x-0 bottom-0 top-16 z-30 bg-ink-900/50 backdrop-blur-[2px] lg:hidden"
          onClick={close}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          // Below the header (which carries the logo), so the logo is always visible. On desktop it sticks
          // under the header and scrolls on its own.
          "fixed bottom-0 left-0 top-16 z-40 flex w-[260px] flex-col border-r border-line bg-surface transition-transform duration-200 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:shrink-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: folded away entirely, so the page gets the full width.
          collapsed && "lg:hidden",
        )}
      >
        <nav className="scroll-slim flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item, index) => {
            const startsManagement =
              item.section === "manage" && items[index - 1]?.section !== "manage";
            const active = isActive(item, pathname);
            const badge =
              item.href === "/order/new" ? cartCount : item.href === "/orders" ? openOrders : 0;
            const Icon = item.icon;

            return (
              <Fragment key={item.href}>
              {startsManagement ? (
                <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                  Management
                </p>
              ) : null}
              <Link
                href={item.href}
                onClick={() => {
                  close();
                  // Clicking Orders / Monitor while already on it clears its filters, like arriving fresh.
                  if (active && (item.href === "/orders" || item.href === "/monitor")) {
                    dispatch(resetOrdersView());
                  }
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 active:scale-[0.98]",
                  active
                    ? "bg-sidebar-active text-sidebar-active-fg shadow-card"
                    : "text-fg-muted hover:bg-surface-3 hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                    active ? "bg-white/15" : "bg-surface-3 group-hover:bg-surface",
                  )}
                >
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span
                    className={cn(
                      "block truncate text-[11px]",
                      active ? "text-sidebar-active-fg/75" : "text-fg-subtle",
                    )}
                  >
                    {item.description}
                  </span>
                </span>
                {badge > 0 ? (
                  <span
                    className={cn(
                      "min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums",
                      active ? "bg-white/20 text-sidebar-active-fg" : "bg-accent-soft text-accent",
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
              </Fragment>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <div className="rounded-xl bg-surface-3 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">
              Register
            </p>
            <p className="mt-1 text-sm font-semibold text-fg">{OUTLET.register}</p>
            <p className="truncate text-[11px] text-fg-muted">
              {ROLE_LABEL[user.role]} · {user.name}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
