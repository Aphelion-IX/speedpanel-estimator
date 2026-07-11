// =============================================================================
// Admin root -- lazy-loaded entry point for the whole Admin section
// =============================================================================
// App.tsx only ever renders this via React.lazy()/Suspense -- none of the ten
// Admin*Page components (nor AdminGate) are in the initial page-load bundle,
// since a typical customer never visits /admin. Contains exactly the JSX
// that used to live inline in App.tsx's `route.tab === "admin"` block; the
// dashboard/back-button/sub-page dispatch logic is unchanged, just relocated.
//
// canAccessSection (adminSectionAccess.ts) gates direct navigation to a
// section, not just AdminDashboard.tsx's tiles -- someone who types
// #/admin/companies into the address bar gets the same "not part of your
// role" message a hidden tile implies, not the actual page. This is
// UI-side only; the real enforcement is server-side (has_staff_role() in
// supabase/schema.sql), so this check can never grant more than the server
// would already allow.
// =============================================================================
import { BLUE, NAVY, MUTED, cx } from "../../styleTokens";
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
import { useMyInternalRole } from "./useMyInternalRole";
import { canAccessSection } from "./adminSectionAccess";

export const AdminRoot = ({ route, navigate, layoutMode, auth }: {
  route: Extract<Route, { tab: "admin" }>;
  navigate: (r: Route) => void;
  layoutMode: EffectiveLayout;
  auth: UseAuth;
}) => {
  const { staffRole, loading: roleLoading } = useMyInternalRole(auth.user?.id ?? null);
  const allowed = roleLoading || canAccessSection(staffRole, route.sub);

  return (
    <div className="mt-6">
      <AdminGate>
        {route.sub === "dashboard" && (
          <AdminDashboard onNavigate={sub => navigate({ tab: "admin", sub })} auth={auth} />
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
            {!allowed && (
              <div className={`${cx.card} mt-3`}>
                <p className="text-sm font-semibold" style={{ color: NAVY }}>Not part of your role</p>
                <p className={cx.footnote} style={{ paddingTop: 0, color: MUTED }}>This section isn't available for your internal role.</p>
              </div>
            )}
            {allowed && route.sub === "products"  && <AdminProductsPage layoutMode={layoutMode} />}
            {allowed && route.sub === "systems"   && <AdminSystemsPage layoutMode={layoutMode} />}
            {allowed && route.sub === "maths"     && <AdminMathsPage />}
            {allowed && route.sub === "documents" && <AdminDocumentsPage layoutMode={layoutMode} />}
            {allowed && route.sub === "requests"  && <AdminRequestsPage />}
            {allowed && route.sub === "projectReviews" && <AdminProjectsPage />}
            {allowed && route.sub === "users"     && <AdminUsersPage auth={auth} />}
            {allowed && route.sub === "analytics" && <AdminAnalyticsPage />}
            {allowed && route.sub === "auditLog"  && <AdminAuditLogPage />}
            {allowed && route.sub === "orders"    && <AdminOrdersPage />}
            {allowed && route.sub === "manufacturing" && <AdminManufacturingPage />}
            {allowed && route.sub === "companies" && <AdminCompaniesPage auth={auth} />}
            {allowed && route.sub === "myAssignments" && <AdminMyAssignmentsPage auth={auth} />}
          </>
        )}
      </AdminGate>
    </div>
  );
};
