// =============================================================================
// Company router
// =============================================================================
// Dispatches the "company" tab's three sub-pages -- same small-dispatcher
// shape as ProjectsRouter.tsx/AdminRoot.tsx. "create" always works (any
// signed-in user); "team"/"activity" need an active company membership --
// falls back to the create flow if there isn't one yet, rather than a bare
// error, since that's the actionable next step either way.
// =============================================================================
import { cx, MUTED } from "../../styleTokens";
import type { Route } from "../../appShell/useHashRoute";
import type { UseCompanyMemberships } from "../../lib/useCompanyMemberships";
import { CreateCompanyPage } from "./CreateCompanyPage";
import { CompanyTeamPage } from "./CompanyTeamPage";
import { CompanyActivityLogPage } from "./CompanyActivityLogPage";

export const CompanyRouter = ({ route, navigate, userId, company }: {
  route: Extract<Route, { tab: "company" }>;
  navigate: (r: Route) => void;
  userId: string | null;
  company: UseCompanyMemberships;
}) => {
  const onBack = () => navigate({ tab: "projects" });

  if (route.sub === "create") {
    return <CreateCompanyPage onCreated={() => { company.reload(); navigate({ tab: "company", sub: "team" }); }} onBack={onBack} />;
  }

  if (company.loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (!company.activeCompanyId || !company.activeMembership || !userId) {
    return <CreateCompanyPage onCreated={() => { company.reload(); navigate({ tab: "company", sub: "team" }); }} onBack={onBack} />;
  }

  if (route.sub === "activity") {
    return <CompanyActivityLogPage companyId={company.activeCompanyId} onBack={onBack} />;
  }

  return (
    <CompanyTeamPage companyId={company.activeCompanyId} myUserId={userId} myRole={company.activeMembership.role} onBack={onBack} />
  );
};
