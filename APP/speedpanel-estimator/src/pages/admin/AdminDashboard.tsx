import { cx, BLUE, NAVY, GOLD } from "../../styleTokens";
import { PlaceholderPage } from "../PlaceholderPage";
import { BackendStatusCard } from "./BackendStatusCard";
import type { AdminSubPage } from "../../appShell/useHashRoute";
import type { UseAuth } from "../../lib/useAuth";
import { useMyInternalRole } from "./useMyInternalRole";
import { canAccessSection } from "./adminSectionAccess";
import { ADMIN_GROUPS } from "./adminSections";
import { useWorkflowCounts } from "./useWorkflowCounts";

// Workflow tile key -> its live "awaiting action" count, when one exists.
// Sections outside the Workflow group (People/Reports/Catalog) simply never
// match here, so they never get a badge.
const WORKFLOW_COUNT_KEYS: Partial<Record<AdminSubPage, "requests" | "projectReviews" | "orders" | "deliveryRequests" | "manufacturing">> = {
  requests: "requests",
  projectReviews: "projectReviews",
  orders: "orders",
  deliveryRequests: "deliveryRequests",
  manufacturing: "manufacturing",
};

export const AdminDashboard = ({ onNavigate, auth }: { onNavigate: (sub: AdminSubPage) => void; auth: UseAuth }) => {
  const { staffRole, myPermissions, loading: staffRoleLoading } = useMyInternalRole(auth.user?.id ?? null);
  const counts = useWorkflowCounts(auth.user?.id ?? null, staffRole, staffRoleLoading);
  const visibleGroups = ADMIN_GROUPS
    .map(group => ({ ...group, items: group.items.filter(item => canAccessSection(staffRole, myPermissions, item.key)) }))
    .filter(group => group.items.length > 0);

  return (
    <PlaceholderPage
      title="Admin Dashboard"
      description="Control room for Speedpanel admin tools."
    >
      {visibleGroups.map(group => (
        <div key={group.heading}>
          <div className={cx.sectionLbl}>{group.heading}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.items.map(section => {
              const countKey = WORKFLOW_COUNT_KEYS[section.key];
              const count = countKey ? counts[countKey] : null;
              return (
                <button
                  key={section.key}
                  onClick={() => onNavigate(section.key)}
                  className={`${cx.card} relative text-left transition-shadow hover:shadow-md`}
                >
                  {count !== null && count > 0 && (
                    <span className="absolute -top-2 -right-2 grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: GOLD }}>
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
                    <span style={{ color: BLUE }}>{section.icon}</span>{section.label}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-300">{section.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <BackendStatusCard />
    </PlaceholderPage>
  );
};
