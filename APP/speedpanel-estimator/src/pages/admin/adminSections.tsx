// =============================================================================
// Admin section catalog -- shared data, no page components
// =============================================================================
// Scoped to "Projects Administration" plus Orders/Delivery Requests -- the
// internal Orders admin UI (order queue, order review, pricing & fees,
// technical hold, delivery review -- see AdminOrdersPage.tsx and
// deliveryRequests/AdminDeliveryRequestsPage.tsx) was fully built and
// mockup-restyled but had no dashboard tile pointing at it, so it was
// unreachable; restored on explicit request. The rest of the pre-deletion
// tile set (Requests, Project Reviews, Manufacturing, Support Requests,
// Users, Companies, Roles, Analytics, Audit Log, Products, Price Lists,
// Systems, Maths, Documents) is still out of scope -- do not restore those
// without their own explicit request. Their underlying route dispatch in
// AdminRoot.tsx and Supabase schema are left untouched either way.
// =============================================================================
import { LayoutDashboard, Truck, CalendarClock } from "lucide-react";
import type { AdminSubPage } from "../../appShell/useHashRoute";

export type AdminSection = { key: AdminSubPage; label: string; description: string; icon: React.ReactNode };

export const ADMIN_GROUPS: { heading: string; items: AdminSection[] }[] = [
  {
    heading: "Workflow",
    items: [
      { key: "projectsAdmin", label: "Projects Administration", description: "Dashboard, full project browser and admin-side project creation.", icon: <LayoutDashboard size={16} /> },
      { key: "orders", label: "Orders", description: "Customer orders awaiting a decision -- revise, issue a pro forma invoice, or cancel.", icon: <Truck size={16} /> },
      { key: "deliveryRequests", label: "Delivery Requests", description: "Accept, propose a date for, decline, or split customer delivery requests.", icon: <CalendarClock size={16} /> },
    ],
  },
];
