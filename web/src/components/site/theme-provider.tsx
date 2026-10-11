"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, normalizeTheme, type ThemeId } from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** The <html data-theme> attribute is the source of truth; the head script sets it before paint. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(): ThemeId {
  return normalizeTheme(document.documentElement.dataset.theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);

  const setTheme = useCallback((next: ThemeId) => {
    const resolved = normalizeTheme(next);
    document.documentElement.dataset.theme = resolved;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, resolved);
    } catch {
      // storage unavailable (private mode)
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
