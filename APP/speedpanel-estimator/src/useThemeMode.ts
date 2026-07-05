import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "auto" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

const STORAGE_KEY = "speedpanel:themePreference";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" || raw === "auto" ? raw : "auto";
}

/** Mirrors useLayoutMode's preference/effective pattern for the phone-web toggle. */
export function useThemeMode() {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(DARK_QUERY).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY);
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  const effective: EffectiveTheme =
    preference === "auto" ? (systemPrefersDark ? "dark" : "light") : preference;

  // Drives Tailwind's darkMode: "class" strategy -- toggles the "dark" class on
  // <html> so every dark: utility class in the app activates/deactivates together.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", effective === "dark");
  }, [effective]);

  const toggleTheme = useCallback(() => {
    setPreference(effective === "dark" ? "light" : "dark");
  }, [effective]);

  return { preference, effective, setPreference, toggleTheme };
}
