import { cx, BLUE, NAVY } from "../../styleTokens";
import { PlaceholderPage } from "../PlaceholderPage";
import { BackendStatusCard } from "./BackendStatusCard";
import type { AdminSubPage } from "../../appShell/useHashRoute";
import type { InternalRole } from "../company/staffTypes";
import { ADMIN_GROUPS } from "./adminSections";
import { canAccessSection } from "./adminSectionAccess";

// Tiles are filtered per viewer by canAccessSection (adminSectionAccess.ts),
// which is what that module's own header describes as its client-side job
// ("hidden tiles on AdminDashboard.tsx") -- without it a staff member sees
// tiles for sections AdminRoot.tsx will then refuse with "Not part of your
// role". A super_admin (or a not-yet-assigned role) passes every check and
// so still sees the full catalog. This is UI-side only; the real gate is
// server-side (has_permission()/has_staff_role() in supabase/schema.sql), so
// filtering here can never grant more than the server already allows.
//
// A group with no visible tiles renders nothing at all, rather than an empty
// heading.
export const AdminDashboard = ({ onNavigate, staffRole, myPermissions }: {
  onNavigate: (sub: AdminSubPage) => void;
  staffRole: InternalRole | null;
  myPermissions: ReadonlySet<string>;
}) => (
  <PlaceholderPage
    title="Admin Dashboard"
    description="Control room for Speedpanel admin tools."
  >
    {ADMIN_GROUPS.map(group => {
      const visible = group.items.filter(section => canAccessSection(staffRole, myPermissions, section.key));
      if (visible.length === 0) return null;
      return (
        <div key={group.heading}>
          <div className={cx.sectionLbl}>{group.heading}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.map(section => (
              <button
                key={section.key}
                onClick={() => onNavigate(section.key)}
                className={`${cx.card} relative text-left transition-shadow hover:shadow-md`}
              >
                <div className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
                  <span style={{ color: BLUE }}>{section.icon}</span>{section.label}
                </div>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-300">{section.description}</p>
              </button>
            ))}
          </div>
        </div>
      );
    })}
    <BackendStatusCard />
  </PlaceholderPage>
);
