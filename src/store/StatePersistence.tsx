"use client";

import { useEffect, useRef } from "react";
import { hydrateCart, resetCart, type CartState } from "./slices/cartSlice";
import { useAppDispatch, useAppSelector, useAppStore } from "./hooks";
import { selectUser } from "./selectors";

/** Saved per employee, so a shared register never shows one person's half-built order to the next. */
const cartKey = (userId: string) => `ots.cart.v2.${userId}`;
const LEGACY_KEYS = ["ots.cart.v1", "ots.orders.v1"];

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
 * Keeps the in-progress cart across reloads, for the signed-in employee only.
 *
 * Restoring happens in an effect so the server HTML and the first client render
 * always match. When nobody is signed in the cart is wiped from memory and the
 * saved copy is left alone for its owner's next sign-in.
 */
export default function StatePersistence() {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const userId = user?.id ?? null;
  const restoredFor = useRef<string | null>(null);

  useEffect(() => {
    // Orders used to be cached in the browser; they now live on the server only.
    for (const key of LEGACY_KEYS) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (restoredFor.current === userId) return;
    restoredFor.current = userId;

    dispatch(resetCart());
    if (!userId) return;
    const cart = read<Partial<CartState>>(cartKey(userId));
    if (cart && Array.isArray(cart.lines)) dispatch(hydrateCart(cart));
  }, [dispatch, userId]);

  useEffect(() => {
    if (!userId) return;
    let frame = 0;
    const unsubscribe = store.subscribe(() => {
      if (restoredFor.current !== userId) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => write(cartKey(userId), store.getState().cart));
    });

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [store, userId]);

  return null;
}
