// =============================================================================
// Company Accounts & Pricing -- Access Permissions curated label map (Phase 12)
// =============================================================================
// Translates admin_list_permission_matrix()'s raw (permission_key, role,
// granted) rows into a curated capability x role grid -- CATEGORY_LABELS/
// CATEGORY_ORDER is a superset of AdminRolesPage.tsx's own map (which
// predates several later phases' new categories -- company_addresses/
// company_price_overrides/invitations/orders_operations/projects/
// projects_operations/service_requests all needed adding here), with 'nav'
// deliberately EXCLUDED -- those keys gate which admin sidebar tabs a role
// sees, not a real capability, and don't belong on a page about what a role
// can actually DO.
//
// deriveCapabilityStatus() is a from-scratch design call, not a literal
// implementation of the mockup's own richer Full/View/Assigned/Request/
// Limited/Hidden/No vocabulary -- role_permissions is a plain boolean grant
// per (role, permission_key), which can't by itself distinguish "View" from
// "Assigned" from "Limited". Every capability category bundles multiple
// permission keys (e.g. "Price Lists" = price_lists.create/read/publish/...),
// so the honest, data-backed status is whether a role holds ALL of a
// category's keys (Full), SOME (Partial), or NONE (No access) -- collapsing
// the mockup's 7-value vocabulary down to 3 values that are always directly
// backed by real grants, rather than fabricating nuance the data can't
// support.
// =============================================================================
import type { PermissionMatrixRow } from "../../admin/roles/roleTypes";

export const CAPABILITY_CATEGORY_LABELS: Record<string, string> = {
  requests: "Incoming Requests",
  orders: "Orders",
  orders_operations: "Order Operations",
  manufacturing: "Manufacturing & Delivery",
  delivery: "Delivery Requests",
  project_reviews: "Project Reviews",
  projects: "Projects",
  projects_operations: "Project Operations",
  users: "Staff & Users",
  companies: "Company Management",
  company_addresses: "Company Addresses",
  company_price_overrides: "Item Price Overrides",
  price_lists: "Price Lists",
  invitations: "Invitations",
  service_requests: "Support & Services",
  audit: "Audit Trail",
};

// Anything not listed (a category a future phase adds that this map hasn't
// caught up with yet) still renders, under its own raw category string as a
// fallback heading -- same "never silently drop it" convention
// AdminRolesPage.tsx's own CATEGORY_LABELS already established.
export const CAPABILITY_CATEGORY_ORDER = [
  "companies", "company_addresses", "company_price_overrides", "invitations",
  "price_lists", "projects", "projects_operations", "orders", "orders_operations",
  "delivery", "manufacturing", "project_reviews", "requests", "service_requests",
  "users", "audit",
];

export type CapabilityStatus = "full" | "partial" | "none";

export const CAPABILITY_STATUS_LABEL: Record<CapabilityStatus, string> = {
  full: "Full", partial: "Partial", none: "No access",
};
export const CAPABILITY_STATUS_TONE: Record<CapabilityStatus, "ok" | "warn" | "neutral"> = {
  full: "ok", partial: "warn", none: "neutral",
};

// A role holds a category's capability in Full if it has EVERY permission
// key bundled into that category, Partial if it has some (but not all), and
// No access if it has none. A category with zero rows for a role (shouldn't
// happen -- admin_list_permission_matrix() cross-joins every key against
// every role) also reads as "none", failing safe rather than showing a
// misleading Full.
export function deriveCapabilityStatus(rows: PermissionMatrixRow[]): CapabilityStatus {
  if (rows.length === 0) return "none";
  const grantedCount = rows.filter(r => r.granted).length;
  if (grantedCount === 0) return "none";
  if (grantedCount === rows.length) return "full";
  return "partial";
}
