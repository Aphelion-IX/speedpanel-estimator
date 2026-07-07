// =============================================================================
// Hash router
// =============================================================================
// Lightweight hash-based routing so GitHub Pages deep links (#/admin/products
// etc.) work without server-side rewrite rules -- a refresh or shared link
// never 404s because the server only ever sees index.html, the route lives
// entirely in the fragment. No react-router dependency; this app has five
// routes total and doesn't need one.
// =============================================================================
import { useCallback, useEffect, useState } from "react";

export type AdminSubPage = "dashboard" | "products" | "systems" | "documents" | "requests";

export type Route =
  | { tab: "estimator" }
  | { tab: "selector" }
  | { tab: "education" }
  | { tab: "projects" }
  | { tab: "admin"; sub: AdminSubPage };

const ADMIN_SUBPAGES: AdminSubPage[] = ["products", "systems", "documents", "requests"];

function parseHash(hash: string): Route {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [first, second] = segments;
  if (first === "admin") {
    const sub = ADMIN_SUBPAGES.find(s => s === second) ?? "dashboard";
    return { tab: "admin", sub };
  }
  if (first === "projects")  return { tab: "projects" };
  if (first === "selector")  return { tab: "selector" };
  if (first === "education") return { tab: "education" };
  return { tab: "estimator" };
}

function routeToHash(route: Route): string {
  if (route.tab === "admin") return route.sub === "dashboard" ? "#/admin" : `#/admin/${route.sub}`;
  if (route.tab === "estimator") return "#/";
  return `#/${route.tab}`;
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    setRoute(next);
    const hash = routeToHash(next);
    if (window.location.hash !== hash) window.location.hash = hash;
  }, []);

  return { route, navigate };
}
