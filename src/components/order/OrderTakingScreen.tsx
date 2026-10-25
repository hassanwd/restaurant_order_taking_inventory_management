"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { GreetingBanner } from "@/components/ui/primitives";
import { currency } from "@/lib/format";
import type { Category, DiningTable, MenuItem, OrderType } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCartCount, selectCartTotals } from "@/store/selectors";
import { setOrderType, setTable } from "@/store/slices/cartSlice";
import { setCartDrawerOpen } from "@/store/slices/uiSlice";
import CartPanel from "./CartPanel";
import ItemConfigurator from "./ItemConfigurator";
import MenuBrowser from "./MenuBrowser";
import OrderSetup from "./OrderSetup";

interface OrderTakingScreenProps {
  categories: Category[];
  items: MenuItem[];
  tables: DiningTable[];
  userName: string;
  openOrders: number;
  /** Read from the query string on the server (e.g. /order/new?type=delivery). */
  initialType?: OrderType;
  initialTableId?: string;
}

export default function OrderTakingScreen({
  categories,
  items,
  tables,
  userName,
  openOrders,
  initialType,
  initialTableId,
}: OrderTakingScreenProps) {
  const dispatch = useAppDispatch();
  const configuringItemId = useAppSelector((state) => state.ui.configuringItemId);
  const drawerOpen = useAppSelector((state) => state.ui.cartDrawerOpen);
  const count = useAppSelector(selectCartCount);
  const totals = useAppSelector(selectCartTotals);
  const applied = useRef(false);

  // Apply the deep-link preset once, after hydration, so it never fights the
  // cart restored from localStorage.
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (initialType) dispatch(setOrderType(initialType));
    if (initialTableId) {
      dispatch(setOrderType("dine-in"));
      dispatch(setTable(initialTableId));
    }
  }, [dispatch, initialType, initialTableId]);

  const configuringItem = configuringItemId
    ? (items.find((item) => item.id === configuringItemId) ?? null)
    : null;

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0">
      <div className="scroll-slim min-w-0 flex-1 space-y-4 overflow-y-auto p-4 pb-24 sm:p-6 xl:pb-6">
        <GreetingBanner name={userName} openOrders={openOrders} />
        <OrderSetup tables={tables} />
        <MenuBrowser categories={categories} items={items} />
      </div>

      {/* Desktop cart rail */}
      <aside className="hidden w-[380px] shrink-0 border-l border-line xl:block">
        <CartPanel />
      </aside>

      {/* Mobile summary bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur xl:hidden">
        <button
          type="button"
          onClick={() => dispatch(setCartDrawerOpen(true))}
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3 text-accent-fg shadow-card transition-transform duration-150 active:scale-[0.98]"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <ShoppingCart className="size-4" aria-hidden />
            <span className="grid min-w-6 place-items-center rounded-full bg-accent-fg/20 px-1.5 py-0.5 text-xs tabular-nums">
              {count}
            </span>
            View order
          </span>
          <span className="text-sm font-bold tabular-nums">{currency(totals.total)}</span>
        </button>
      </div>

      {/* Mobile cart drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex xl:hidden">
          <div
            className="flex-1 bg-ink-900/55 backdrop-blur-[2px] animate-fade-in"
            onClick={() => dispatch(setCartDrawerOpen(false))}
            aria-hidden
          />
          <div className="flex w-full max-w-[420px] flex-col border-l border-line bg-surface shadow-float animate-pop-in">
            <button
              type="button"
              onClick={() => dispatch(setCartDrawerOpen(false))}
              className="flex cursor-pointer items-center gap-2 border-b border-line px-4 py-3 text-left text-xs font-bold text-fg-muted transition-transform duration-150 hover:text-accent active:scale-[0.98]"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to menu
            </button>
            <div className="min-h-0 flex-1">
              <CartPanel />
            </div>
          </div>
        </div>
      ) : null}

      {configuringItem ? (
        <ItemConfigurator key={configuringItem.id} item={configuringItem} />
      ) : null}
    </div>
  );
}
