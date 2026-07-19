// =============================================================================
// Admin section catalog -- shared data, no page components
// =============================================================================
// Deliberately scoped to only the "Projects Administration" tile -- the one
// section actually requested and built this session (see
// AdminProjectsAdministrationPage.tsx). The full pre-deletion tile set
// (Requests, Project Reviews, Orders, Delivery Requests, Manufacturing,
// Support Requests, Users, Companies, Roles, Analytics, Audit Log, Products,
// Price Lists, Systems, Maths, Documents) was never asked for and has been
// removed again -- do not restore it without an explicit request. Their
// underlying route dispatch in AdminRoot.tsx and Supabase schema are left
// untouched.
// =============================================================================
import { LayoutDashboard } from "lucide-react";
import type { AdminSubPage } from "../../appShell/useHashRoute";

export type AdminSection = { key: AdminSubPage; label: string; description: string; icon: React.ReactNode };

export const ADMIN_GROUPS: { heading: string; items: AdminSection[] }[] = [
  {
    heading: "Workflow",
    items: [
      { key: "projectsAdmin", label: "Projects Administration", description: "Dashboard, full project browser and admin-side project creation.", icon: <LayoutDashboard size={16} /> },
    ],
  },
];
