// =============================================================================
// Company router
// =============================================================================
// Dispatches the "company" tab's sub-pages -- same small-dispatcher shape as
// ProjectsRouter.tsx/AdminRoot.tsx. Company creation is Speedpanel-admin-only
// (see NoCompanyPage.tsx) -- "team"/"activity" need an active company
// membership; a signed-in user with zero memberships gets the informational
// NoCompanyPage instead of a creation form.
// =============================================================================
import { cx, MUTED } from "../../styleTokens";
import type { Route } from "../../appShell/useHashRoute";
import type { UseCompanyMemberships } from "../../lib/useCompanyMemberships";
import { NoCompanyPage } from "./NoCompanyPage";
import { CompanyTeamPage } from "./CompanyTeamPage";
import { CompanyActivityLogPage } from "./CompanyActivityLogPage";

export const CompanyRouter = ({ route, navigate, userId, company }: {
  route: Extract<Route, { tab: "company" }>;
  navigate: (r: Route) => void;
  userId: string | null;
  company: UseCompanyMemberships;
}) => {
  const onBack = () => navigate({ tab: "projects" });

  if (company.loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (!company.activeCompanyId || !company.activeMembership || !userId) {
    return <NoCompanyPage onBack={onBack} />;
  }

  if (route.sub === "activity") {
    return <CompanyActivityLogPage companyId={company.activeCompanyId} onBack={onBack} />;
  }

  return (
    <CompanyTeamPage companyId={company.activeCompanyId} myUserId={userId} myRole={company.activeMembership.role} onBack={onBack} />
  );
};
