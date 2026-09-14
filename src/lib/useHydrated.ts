"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * False while the component is being hydrated, true afterwards.
 *
 * Anything restored from the browser (a saved cart, orders placed in an earlier
 * session) must stay invisible until this flips, otherwise the first client
 * render disagrees with the server HTML and React discards the tree.
 *
 * `useSyncExternalStore` is used rather than a `useState` + `useEffect` flag
 * because React resolves it per component during hydration, which is exactly
 * the guarantee needed here.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
