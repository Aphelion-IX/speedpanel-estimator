// =============================================================================
// Admin > Roles -- editable RBAC matrix for internal StaffRoles
// =============================================================================
// Was Admin > Permissions (external-user granting) -- that functionality
// moved to Admin > Companies: brand-new external accounts now have a
// per-company "Create user" action (CreateCompanyUserForm.tsx), and granting
// an EXISTING account access to a company lives in that company's own
// Members accordion (CompanyMemberList.tsx's isSpeedpanelAdmin path). This
// page is now exclusively the dynamic-RBAC editor: one checkbox per
// (permission_key, StaffRole) pair, wired to admin_set_role_permission()
// (see supabase/schema.sql's "Dynamic RBAC" section for the full mechanism
// and why 'super_admin' is never a column here -- its grandfather clause
// already gives it everything unconditionally).
//
// Kept as the "permissions" AdminSubPage/route key (URL stability,
// #/admin/permissions) even though the label is "Roles" -- see
// adminSectionAccess.ts and AdminDashboard.tsx.
// =============================================================================
import { useState } from "react";
import { cx, MUTED, BLUE } from "../../styleTokens";
import { LoadingState, ErrorState } from "../../ui/states";
import { ErrorDialog } from "../../ui/confirmDialog";
import { Table, type TableColumn } from "../../ui/table";
import { STAFF_ROLES, STAFF_ROLE_LABELS } from "../company/staffTypes";
import { useAdminPermissionMatrix } from "./roles/rolesStore";
import type { PermissionMatrixRow } from "./roles/roleTypes";

type PermissionRow = { key: string; description: string; granted: Partial<Record<typeof STAFF_ROLES[number], boolean>> };

const CATEGORY_LABELS: Record<string, string> = {
  requests: "Requests",
  orders: "Orders",
  manufacturing: "Manufacturing & Delivery",
  delivery: "Delivery Requests",
  project_reviews: "Project Reviews",
  users: "Users",
  companies: "Companies",
  price_lists: "Price Lists",
  audit: "Audit Log",
  nav: "Section visibility",
};
// Anything not listed above (a permission_key category added later that
// this map hasn't caught up with yet) still renders -- just under its own
// raw category string as a fallback heading, never silently dropped.
const CATEGORY_ORDER = [
  "requests", "orders", "manufacturing", "delivery", "project_reviews",
  "users", "companies", "price_lists", "audit", "nav",
];

interface PermissionGroup { category: string; permissions: { key: string; description: string; granted: Partial<Record<typeof STAFF_ROLES[number], boolean>> }[]; }

function groupByCategory(rows: PermissionMatrixRow[]): PermissionGroup[] {
  const byCategory = new Map<string, Map<string, PermissionGroup["permissions"][number]>>();
  for (const row of rows) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, new Map());
    const perms = byCategory.get(row.category)!;
    if (!perms.has(row.permission_key)) perms.set(row.permission_key, { key: row.permission_key, description: row.description, granted: {} });
    perms.get(row.permission_key)!.granted[row.role] = row.granted;
  }
  const categories = [...byCategory.keys()].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return categories.map(category => ({ category, permissions: [...byCategory.get(category)!.values()] }));
}

export const AdminRolesPage = () => {
  const { rows, loading, error, reload, setGrant } = useAdminPermissionMatrix();
  const groups = groupByCategory(rows);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleToggle = async (role: typeof STAFF_ROLES[number], permissionKey: string, next: boolean) => {
    const err = await setGrant(role, permissionKey, next);
    if (err) setActionError(err);
  };

  return (
    <div className="mt-2">
      <ErrorDialog message={actionError} onDismiss={() => setActionError(null)} />
      <h1 className={cx.h1}>Roles</h1>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>
        Control which internal roles can access each admin section and action. super_admin (and any not-yet-assigned
        staff account) always has full access regardless of these grants.
      </p>

      {loading && <LoadingState className="mt-6" label="Loading roles" />}

      {!loading && error && <ErrorState className="mt-6" message={error} onRetry={() => reload()} />}

      {!loading && !error && groups.map(group => {
        const columns: TableColumn<PermissionRow>[] = [
          { key: "permission", header: "Permission", cell: perm => <span className="text-slate-700 dark:text-slate-300">{perm.description}</span> },
          ...STAFF_ROLES.map(role => ({
            key: role,
            header: STAFF_ROLE_LABELS[role],
            align: "center" as const,
            cell: (perm: PermissionRow) => (
              <input
                type="checkbox"
                checked={perm.granted[role] ?? false}
                onChange={e => handleToggle(role, perm.key, e.target.checked)}
                style={{ accentColor: BLUE }}
                className="h-4 w-4 cursor-pointer"
              />
            ),
          })),
        ];
        return (
          <div key={group.category} className="mt-4">
            <div className={cx.cardHd}>{CATEGORY_LABELS[group.category] ?? group.category}</div>
            <div className="mt-2">
              <Table columns={columns} rows={group.permissions} rowKey={perm => perm.key} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
