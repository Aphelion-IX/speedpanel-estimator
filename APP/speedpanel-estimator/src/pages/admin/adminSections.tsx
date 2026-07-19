// =============================================================================
// Admin section catalog -- shared data, no page components
// =============================================================================
// Restored (see supabase/schema.sql -- the business layer/dynamic RBAC was
// deleted, then restored) plus a new "Projects Administration" tile for the
// project browser/create/dashboard cluster added alongside it.
// =============================================================================
import { Package, Layers, Calculator, FileText, ClipboardList, FolderCheck, Users, BarChart3, History, Truck, Factory, Building2, ShieldCheck, Tag, CalendarClock, MessageSquare, LayoutDashboard } from "lucide-react";
import type { AdminSubPage } from "../../appShell/useHashRoute";

export type AdminSection = { key: AdminSubPage; label: string; description: string; icon: React.ReactNode };

export const ADMIN_GROUPS: { heading: string; items: AdminSection[] }[] = [
  {
    heading: "Workflow",
    items: [
      { key: "requests",  label: "Requests",  description: "Incoming quote and project requests.",     icon: <ClipboardList size={16} /> },
      { key: "projectsAdmin", label: "Projects Administration", description: "Dashboard, full project browser and admin-side project creation.", icon: <LayoutDashboard size={16} /> },
      { key: "projectReviews", label: "Project Reviews", description: "Saved projects awaiting an install or technical review.", icon: <FolderCheck size={16} /> },
      { key: "orders",    label: "Orders",    description: "Customer orders awaiting a decision -- revise, issue a pro forma invoice, or cancel.", icon: <Truck size={16} /> },
      { key: "deliveryRequests", label: "Delivery Requests", description: "Accept, propose a date for, decline, or split customer delivery requests.", icon: <CalendarClock size={16} /> },
      { key: "manufacturing", label: "Manufacturing & Delivery", description: "Update panel manufacturing progress and delivery status for confirmed orders.", icon: <Factory size={16} /> },
      { key: "serviceRequests", label: "Support Requests", description: "Technical Review, Pre-Start Meeting, Installation Review and Product Warranty requests.", icon: <MessageSquare size={16} /> },
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
