"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const KEY = "hp-theme";

function read(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(cb: () => void) {
  window.addEventListener("themechange", cb);
  return () => window.removeEventListener("themechange", cb);
}

/** Apply a theme to the page, remember it, and tell listeners (the 3D scene, components). */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage can be blocked; the toggle still works for this visit */
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

/** Current theme, kept in sync with the toggle. Server render always assumes dark. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  const toggle = useCallback(() => applyTheme(read() === "dark" ? "light" : "dark"), []);
  return { theme, toggle };
}

/**
 * Inline script for <head>: sets the saved theme before first paint so there's
 * no flash of the wrong theme. Defaults to dark (the site's signature look).
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${KEY}");document.documentElement.dataset.theme=(t==="light"||t==="dark")?t:"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;
