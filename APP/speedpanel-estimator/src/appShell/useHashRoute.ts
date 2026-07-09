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

export type AdminSubPage = "dashboard" | "products" | "systems" | "maths" | "documents" | "requests" | "projectReviews" | "users" | "analytics" | "auditLog" | "orders";

export type Route =
  | { tab: "estimator" }
  | { tab: "selector" }
  | { tab: "education" }
  // orderId/newOrder only ever apply when id is also set -- a project's
  // Orders feature (create/view an order) is reached from that project's
  // own detail page, never standalone.
  | { tab: "projects"; id?: string; orderId?: string; newOrder?: boolean }
  | { tab: "quote" }
  | { tab: "admin"; sub: AdminSubPage }
  // Top-level (not nested under "projects") since both the customer and an
  // admin reach this -- App.tsx renders it standalone, before the normal
  // shell/nav JSX, since it's a printable document, not a page in the app.
  | { tab: "proforma"; orderId: string };

const ADMIN_SUBPAGES: AdminSubPage[] = ["products", "systems", "maths", "documents", "requests", "projectReviews", "users", "analytics", "auditLog", "orders"];

function parseHash(hash: string): Route {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [first, second, third, fourth] = segments;
  if (first === "admin") {
    const sub = ADMIN_SUBPAGES.find(s => s === second) ?? "dashboard";
    return { tab: "admin", sub };
  }
  if (first === "projects") {
    if (second && third === "orders") {
      if (fourth === "new") return { tab: "projects", id: second, newOrder: true };
      if (fourth) return { tab: "projects", id: second, orderId: fourth };
    }
    return { tab: "projects", id: second };
  }
  if (first === "quote")     return { tab: "quote" };
  if (first === "selector")  return { tab: "selector" };
  if (first === "education") return { tab: "education" };
  if (first === "proforma" && second) return { tab: "proforma", orderId: second };
  return { tab: "estimator" };
}

function routeToHash(route: Route): string {
  if (route.tab === "admin") return route.sub === "dashboard" ? "#/admin" : `#/admin/${route.sub}`;
  if (route.tab === "estimator") return "#/";
  if (route.tab === "projects") {
    if (!route.id) return "#/projects";
    if (route.newOrder) return `#/projects/${route.id}/orders/new`;
    if (route.orderId) return `#/projects/${route.id}/orders/${route.orderId}`;
    return `#/projects/${route.id}`;
  }
  if (route.tab === "proforma") return `#/proforma/${route.orderId}`;
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
