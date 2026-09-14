"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, type RootState } from "./index";

interface StoreProviderProps {
  children: ReactNode;
  /** Prepared on the server and serialised into the RSC payload. */
  preloadedState?: Partial<RootState>;
}

export default function StoreProvider({ children, preloadedState }: StoreProviderProps) {
  // A lazy initialiser runs exactly once per mount, which gives each SSR render
  // and each browser session its own store — never a module-level singleton.
  const [store] = useState(() => makeStore(preloadedState));

  return <Provider store={store}>{children}</Provider>;
}
