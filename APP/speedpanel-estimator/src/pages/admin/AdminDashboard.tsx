import { cx, BLUE, NAVY } from "../../styleTokens";
import { PlaceholderPage } from "../PlaceholderPage";
import { BackendStatusCard } from "./BackendStatusCard";
import type { AdminSubPage } from "../../appShell/useHashRoute";
import type { UseAuth } from "../../lib/useAuth";
import { useMyInternalRole } from "./useMyInternalRole";
import { canAccessSection } from "./adminSectionAccess";
import { ADMIN_GROUPS } from "./adminSections";

export const AdminDashboard = ({ onNavigate, auth }: { onNavigate: (sub: AdminSubPage) => void; auth: UseAuth }) => {
  const { staffRole, myPermissions } = useMyInternalRole(auth.user?.id ?? null);
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
            {group.items.map(section => (
              <button
                key={section.key}
                onClick={() => onNavigate(section.key)}
                className={`${cx.card} text-left transition-shadow hover:shadow-md`}
              >
                <div className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
                  <span style={{ color: BLUE }}>{section.icon}</span>{section.label}
                </div>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
      <BackendStatusCard />
    </PlaceholderPage>
  );
};
