// =============================================================================
// Projects router
// =============================================================================
// Dispatches the "projects" tab: no session -> SignInGate; otherwise "no id"
// -> ProjectsListPage (the table/overview), "id present" -> ProjectDetailPage
// (that project's own expanded view, with a back link to the list) -- two
// distinct views/routes, not one page with an embedded dashboard. Kept as
// its own small component (rather than inlined in App.tsx) so App.tsx's
// per-route JSX block stays a one-liner, same as every other tab.
//
// The anonymous "request" (Request a Quote) branch is checked BEFORE the
// session check -- it's the one sub-feature here that deliberately works
// without signing in (see SignInGate.tsx's CTA into it). The newOrder/
// quickOrder/orderId branches all still short-circuit to their own
// full-page views before the ProjectsListPage fallback, unchanged.
// newOrder (OrderBuilderPage, Estimator-derived line items) and
// quickOrder (QuickOrderPage, manual product picker) are two independent
// order-creation entry points reachable from the same project.
//
// The project-scoped "request" branch below (id && request) is no longer
// linked from anywhere in the app -- ProjectDetailPage's "Request a quote"
// now routes into newOrder (OrderBuilderPage) instead, so an existing
// project's quote request actually becomes an order. This branch is kept
// only so an old bookmarked/shared #/projects/:id/request URL doesn't 404;
// QuoteRequestPage itself stays in active use by the anonymous, no-id case
// above.
// =============================================================================
import { LoadingState } from "../../ui/states";
import type { EffectiveLayout } from "../../useLayoutMode";
import type { UseAuth } from "../../lib/useAuth";
import type { UseCompanyMemberships } from "../../lib/useCompanyMemberships";
import type { Route } from "../../appShell/useHashRoute";
import { SignInGate } from "./SignInGate";
import { ProjectsListPage } from "./ProjectsListPage";
import { ProjectDetailPage } from "./ProjectDetailPage";
import { QuoteRequestPage } from "./QuoteRequestPage";
import { OrderBuilderPage } from "./orders/OrderBuilderPage";
import { QuickOrderPage } from "./orders/QuickOrderPage";
import { OrderDetailPage } from "./orders/OrderDetailPage";
import type { ProjectRow } from "./projectTypes";

export const ProjectsRouter = ({ route, navigate, auth, company, onOpenEstimator, pendingNote, layoutMode }: {
  route: Extract<Route, { tab: "projects" }>;
  navigate: (r: Route) => void;
  auth: UseAuth;
  company: UseCompanyMemberships;
  onOpenEstimator: (project: ProjectRow) => void;
  pendingNote?: string;
  layoutMode: EffectiveLayout;
}) => {
  if (auth.loading) return <LoadingState className="mt-6" />;
  if (!route.id && route.request) {
    return <QuoteRequestPage onBack={() => navigate({ tab: "projects" })} />;
  }
  if (!auth.session) return <SignInGate auth={auth} onRequestQuote={() => navigate({ tab: "projects", request: true })} pendingNote={pendingNote} />;
  if (route.id && route.newOrder) {
    return (
      <OrderBuilderPage projectId={route.id} auth={auth}
        onBack={() => navigate({ tab: "projects", id: route.id })}
        onCreated={orderId => navigate({ tab: "projects", id: route.id, orderId })}
      />
    );
  }
  if (route.id && route.quickOrder) {
    return (
      <QuickOrderPage projectId={route.id} auth={auth}
        onBack={() => navigate({ tab: "projects", id: route.id })}
        onCreated={orderId => navigate({ tab: "projects", id: route.id, orderId })}
      />
    );
  }
  if (route.id && route.orderId) {
    return (
      <OrderDetailPage orderId={route.orderId} userId={auth.user?.id ?? null}
        onBack={() => navigate({ tab: "projects", id: route.id })}
        onViewProforma={() => window.open(`#/proforma/${route.orderId}`, "_blank")}
        onOpenLinkedOrder={linkedOrderId => navigate({ tab: "projects", id: route.id, orderId: linkedOrderId })}
      />
    );
  }
  if (route.id && route.request) {
    return <QuoteRequestPage projectId={route.id} onBack={() => navigate({ tab: "projects", id: route.id })} />;
  }
  if (route.id) {
    return (
      <ProjectDetailPage id={route.id} userId={auth.user?.id ?? null}
        onBack={() => navigate({ tab: "projects" })}
        onOpenEstimator={onOpenEstimator}
        onCreateOrder={id => navigate({ tab: "projects", id, newOrder: true })}
        onCreateQuickOrder={id => navigate({ tab: "projects", id, quickOrder: true })}
        onOpenOrder={(id, orderId) => navigate({ tab: "projects", id, orderId })}
        layoutMode={layoutMode}
      />
    );
  }
  return (
    <ProjectsListPage user={auth.user} onOpenProject={id => navigate({ tab: "projects", id })}
      onQuickOrder={id => navigate({ tab: "projects", id, quickOrder: true })}
      layoutMode={layoutMode}
      hasCompany={company.memberships.length > 0}
      activeCompanyId={company.activeCompanyId}
      onTeam={() => navigate({ tab: "company", sub: "team" })}
    />
  );
};
