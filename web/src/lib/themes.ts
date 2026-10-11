export const THEMES = [
  {
    id: "light",
    label: "Light",
    note: "Mono Inverse — white and black; heatmaps carry the color",
  },
  {
    id: "dark",
    label: "Dark",
    note: "Thermal Graphite — charcoal with heatmap orange",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "light";
export const THEME_STORAGE_KEY = "subspacead-theme";

/** Map legacy palette ids and any stored value onto light | dark. */
export function normalizeTheme(value: string | null | undefined): ThemeId {
  if (value === "dark" || value === "graphite" || value === "thermal") return "dark";
  if (value === "light" || value === "mono" || value === "blueprint") return "light";
  return DEFAULT_THEME;
}

export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var n=t==="dark"||t==="graphite"||t==="thermal"?"dark":t==="light"||t==="mono"||t==="blueprint"?"light":"${DEFAULT_THEME}";document.documentElement.dataset.theme=n}catch(e){document.documentElement.dataset.theme="${DEFAULT_THEME}"}})();`;
