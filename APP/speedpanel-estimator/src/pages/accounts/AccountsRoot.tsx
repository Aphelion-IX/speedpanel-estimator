// =============================================================================
// Company Accounts & Pricing root -- lazy-loaded entry point for the whole
// workspace
// =============================================================================
// Mirrors AdminRoot.tsx's role: App.tsx only ever renders this via
// React.lazy()/Suspense, gated behind AdminGate the same "Speedpanel staff
// account only" way Admin is (see docs/company-accounts-pricing plan for why
// this is a standalone top-level workspace rather than nested under Admin --
// its own dashboard tile grid has no live tiles pointing at Companies/Price
// Lists/Permissions today, so there's no existing IA to integrate with).
//
// Unlike AdminRoot.tsx (a bare dispatcher -- AdminProjectsAdministrationPage.tsx
// supplies its own persistent sidebar internally), every one of this
// workspace's screens shares the SAME persistent left-nav (see the design
// screenshots -- identical sidebar across all 14), so that nav lives here
// once, in the .cap-layout/.cap-side/.cap-nav shell (accountsTheme.css),
// with route.sub dispatch on the right (.cap-page) -- a hybrid of both
// existing patterns.
//
// Per-section permission gating (mirroring adminSectionAccess.ts's
// admin.section.* keys) is deferred -- Phase 1 gates the whole workspace on
// isInternalStaff only (same as AdminGate), and can grow granular per-section
// keys once each real sub-page's own backend work lands (see the phased plan).
// =============================================================================
import {
  LayoutDashboard, Building2, Users, Mail, DollarSign, ListTree, Lock, History,
} from "lucide-react";
import type { Route } from "../../appShell/useHashRoute";
import type { AccountsSubPage } from "../../appShell/useHashRoute";
import type { UseAuth } from "../../lib/useAuth";
import type { EffectiveLayout } from "../../useLayoutMode";
import { AdminGate } from "../../appShell/AdminGate";
import { useMyInternalRole } from "../admin/useMyInternalRole";
import { PlaceholderPage } from "../PlaceholderPage";
import "./accountsTheme.css";
import { ControlRoomPage } from "./ControlRoomPage";
import { CompaniesListPage } from "./companies/CompaniesListPage";
import { CompanyWizard } from "./companies/CompanyWizard";
import { CompanyOverviewPage } from "./companies/CompanyOverviewPage";
import { InvitationsPage } from "./invitations/InvitationsPage";
import { PriceListsPage } from "./priceLists/PriceListsPage";
import { PriceListVersionEditor } from "./priceLists/PriceListVersionEditor";
import { AccessPermissionsPage } from "./permissions/AccessPermissionsPage";
import { AuditHistoryPage } from "./audit/AuditHistoryPage";

const NAV: { id: AccountsSubPage; label: string; icon: React.ReactNode; group: string }[] = [
  { id: "controlRoom", label: "Control Room", icon: <LayoutDashboard size={15} />, group: "Workspace" },
  { id: "companies", label: "Companies", icon: <Building2 size={15} />, group: "Account Management" },
  { id: "companyUsers", label: "Company Users", icon: <Users size={15} />, group: "Account Management" },
  { id: "invitations", label: "Invitations", icon: <Mail size={15} />, group: "Account Management" },
  { id: "companyPricing", label: "Company Pricing", icon: <DollarSign size={15} />, group: "Account Management" },
  { id: "priceLists", label: "Price Lists", icon: <ListTree size={15} />, group: "Account Management" },
  { id: "permissions", label: "Permissions", icon: <Lock size={15} />, group: "Account Management" },
  { id: "auditHistory", label: "Audit History", icon: <History size={15} />, group: "Account Management" },
];

// Sub-pages not yet built (later phases) fall back to this shared stub --
// same "swap out page-by-page" convention PlaceholderPage.tsx already
// documents for the Admin section.
const COMING_SOON: Partial<Record<AccountsSubPage, { title: string; description: string }>> = {
  companyUsers: { title: "Company Users", description: "Cross-company external-user roster -- coming in a later phase." },
  companyPricing: { title: "Company Pricing", description: "Per-company item price overrides and pricing preview -- coming in a later phase." },
};

export const AccountsRoot = ({ route, navigate, auth, layoutMode }: {
  route: Extract<Route, { tab: "accounts" }>;
  navigate: (r: Route) => void;
  auth: UseAuth;
  layoutMode: EffectiveLayout;
}) => {
  const { isInternalStaff, loading: roleLoading } = useMyInternalRole(auth.user?.id ?? null);
  const groups = Array.from(new Set(NAV.map(n => n.group)));

  return (
    <div className="cap-shell mt-2">
      <AdminGate isInternalStaff={isInternalStaff} loading={roleLoading}>
        <div className="cap-layout">
          <aside className="cap-side">
            {groups.map(group => (
              <div key={group} className="cap-nav-group">
                <div className="cap-nav-title">{group}</div>
                <nav className="cap-nav">
                  {NAV.filter(n => n.group === group).map(n => (
                    <button
                      key={n.id}
                      className={n.id === route.sub ? "active" : ""}
                      onClick={() => navigate({ tab: "accounts", sub: n.id })}
                    >
                      {n.icon}{n.label}
                    </button>
                  ))}
                </nav>
              </div>
            ))}
          </aside>

          <div className="cap-page">
            {route.sub === "controlRoom" && <ControlRoomPage navigate={navigate} />}
            {route.sub === "companies" && route.newCompany && <CompanyWizard navigate={navigate} />}
            {route.sub === "companies" && !route.newCompany && route.companyId && (
              <CompanyOverviewPage companyId={route.companyId} myUserId={auth.user?.id ?? null} navigate={navigate} />
            )}
            {route.sub === "companies" && !route.newCompany && !route.companyId && <CompaniesListPage navigate={navigate} />}
            {route.sub === "invitations" && <InvitationsPage navigate={navigate} />}
            {route.sub === "priceLists" && route.priceListId && (
              <PriceListVersionEditor priceListId={route.priceListId} layoutMode={layoutMode} navigate={navigate} />
            )}
            {route.sub === "priceLists" && !route.priceListId && <PriceListsPage navigate={navigate} />}
            {route.sub === "permissions" && <AccessPermissionsPage />}
            {route.sub === "auditHistory" && <AuditHistoryPage />}
            {COMING_SOON[route.sub] && (
              <PlaceholderPage title={COMING_SOON[route.sub]!.title} description={COMING_SOON[route.sub]!.description} />
            )}
          </div>
        </div>
      </AdminGate>
    </div>
  );
};
