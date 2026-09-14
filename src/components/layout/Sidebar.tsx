"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UtensilsCrossed, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { OUTLET } from "@/data/settings";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCartCount } from "@/store/selectors";
import { setSidebarOpen } from "@/store/slices/uiSlice";
import { isActive, NAV_ITEMS } from "./navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.sidebarOpen);
  const cartCount = useAppSelector(selectCartCount);
  const openOrders = useAppSelector(
    (state) =>
      state.orders.items.filter((order) =>
        ["pending", "preparing", "ready", "served"].includes(order.status),
      ).length,
  );

  const close = () => dispatch(setSidebarOpen(false));

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-ink-900/50 backdrop-blur-[2px] lg:hidden"
          onClick={close}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-line bg-surface transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg shadow-card">
            <UtensilsCrossed className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-fg">{OUTLET.name}</p>
            <p className="truncate text-[11px] text-fg-muted">{OUTLET.branch}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-fg-muted transition-all duration-150 hover:bg-surface-3 active:scale-90 lg:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <nav className="scroll-slim flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const badge =
              item.href === "/order/new" ? cartCount : item.href === "/orders" ? openOrders : 0;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
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
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <div className="rounded-xl bg-surface-3 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">
              Register
            </p>
            <p className="mt-1 text-sm font-semibold text-fg">{OUTLET.register}</p>
            <p className="text-[11px] text-fg-muted">Cashier · {OUTLET.cashier}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
