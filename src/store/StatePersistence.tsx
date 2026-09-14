"use client";

import { useEffect, useRef } from "react";
import { hydrateCart, type CartState } from "./slices/cartSlice";
import { hydrateOrders } from "./slices/ordersSlice";
import { useAppDispatch, useAppStore } from "./hooks";
import type { Order } from "@/lib/types";

const CART_KEY = "ots.cart.v1";
const ORDERS_KEY = "ots.orders.v1";

interface StoredOrders {
  items: Order[];
  localIds: string[];
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — persistence is a convenience, not a requirement */
  }
}

/**
 * Keeps the in-progress cart and any locally created orders across reloads.
 *
 * Restoring happens in an effect so the server HTML and the first client render
 * always match. Screens where the restored data changes what is on screen —
 * the orders list, order details, the receipt — additionally guard on
 * `useHydrated()`, so they stay correct even if a Suspense boundary is added
 * later and hydration is split across passes.
 */
export default function StatePersistence() {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    const cart = read<Partial<CartState>>(CART_KEY);
    if (cart && Array.isArray(cart.lines)) {
      dispatch(hydrateCart(cart));
    }

    const orders = read<StoredOrders>(ORDERS_KEY);
    if (orders && Array.isArray(orders.items)) {
      // Only replay orders that originated on this client; the rest come from
      // the server on every render.
      const localIds = new Set(orders.localIds ?? []);
      dispatch(
        hydrateOrders({
          items: orders.items.filter((order) => localIds.has(order.id)),
          localIds: [...localIds],
        }),
      );
    }
  }, [dispatch]);

  useEffect(() => {
    let frame = 0;
    const unsubscribe = store.subscribe(() => {
      if (!restored.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const state = store.getState();
        write(CART_KEY, state.cart);
        const localIds = new Set(state.orders.localIds);
        write(ORDERS_KEY, {
          items: state.orders.items.filter((order) => localIds.has(order.id)),
          localIds: state.orders.localIds,
        });
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [store]);

  return null;
}
