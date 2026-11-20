"use client";

/** Light/dark choice and colour skin, saved on this phone and applied to <html>. */

export type Theme = "auto" | "light" | "dark";
export const THEMES: { id: Theme; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/** Skins recolour pieces and cards. The two colours here are just for the swatch. */
export const SKINS = [
  { id: "classic", label: "Classic", x: "#e2553d", o: "#1f8a84" },
  { id: "neon", label: "Neon", x: "#ff2e88", o: "#00b8f5" },
  { id: "forest", label: "Forest", x: "#d9730d", o: "#2f8f5b" },
  { id: "candy", label: "Candy", x: "#f0568c", o: "#7c5cff" },
  { id: "mono", label: "Ink", x: "#c2410c", o: "#475569" },
] as const;
export type Skin = (typeof SKINS)[number]["id"];

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
};

export function getTheme(): Theme {
  const t = read("pg.theme");
  return t === "light" || t === "dark" ? t : "auto";
}

export function setTheme(t: Theme) {
  write("pg.theme", t === "auto" ? null : t);
  const root = document.documentElement;
  if (t === "auto") delete root.dataset.theme;
  else root.dataset.theme = t;
  // Keep the browser's own bar in step with the page.
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#111230" : "#edeefa"));
}

export function getSkin(): Skin {
  const s = read("pg.skin");
  return SKINS.some((k) => k.id === s) ? (s as Skin) : "classic";
}

export function setSkin(s: Skin) {
  write("pg.skin", s === "classic" ? null : s);
  const root = document.documentElement;
  if (s === "classic") delete root.dataset.skin;
  else root.dataset.skin = s;
}
