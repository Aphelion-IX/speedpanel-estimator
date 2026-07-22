// =============================================================================
// Hash router
// =============================================================================
// Lightweight hash-based routing so GitHub Pages deep links (#/admin/products
// etc.) work without server-side rewrite rules -- a refresh or shared link
// never 404s because the server only ever sees index.html, the route lives
// entirely in the fragment. No react-router dependency; this app has six
// routes total and doesn't need one.
// =============================================================================
import { useCallback, useEffect, useState } from "react";

// "companies"/"priceLists" retired (Phase 14, Company Accounts & Pricing) --
// #/admin/companies and #/admin/priceLists now redirect to their
// #/accounts equivalents (see parseHash below) rather than being real
// AdminSubPage values, since AdminCompaniesPage.tsx/AdminCompanyWizard.tsx/
// AdminPriceListsPage.tsx were deleted outright, not kept as dead code
// behind a route that no longer dispatches to anything.
export type AdminSubPage = "dashboard" | "products" | "systems" | "maths" | "documents" | "requests" | "projectReviews" | "projectsAdmin" | "users" | "analytics" | "auditLog" | "orders" | "manufacturing" | "permissions" | "deliveryRequests" | "serviceRequests";
// "create" removed -- self-service company creation no longer exists, see
// CompanyRouter.tsx/NoCompanyPage.tsx. Companies are created only via the
// Company Accounts & Pricing workspace's own wizard now (see "companies"
// retirement note above).
export type CompanySubPage = "team" | "activity";

// "Company Accounts & Pricing" -- a new top-level internal-staff workspace
// (see AccountsRoot.tsx), separate from "admin" the same way "admin" itself
// is its own top-level tab rather than nested under "projects": both are
// reached via AuthStatus.tsx's account dropdown, never a TOP_NAV_ITEMS entry
// (see topNav.tsx's header comment for why "admin" is excluded from that
// list -- same reasoning applies here). "controlRoom" is the landing/
// dashboard sub-page, same role "dashboard" plays for AdminSubPage above.
export type AccountsSubPage = "controlRoom" | "companies" | "companyUsers" | "invitations" | "companyPricing" | "priceLists" | "permissions" | "auditHistory";

export type Route =
  // Signed-out front door (sign-in) or signed-in overview dashboard --
  // see src/pages/home/. The default/fallback route (parseHash below),
  // replacing "estimator" in that role.
  | { tab: "home" }
  // Top-level shortcut into placing an order without going through the
  // Estimator first -- a lightweight project picker (see
  // pages/order/OrderEntryPage.tsx) that hands off into the existing
  // project-scoped quickOrder route below once a project is chosen (orders
  // always belong to a project -- see that route's own comment).
  | { tab: "order" }
  // orderSheet: the standalone "clean" Project Order Sheet (spec's Final
  // Order Review output, printable/copyable with no app chrome) -- same
  // "own top-level branch before the normal shell renders" precedent as
  // "proforma" below, reached from the embedded sheet's "Open clean order
  // sheet" link (see internalCalculator/projectOrderSheet.tsx).
  | { tab: "estimator"; orderSheet?: boolean }
  | { tab: "selector" }
  | { tab: "education" }
  // orderId/newOrder only ever apply when id is also set -- a project's
  // Orders feature (create/view an order) is reached from that project's
  // own detail page, never standalone. "request" ("Request a Quote") is the
  // only sub-feature that also works WITHOUT an id -- anonymous visitors
  // have no saved project to attach to, see ProjectsRouter.tsx.
  | { tab: "projects"; id?: string; orderId?: string; newOrder?: boolean; quickOrder?: boolean; request?: boolean }
  | { tab: "admin"; sub: AdminSubPage }
  // companyId/newCompany only apply when sub is "companies" -- drilling into
  // one company's CompanyOverviewPage.tsx or CompanyWizard.tsx respectively
  // (Phase 2), same "extra fields only meaningful for one particular value"
  // pattern as "projects"'s id/orderId below. priceListId only applies when
  // sub is "priceLists" -- drilling into one list's PriceListVersionEditor.tsx
  // (Phase 7); list creation stays an inline form on PriceListsPage.tsx
  // itself (matching AdminPriceListsPage.tsx's existing precedent) rather
  // than a separate route the way companies' newCompany is.
  | { tab: "accounts"; sub: AccountsSubPage; companyId?: string; newCompany?: boolean; priceListId?: string }
  // Top-level (not nested under "projects") since it's about the signed-in
  // user's account/company membership, not any one project -- same reasoning
  // "admin" is its own top-level tab rather than nested somewhere else.
  | { tab: "company"; sub: CompanySubPage }
  // Consolidated read-only history of every install/technical review,
  // delivery, and quote request across ALL of the signed-in customer's
  // projects -- same "about the account, not one project" reasoning as
  // "company" above. Reached via AuthStatus.tsx's account dropdown, not a
  // top-nav tab (see topNav.tsx's header comment for why "company"/"admin"
  // are excluded from TOP_NAV_ITEMS -- same precedent applies here).
  | { tab: "myRequests" }
  // Top-level (not nested under "projects") since both the customer and an
  // admin reach this -- App.tsx renders it standalone, before the normal
  // shell/nav JSX, since it's a printable document, not a page in the app.
  | { tab: "proforma"; orderId: string };

const ADMIN_SUBPAGES: AdminSubPage[] = ["products", "systems", "maths", "documents", "requests", "projectReviews", "projectsAdmin", "users", "analytics", "auditLog", "orders", "manufacturing", "permissions", "deliveryRequests", "serviceRequests"];
const COMPANY_SUBPAGES: CompanySubPage[] = ["team", "activity"];
const ACCOUNTS_SUBPAGES: AccountsSubPage[] = ["controlRoom", "companies", "companyUsers", "invitations", "companyPricing", "priceLists", "permissions", "auditHistory"];

function parseHash(hash: string): Route {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [first, second, third, fourth] = segments;
  // Retired (Phase 14, Company Accounts & Pricing) -- kept as redirects so
  // bookmarked/shared #/admin/companies or #/admin/priceLists links still
  // land somewhere useful, same "#/quote" precedent below. A bare
  // "#/admin/companies/<id>" (no such deep-link ever existed on the old
  // page, which had no per-company route of its own) still just lands on
  // the new list, same as a plain "#/admin/companies".
  if (first === "admin" && second === "companies")  return { tab: "accounts", sub: "companies" };
  if (first === "admin" && second === "priceLists") return { tab: "accounts", sub: "priceLists" };
  if (first === "admin") {
    const sub = ADMIN_SUBPAGES.find(s => s === second) ?? "dashboard";
    return { tab: "admin", sub };
  }
  if (first === "company") {
    const sub = COMPANY_SUBPAGES.find(s => s === second) ?? "team";
    return { tab: "company", sub };
  }
  if (first === "accounts") {
    const sub = ACCOUNTS_SUBPAGES.find(s => s === second) ?? "controlRoom";
    if (sub === "companies" && third === "create") return { tab: "accounts", sub, newCompany: true };
    if (sub === "companies" && third) return { tab: "accounts", sub, companyId: third };
    if (sub === "priceLists" && third) return { tab: "accounts", sub, priceListId: third };
    return { tab: "accounts", sub };
  }
  if (first === "myRequests") return { tab: "myRequests" };
  if (first === "order") return { tab: "order" };
  if (first === "projects") {
    if (second === "request" && !third) return { tab: "projects", request: true };
    if (second && third === "orders") {
      if (fourth === "new") return { tab: "projects", id: second, newOrder: true };
      if (fourth === "quick") return { tab: "projects", id: second, quickOrder: true };
      if (fourth) return { tab: "projects", id: second, orderId: fourth };
    }
    if (second && third === "request") return { tab: "projects", id: second, request: true };
    return { tab: "projects", id: second };
  }
  // Old standalone "Request a Quote" tab, kept as a redirect so bookmarked/
  // shared #/quote links still land somewhere useful now that it's nested
  // under Projects (see ProjectsRouter.tsx).
  if (first === "quote")     return { tab: "projects", request: true };
  if (first === "estimator") return { tab: "estimator", orderSheet: second === "order-sheet" };
  if (first === "selector")  return { tab: "selector" };
  if (first === "education") return { tab: "education" };
  if (first === "proforma" && second) return { tab: "proforma", orderId: second };
  return { tab: "home" };
}

function routeToHash(route: Route): string {
  if (route.tab === "admin") return route.sub === "dashboard" ? "#/admin" : `#/admin/${route.sub}`;
  if (route.tab === "accounts") {
    if (route.sub === "companies" && route.newCompany) return "#/accounts/companies/create";
    if (route.sub === "companies" && route.companyId) return `#/accounts/companies/${route.companyId}`;
    if (route.sub === "priceLists" && route.priceListId) return `#/accounts/priceLists/${route.priceListId}`;
    return route.sub === "controlRoom" ? "#/accounts" : `#/accounts/${route.sub}`;
  }
  if (route.tab === "company") return `#/company/${route.sub}`;
  if (route.tab === "home") return "#/";
  if (route.tab === "projects") {
    if (!route.id) return route.request ? "#/projects/request" : "#/projects";
    if (route.newOrder) return `#/projects/${route.id}/orders/new`;
    if (route.quickOrder) return `#/projects/${route.id}/orders/quick`;
    if (route.orderId) return `#/projects/${route.id}/orders/${route.orderId}`;
    if (route.request) return `#/projects/${route.id}/request`;
    return `#/projects/${route.id}`;
  }
  if (route.tab === "proforma") return `#/proforma/${route.orderId}`;
  if (route.tab === "estimator") return route.orderSheet ? "#/estimator/order-sheet" : "#/estimator";
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
