// =============================================================================
// Projects router
// =============================================================================
// Dispatches the "projects" tab: no session -> SignInGate; otherwise ->
// ProjectsListPage, which handles both "no id" (shows the most recently
// updated project's dashboard) and "id present" (that project's dashboard)
// itself -- there's no separate list-page/detail-page split anymore, just
// one page with an optional selected id, so route.id flows straight into
// ProjectsListPage's selectedId prop. Kept as its own small component
// (rather than inlined in App.tsx) so App.tsx's per-route JSX block stays a
// one-liner, same as every other tab.
//
// The anonymous "request" (Request a Quote) branch is checked BEFORE the
// session check -- it's the one sub-feature here that deliberately works
// without signing in (see SignInGate.tsx's CTA into it). The newOrder/
// orderId/project-scoped-request branches all still short-circuit to their
// own full-page views before the ProjectsListPage fallback, unchanged.
// =============================================================================
import { cx, MUTED } from "../../styleTokens";
import type { EffectiveLayout } from "../../useLayoutMode";
import type { UseAuth } from "../../lib/useAuth";
import type { Route } from "../../appShell/useHashRoute";
import { SignInGate } from "./SignInGate";
import { ProjectsListPage } from "./ProjectsListPage";
import { QuoteRequestPage } from "./QuoteRequestPage";
import { OrderBuilderPage } from "./orders/OrderBuilderPage";
import { OrderDetailPage } from "./orders/OrderDetailPage";
import type { ProjectRow } from "./projectTypes";

export const ProjectsRouter = ({ route, navigate, auth, onOpenEstimator, pendingNote, layoutMode }: {
  route: Extract<Route, { tab: "projects" }>;
  navigate: (r: Route) => void;
  auth: UseAuth;
  onOpenEstimator: (project: ProjectRow) => void;
  pendingNote?: string;
  layoutMode: EffectiveLayout;
}) => {
  if (auth.loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;
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
  if (route.id && route.orderId) {
    return (
      <OrderDetailPage orderId={route.orderId}
        onBack={() => navigate({ tab: "projects", id: route.id })}
        onViewProforma={() => window.open(`#/proforma/${route.orderId}`, "_blank")}
      />
    );
  }
  if (route.id && route.request) {
    return <QuoteRequestPage projectId={route.id} onBack={() => navigate({ tab: "projects", id: route.id })} />;
  }
  return (
    <ProjectsListPage user={auth.user} selectedId={route.id} onSelect={id => navigate({ tab: "projects", id })}
      onOpenEstimator={onOpenEstimator}
      onRequestQuote={id => navigate({ tab: "projects", id, request: true })}
      onCreateOrder={id => navigate({ tab: "projects", id, newOrder: true })}
      onOpenOrder={(id, orderId) => navigate({ tab: "projects", id, orderId })}
      layoutMode={layoutMode}
    />
  );
};
