import { useCallback, useEffect, useState } from "react";

export type LayoutPreference = "auto" | "phone" | "web";
export type EffectiveLayout = "phone" | "web";

const STORAGE_KEY = "speedpanel:layoutPreference";
const BREAKPOINT_QUERY = "(min-width: 768px)"; // Tailwind `md`

function readStoredPreference(): LayoutPreference {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "phone" || raw === "web" || raw === "auto" ? raw : "auto";
}

export function useLayoutMode() {
  const [preference, setPreference] = useState<LayoutPreference>(readStoredPreference);
  const [isWideViewport, setIsWideViewport] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(BREAKPOINT_QUERY).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(BREAKPOINT_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsWideViewport(e.matches);
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

  const effective: EffectiveLayout =
    preference === "auto" ? (isWideViewport ? "web" : "phone") : preference;

  const toggleLayout = useCallback(() => {
    setPreference(effective === "phone" ? "web" : "phone");
  }, [effective]);

  return { preference, effective, setPreference, toggleLayout };
}
