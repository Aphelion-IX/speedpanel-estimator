// =============================================================================
// Admin section catalog -- shared data, no page components
// =============================================================================
// Every section AdminRoot.tsx dispatches has a tile here, so nothing is
// reachable only by typing its hash URL. The catalog had been trimmed to
// Projects Administration / Orders / Delivery Requests while the rest of the
// UI was rebuilt, which left twelve fully-built, working admin pages with no
// way into them from the dashboard; restored on explicit request.
//
// adminSections.test.ts asserts this list and AdminRoot.tsx's dispatch stay
// in sync in BOTH directions -- a new admin page can't ship unreachable, and
// a tile can't point at a section that no longer dispatches.
//
// Tiles are filtered per viewer by canAccessSection (adminSectionAccess.ts)
// in AdminDashboard.tsx, so a staff member only sees the sections their
// internal role actually grants -- listing a section here does not make it
// visible to everyone. Real enforcement is server-side regardless
// (has_permission()/has_staff_role() in supabase/schema.sql).
//
// "companies"/"priceLists" are deliberately absent: both were retired from
// Admin in Phase 14 and now live in the Company Accounts & Pricing workspace
// (#/accounts), with #/admin/companies and #/admin/priceLists redirecting
// there -- see useHashRoute.ts. They are not AdminSubPage values any more.
// =============================================================================
import {
  Package, Layers, Calculator, FileText, ClipboardList, FolderCheck, Users,
  BarChart3, History, Truck, Factory, ShieldCheck, CalendarClock,
  LayoutDashboard, MessageSquare,
} from "lucide-react";
import type { AdminSubPage } from "../../appShell/useHashRoute";

export type AdminSection = { key: AdminSubPage; label: string; description: string; icon: React.ReactNode };

export const ADMIN_GROUPS: { heading: string; items: AdminSection[] }[] = [
  {
    heading: "Workflow",
    items: [
      { key: "projectsAdmin", label: "Projects Administration", description: "Dashboard, full project browser and admin-side project creation.", icon: <LayoutDashboard size={16} /> },
      { key: "requests", label: "Requests", description: "Incoming quote and project requests.", icon: <ClipboardList size={16} /> },
      { key: "projectReviews", label: "Project Reviews", description: "Saved projects awaiting an install or technical review.", icon: <FolderCheck size={16} /> },
      { key: "orders", label: "Orders", description: "Customer orders awaiting a decision -- revise, issue a pro forma invoice, or cancel.", icon: <Truck size={16} /> },
      { key: "deliveryRequests", label: "Delivery Requests", description: "Accept, propose a date for, decline, or split customer delivery requests.", icon: <CalendarClock size={16} /> },
      { key: "manufacturing", label: "Manufacturing & Delivery", description: "Update panel manufacturing progress and delivery status for confirmed orders.", icon: <Factory size={16} /> },
      { key: "serviceRequests", label: "Support Requests", description: "Triage and respond to customer service requests.", icon: <MessageSquare size={16} /> },
    ],
  },
  {
    heading: "People",
    items: [
      { key: "users", label: "Users", description: "Signed-up accounts and admin role management.", icon: <Users size={16} /> },
      { key: "permissions", label: "Roles", description: "Control which internal roles can access each admin section and action.", icon: <ShieldCheck size={16} /> },
    ],
  },
  {
    heading: "Reports",
    items: [
      { key: "analytics", label: "Analytics", description: "Counts across requests, projects, catalog and users.", icon: <BarChart3 size={16} /> },
      { key: "auditLog", label: "Audit Log", description: "Install/technical review history.", icon: <History size={16} /> },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { key: "products", label: "Products", description: "Panel, track, fixing, sealant and colour product data.", icon: <Package size={16} /> },
      { key: "systems", label: "Systems", description: "Locked system reference data (Internal/External).", icon: <Layers size={16} /> },
      { key: "maths", label: "Maths", description: "Estimate calculation constants (waste, stock lengths, spans).", icon: <Calculator size={16} /> },
      { key: "documents", label: "Documents", description: "Education Hub document library.", icon: <FileText size={16} /> },
    ],
  },
];
