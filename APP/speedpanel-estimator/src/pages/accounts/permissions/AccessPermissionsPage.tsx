// =============================================================================
// Company Accounts & Pricing -- Access Permissions (curated view, Phase 12)
// =============================================================================
// A read-only, curated summary of the SAME role_permissions data
// AdminRolesPage.tsx's raw checkbox editor already exposes -- not a new
// grant model, not a rewrite of that page (which staff still use to
// actually change a grant). This page answers "what can each role do,
// roughly" at a glance; that one answers "toggle this exact permission key
// for this exact role." Reuses useAdminPermissionMatrix() (Admin > Roles'
// own data hook) verbatim rather than a parallel fetch.
// =============================================================================
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { LoadingState, ErrorState } from "../../../ui/states";
import { Badge } from "../../../ui/badge";
import { Table, type TableColumn } from "../../../ui/table";
import { useAdminPermissionMatrix } from "../../admin/roles/rolesStore";
import type { PermissionMatrixRow } from "../../admin/roles/roleTypes";
import { STAFF_ROLES, STAFF_ROLE_LABELS, type StaffRole } from "../../company/staffTypes";
import { COMPANY_ROLE_LABELS } from "../../company/companyTypes";
import {
  CAPABILITY_CATEGORY_LABELS, CAPABILITY_CATEGORY_ORDER, CAPABILITY_STATUS_LABEL, CAPABILITY_STATUS_TONE,
  deriveCapabilityStatus, type CapabilityStatus,
} from "./capabilityLabelMap";

// Synthetic -- not a real role_permissions column (super_admin's access is
// the has_staff_role(array[]::text[]) grandfather clause, unconditional and
// ungated by any row here), but every one of the 14 mockup screens this
// module is built against shows Super Admin as the grid's own first column,
// so it's rendered here too, always "Full".
const SUPER_ADMIN_COLUMN = "super_admin" as const;
type GridRole = StaffRole | typeof SUPER_ADMIN_COLUMN;
const GRID_ROLES: GridRole[] = [SUPER_ADMIN_COLUMN, ...STAFF_ROLES];
const GRID_ROLE_LABELS: Record<GridRole, string> = { [SUPER_ADMIN_COLUMN]: "Super Admin", ...STAFF_ROLE_LABELS };

interface CapabilityRow { category: string; label: string; status: Record<GridRole, CapabilityStatus>; }

function buildCapabilityRows(matrixRows: PermissionMatrixRow[]): CapabilityRow[] {
  const byCategory = new Map<string, PermissionMatrixRow[]>();
  for (const row of matrixRows) {
    if (row.category === "nav") continue;
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category)!.push(row);
  }

  const categories = [...byCategory.keys()].sort((a, b) => {
    const ai = CAPABILITY_CATEGORY_ORDER.indexOf(a), bi = CAPABILITY_CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return categories.map(category => {
    const rows = byCategory.get(category)!;
    const status = {} as Record<GridRole, CapabilityStatus>;
    status[SUPER_ADMIN_COLUMN] = "full";
    for (const role of STAFF_ROLES) status[role] = deriveCapabilityStatus(rows.filter(r => r.role === role));
    return { category, label: CAPABILITY_CATEGORY_LABELS[category] ?? category, status };
  });
}

const StatusBadge = ({ status }: { status: CapabilityStatus }) => (
  <Badge tone={CAPABILITY_STATUS_TONE[status]}>{CAPABILITY_STATUS_LABEL[status]}</Badge>
);

const PricingProtectionPanel = () => (
  <section className={cx.card}>
    <h2 className={cx.h3}>Pricing Protection</h2>
    <p className="mt-1 text-sm" style={{ color: MUTED }}>
      Cost/internal pricing data is never sent to an external-customer client at all -- not just hidden in the UI.
    </p>
    <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm" style={{ color: NAVY }}>
      <li>An item override's internal reason and who created/approved it are revoked from every direct customer read at the column-privilege level (same technique already used for delivery internal notes) -- visible only through staff-only RPCs, regardless of row-level access.</li>
      <li>A customer only ever sees the single resolved, currently-effective price for a product -- never a price list's other versions, a draft in progress, or another company's assigned list or overrides.</li>
      <li>Order line items freeze the resolved price and its source (override / assigned list / default list) at creation time -- a later price change never rewrites an already-placed order.</li>
    </ul>
  </section>
);

const AccountRestrictionsPanel = () => (
  <section className={cx.card}>
    <h2 className={cx.h3}>Account Restrictions</h2>
    <p className="mt-1 text-sm" style={{ color: MUTED }}>
      How a company's own external users are scoped, and what an On Hold/Suspended account restricts.
    </p>
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-sm font-semibold" style={{ color: NAVY }}>Company-wide roles</p>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>
          {COMPANY_ROLE_LABELS.owner}, {COMPANY_ROLE_LABELS.admin}, and {COMPANY_ROLE_LABELS.project_manager} reach every
          project in the company automatically. Exactly one active {COMPANY_ROLE_LABELS.owner} is always required -- the
          last one can't be demoted, suspended, or removed.
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: NAVY }}>Project-scoped roles</p>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>
          {COMPANY_ROLE_LABELS.estimator}, {COMPANY_ROLE_LABELS.site_user}, and {COMPANY_ROLE_LABELS.viewer} only reach
          projects they've been explicitly added to, as either an editor or a read-only viewer.
        </p>
      </div>
    </div>
    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
      <p className="text-sm font-semibold" style={{ color: NAVY }}>On Hold / Suspended companies</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm" style={{ color: MUTED }}>
        <li>New orders and pro forma requests can't be created for the company, by any of its own users</li>
        <li>Existing projects, orders, and order history remain fully visible</li>
        <li>Company users can still sign in, browse, and estimate as normal</li>
        <li>Speedpanel staff can still act on the company's behalf regardless of its status</li>
      </ul>
    </div>
  </section>
);

export const AccessPermissionsPage = () => {
  const { rows, loading, error, reload } = useAdminPermissionMatrix();
  const capabilityRows = buildCapabilityRows(rows);

  const columns: TableColumn<CapabilityRow>[] = [
    { key: "capability", header: "Capability", cell: r => <span className="font-semibold" style={{ color: NAVY }}>{r.label}</span> },
    ...GRID_ROLES.map(role => ({
      key: role,
      header: GRID_ROLE_LABELS[role],
      align: "center" as const,
      cell: (r: CapabilityRow) => <StatusBadge status={r.status[role]} />,
    })),
  ];

  return (
    <div className="mt-2">
      <h1 className={cx.h1}>Access Permissions</h1>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>
        A curated summary of what each internal role can do, derived from the same grants{" "}
        <span className="font-semibold">Admin &rsaquo; Roles</span> edits. Super Admin always has full access,
        unconditionally.
      </p>

      {loading && <LoadingState className="mt-6" label="Loading permissions" />}
      {!loading && error && <ErrorState className="mt-6" message={error} onRetry={() => reload()} />}

      {!loading && !error && (
        <div className="mt-5">
          <Table columns={columns} rows={capabilityRows} rowKey={r => r.category} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PricingProtectionPanel />
        <AccountRestrictionsPanel />
      </div>
    </div>
  );
};
