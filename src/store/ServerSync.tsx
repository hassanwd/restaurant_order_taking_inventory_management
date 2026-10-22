"use client";

import { useEffect } from "react";
import type { Pricing, SessionUser } from "@/lib/types";
import { useAppDispatch } from "./hooks";
import { syncConfig } from "./slices/configSlice";

/**
 * Mirrors what the server knows (who is signed in, current tax settings) into
 * Redux. The root layout re-renders after every refresh/sign-in/sign-out, so
 * this is how the browser store follows along without a client-side fetch.
 */
export default function ServerSync({
  user,
  pricing,
}: {
  user: SessionUser | null;
  pricing: Pricing;
}) {
  const dispatch = useAppDispatch();
  const userKey = user ? `${user.id}:${user.role}:${user.name}` : "";
  const pricingKey = JSON.stringify(pricing);

  useEffect(() => {
    dispatch(syncConfig({ user, pricing }));
    // Keyed on stable strings: the props are fresh objects on every server render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, userKey, pricingKey]);

  return null;
}
