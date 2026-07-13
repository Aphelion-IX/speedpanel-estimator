import { Package, Layers, Calculator, FileText, ClipboardList, FolderCheck, Users, BarChart3, History, Truck, Factory, Building2, ShieldCheck, Tag, CalendarClock } from "lucide-react";
import { cx, BLUE, NAVY } from "../../styleTokens";
import { PlaceholderPage } from "../PlaceholderPage";
import { BackendStatusCard } from "./BackendStatusCard";
import type { AdminSubPage } from "../../appShell/useHashRoute";
import type { UseAuth } from "../../lib/useAuth";
import { useMyInternalRole } from "./useMyInternalRole";
import { canAccessSection } from "./adminSectionAccess";

type AdminSection = { key: AdminSubPage; label: string; description: string; icon: React.ReactNode };

// Catalog is listed last: those sections have no admin.section.* grants
// seeded in role_permissions (see supabase/schema.sql's Dynamic RBAC
// section), so they're super_admin/null-only by default -- least relevant
// to the day-to-day staff roles who see this page. A super_admin can grant
// any role any section from Admin > Roles without a code deploy.
const ADMIN_GROUPS: { heading: string; items: AdminSection[] }[] = [
  {
    heading: "Workflow",
    items: [
      { key: "requests",  label: "Requests",  description: "Incoming quote and project requests.",     icon: <ClipboardList size={16} /> },
      { key: "projectReviews", label: "Project Reviews", description: "Saved projects awaiting an install or technical review.", icon: <FolderCheck size={16} /> },
      { key: "orders",    label: "Orders",    description: "Customer orders awaiting a pro forma invoice.", icon: <Truck size={16} /> },
      { key: "deliveryRequests", label: "Delivery Requests", description: "Accept, propose a date for, decline, or split customer delivery requests.", icon: <CalendarClock size={16} /> },
      { key: "manufacturing", label: "Manufacturing & Delivery", description: "Update panel manufacturing progress and delivery status for confirmed orders.", icon: <Factory size={16} /> },
    ],
  },
  {
    heading: "People",
    items: [
      { key: "users",     label: "Users",     description: "Signed-up accounts and admin role management.", icon: <Users size={16} /> },
      { key: "companies", label: "Companies", description: "Company workspace records and support visibility.", icon: <Building2 size={16} /> },
      { key: "permissions", label: "Roles", description: "Control which internal roles can access each admin section and action.", icon: <ShieldCheck size={16} /> },
    ],
  },
  {
    heading: "Reports",
    items: [
      { key: "analytics", label: "Analytics", description: "Counts across requests, projects, catalog and users.", icon: <BarChart3 size={16} /> },
      { key: "auditLog",  label: "Audit Log", description: "Install/technical review history.",        icon: <History size={16} /> },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { key: "products",  label: "Products",  description: "Panel, track, fixing, sealant and colour product data.",   icon: <Package size={16} /> },
      { key: "priceLists", label: "Price Lists", description: "Manage PL1 - Standard and any customer-specific price lists.", icon: <Tag size={16} /> },
      { key: "systems",   label: "Systems",   description: "Locked system reference data (Internal/External).", icon: <Layers size={16} /> },
      { key: "maths",     label: "Maths",     description: "Estimate calculation constants (waste, stock lengths, spans).", icon: <Calculator size={16} /> },
      { key: "documents", label: "Documents", description: "Education Hub document library.",          icon: <FileText size={16} /> },
    ],
  },
];

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
