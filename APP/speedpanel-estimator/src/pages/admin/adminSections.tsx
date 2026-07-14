// =============================================================================
// Admin section catalog -- shared data, no page components
// =============================================================================
// Extracted out of AdminDashboard.tsx so the Home overview dashboard
// (src/pages/home/OverviewDashboardPage.tsx) can reuse the same "Workflow"
// tiles for signed-in staff without importing AdminDashboard.tsx itself --
// this file only holds labels/descriptions/icons, no admin sub-page
// components, so pulling it into the main bundle doesn't defeat AdminRoot's
// own lazy-loading (see App.tsx's comment on the AdminRoot lazy import).
// =============================================================================
import { Package, Layers, Calculator, FileText, ClipboardList, FolderCheck, Users, BarChart3, History, Truck, Factory, Building2, ShieldCheck, Tag, CalendarClock } from "lucide-react";
import type { AdminSubPage } from "../../appShell/useHashRoute";

export type AdminSection = { key: AdminSubPage; label: string; description: string; icon: React.ReactNode };

// Catalog is listed last: those sections have no admin.section.* grants
// seeded in role_permissions (see supabase/schema.sql's Dynamic RBAC
// section), so they're super_admin/null-only by default -- least relevant
// to the day-to-day staff roles who see this page. A super_admin can grant
// any role any section from Admin > Roles without a code deploy.
export const ADMIN_GROUPS: { heading: string; items: AdminSection[] }[] = [
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
