// =============================================================================
// Overview dashboard -- signed-in front door
// =============================================================================
// Shown at "/" (the home route, see useHashRoute.ts) whenever there's a
// session. Genuinely different content per audience, not just a filtered
// nav mirror: internal staff (profiles.role = 'admin', see
// useMyInternalRole.ts's isInternalStaff) lead with their permission-
// filtered operational work queue (the same "Workflow" tiles/gating
// AdminDashboard.tsx already uses, reused via adminSections.ts rather than
// reimplemented); external customers get a plain tools grid with no admin
// surface area at all.
// =============================================================================
import { Calculator, LayoutGrid, BookOpen, FolderKanban, ArrowRight } from "lucide-react";
import { cx, BLUE, NAVY } from "../../styleTokens";
import { PlaceholderPage } from "../PlaceholderPage";
import { useMyInternalRole } from "../admin/useMyInternalRole";
import { canAccessSection } from "../admin/adminSectionAccess";
import { ADMIN_GROUPS } from "../admin/adminSections";
import type { Route } from "../../appShell/useHashRoute";
import type { UseAuth } from "../../lib/useAuth";

const TOOLS: { label: string; description: string; icon: React.ReactNode; route: Route }[] = [
  { label: "System Estimator", description: "Build and price a wall system.", icon: <Calculator size={16} />, route: { tab: "estimator" } },
  { label: "System Selector",  description: "Find the right system for your project.", icon: <LayoutGrid size={16} />, route: { tab: "selector" } },
  { label: "Projects",         description: "View and manage your saved projects, quotes and orders.", icon: <FolderKanban size={16} />, route: { tab: "projects" } },
  { label: "Education Hub",    description: "Product documentation and guides.", icon: <BookOpen size={16} />, route: { tab: "education" } },
];

const Tile = ({ label, description, icon, onClick }: { label: string; description: string; icon: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick} className={`${cx.card} text-left transition-shadow hover:shadow-md`}>
    <div className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
      <span style={{ color: BLUE }}>{icon}</span>{label}
    </div>
    <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </button>
);

export const OverviewDashboardPage = ({ auth, navigate }: { auth: UseAuth; navigate: (route: Route) => void }) => {
  const { isInternalStaff, staffRole, myPermissions } = useMyInternalRole(auth.user?.id ?? null);
  const workflowItems = ADMIN_GROUPS.find(g => g.heading === "Workflow")!.items
    .filter(item => canAccessSection(staffRole, myPermissions, item.key));

  return (
    <PlaceholderPage
      title="Home"
      description={isInternalStaff ? "Your work queue and quick access to the rest of the app." : "Quick access to the rest of the app."}
    >
      {isInternalStaff && workflowItems.length > 0 && (
        <div>
          <div className={cx.sectionLbl}>Staff workflow</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {workflowItems.map(item => (
              <Tile key={item.key} label={item.label} description={item.description} icon={item.icon}
                onClick={() => navigate({ tab: "admin", sub: item.key })} />
            ))}
          </div>
        </div>
      )}

      {isInternalStaff && (
        <button onClick={() => navigate({ tab: "admin", sub: "dashboard" })}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: BLUE }}>
          More in Admin <ArrowRight size={14} />
        </button>
      )}

      <div>
        <div className={cx.sectionLbl}>{isInternalStaff ? "Tools" : "Your tools"}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOOLS.map(tool => (
            <Tile key={tool.label} label={tool.label} description={tool.description} icon={tool.icon}
              onClick={() => navigate(tool.route)} />
          ))}
        </div>
      </div>
    </PlaceholderPage>
  );
};
