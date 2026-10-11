"use client";

import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color mode"
      className={cn(
        "inline-flex h-10 items-stretch rounded-full border border-foreground/15 p-0.5 text-sm",
        className
      )}
    >
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id as ThemeId)}
            aria-pressed={active}
            title={t.note}
            className={cn(
              "rounded-full px-3.5 transition-colors duration-300",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
