// =============================================================================
// Admin root -- lazy-loaded entry point for the whole Admin section
// =============================================================================
// App.tsx only ever renders this via React.lazy()/Suspense -- none of the ten
// Admin*Page components (nor AdminGate) are in the initial page-load bundle,
// since a typical customer never visits /admin. Contains exactly the JSX
// that used to live inline in App.tsx's `route.tab === "admin"` block; the
// dashboard/back-button/sub-page dispatch logic is unchanged, just relocated.
// =============================================================================
import { BLUE } from "../../styleTokens";
import type { EffectiveLayout } from "../../useLayoutMode";
import type { UseAuth } from "../../lib/useAuth";
import type { Route } from "../../appShell/useHashRoute";
import { AdminGate } from "../../appShell/AdminGate";
import { AdminDashboard } from "./AdminDashboard";
import { AdminProductsPage } from "./AdminProductsPage";
import { AdminSystemsPage } from "./AdminSystemsPage";
import { AdminMathsPage } from "./AdminMathsPage";
import { AdminDocumentsPage } from "./AdminDocumentsPage";
import { AdminRequestsPage } from "./AdminRequestsPage";
import { AdminProjectsPage } from "./projects/AdminProjectsPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { AdminAnalyticsPage } from "./AdminAnalyticsPage";
import { AdminAuditLogPage } from "./AdminAuditLogPage";
import { AdminOrdersPage } from "./AdminOrdersPage";
import { AdminManufacturingPage } from "./AdminManufacturingPage";
import { AdminCompaniesPage } from "./AdminCompaniesPage";
import { AdminMyAssignmentsPage } from "./myAssignments/AdminMyAssignmentsPage";

export const AdminRoot = ({ route, navigate, layoutMode, auth }: {
  route: Extract<Route, { tab: "admin" }>;
  navigate: (r: Route) => void;
  layoutMode: EffectiveLayout;
  auth: UseAuth;
}) => (
  <div className="mt-6">
    <AdminGate>
      {route.sub === "dashboard" && (
        <AdminDashboard onNavigate={sub => navigate({ tab: "admin", sub })} />
      )}
      {route.sub !== "dashboard" && (
        <>
          <button
            onClick={() => navigate({ tab: "admin", sub: "dashboard" })}
            className="text-sm font-semibold hover:underline"
            style={{ color: BLUE }}
          >
            &larr; Back to Admin
          </button>
          {route.sub === "products"  && <AdminProductsPage layoutMode={layoutMode} />}
          {route.sub === "systems"   && <AdminSystemsPage layoutMode={layoutMode} />}
          {route.sub === "maths"     && <AdminMathsPage />}
          {route.sub === "documents" && <AdminDocumentsPage layoutMode={layoutMode} />}
          {route.sub === "requests"  && <AdminRequestsPage />}
          {route.sub === "projectReviews" && <AdminProjectsPage />}
          {route.sub === "users"     && <AdminUsersPage auth={auth} />}
          {route.sub === "analytics" && <AdminAnalyticsPage />}
          {route.sub === "auditLog"  && <AdminAuditLogPage />}
          {route.sub === "orders"    && <AdminOrdersPage />}
          {route.sub === "manufacturing" && <AdminManufacturingPage />}
          {route.sub === "companies" && <AdminCompaniesPage auth={auth} />}
          {route.sub === "myAssignments" && <AdminMyAssignmentsPage auth={auth} />}
        </>
      )}
    </AdminGate>
  </div>
);
