"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setTheme } from "@/store/slices/uiSlice";

export const THEME_KEY = "ots.theme";

/**
 * Bridges the Redux `ui.theme` value and the `data-theme` attribute that the
 * global stylesheet keys off. The attribute itself is set before paint by the
 * inline script in the root layout, so there is no flash and no mismatch.
 */
export default function ThemeSync() {
  const theme = useAppSelector((state) => state.ui.theme);
  const dispatch = useAppDispatch();
  const adopted = useRef(false);

  useEffect(() => {
    if (adopted.current) return;
    adopted.current = true;
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "dark" || current === "light") {
      dispatch(setTheme(current));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!adopted.current) return;
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return null;
}
