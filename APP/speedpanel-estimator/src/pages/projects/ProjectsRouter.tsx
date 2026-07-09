// =============================================================================
// Projects router
// =============================================================================
// Dispatches the "projects" tab: no session -> SignInGate; session + no id ->
// the list; session + an id -> that project's detail page. Kept as its own
// small component (rather than inlined in App.tsx) so App.tsx's per-route
// JSX block stays a one-liner, same as every other tab.
// =============================================================================
import { cx, MUTED } from "../../styleTokens";
import type { UseAuth } from "../../lib/useAuth";
import type { Route } from "../../appShell/useHashRoute";
import { SignInGate } from "./SignInGate";
import { ProjectsListPage } from "./ProjectsListPage";
import { ProjectDetailPage } from "./ProjectDetailPage";
import { OrderBuilderPage } from "./orders/OrderBuilderPage";
import { OrderDetailPage } from "./orders/OrderDetailPage";
import type { ProjectRow } from "./projectTypes";

export const ProjectsRouter = ({ route, navigate, auth, onOpenEstimator, onRequestQuote }: {
  route: Extract<Route, { tab: "projects" }>;
  navigate: (r: Route) => void;
  auth: UseAuth;
  onOpenEstimator: (project: ProjectRow) => void;
  onRequestQuote: (id: string) => void;
}) => {
  if (auth.loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;
  if (!auth.session) return <SignInGate auth={auth} />;
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
  if (route.id) {
    return (
      <ProjectDetailPage id={route.id}
        onBack={() => navigate({ tab: "projects" })}
        onOpenEstimator={onOpenEstimator}
        onRequestQuote={onRequestQuote}
        onCreateOrder={id => navigate({ tab: "projects", id, newOrder: true })}
        onOpenOrder={(id, orderId) => navigate({ tab: "projects", id, orderId })}
      />
    );
  }
  return <ProjectsListPage user={auth.user} onOpen={id => navigate({ tab: "projects", id })} />;
};
