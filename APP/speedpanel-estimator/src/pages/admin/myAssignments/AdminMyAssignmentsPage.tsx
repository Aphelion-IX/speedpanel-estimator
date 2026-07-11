// =============================================================================
// Admin > My Assignments -- personal, role-scoped view of assigned companies
// =============================================================================
// One section per Speedpanel Team role the signed-in admin actually holds
// (hidden entirely if they hold none of that role) -- see
// myAssignmentsStore.ts's header comment for why these are plain filtered
// queries, not new RPCs. This is the practical version of "routing" from the
// user's spec: the right data is visible to the right person; there's no
// notification firing when something new lands here (documented as deferred
// in the plan -- this app has no notification system anywhere yet).
// =============================================================================
import { cx, NAVY, MUTED } from "../../../styleTokens";
import type { UseAuth } from "../../../lib/useAuth";
import { STAGE_LABELS, PROJECT_STAGE_BADGE_CLASS } from "../../projects/projectTypes";
import { ORDER_STAGE_LABELS, ORDER_STAGE_BADGE_CLASS, DELIVERY_STATUS_LABELS, DELIVERY_STATUS_BADGE_CLASS } from "../../projects/orders/orderTypes";
import {
  useMyStaffCompanyIds, useMyPmProjects, useMyTechnicalReviewProjects,
  useMyInternalSalesOrders, useMyDispatchDeliveries, useMyBdmCompanies,
} from "./myAssignmentsStore";

const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => {
  if (count === 0) return null;
  return (
    <div className="mt-6">
      <div className={cx.cardHd}>{title} ({count})</div>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
};

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className={`${cx.card} flex flex-wrap items-center justify-between gap-2`}>{children}</div>
);

const PmSection = ({ companyIds }: { companyIds: string[] }) => {
  const { projects, loading } = useMyPmProjects(companyIds);
  if (loading) return null;
  return (
    <Section title="My Projects (Project Manager)" count={projects.length}>
      {projects.map(p => (
        <Row key={p.id}>
          <span className="text-sm font-semibold" style={{ color: NAVY }}>{p.name}</span>
          <span className={`${cx.badge} ${PROJECT_STAGE_BADGE_CLASS[p.stage]}`}>{STAGE_LABELS[p.stage]}</span>
        </Row>
      ))}
    </Section>
  );
};

const TechnicalSection = ({ companyIds }: { companyIds: string[] }) => {
  const { projects, loading } = useMyTechnicalReviewProjects(companyIds);
  if (loading) return null;
  return (
    <Section title="Technical Reviews (Technical Services)" count={projects.length}>
      {projects.map(p => (
        <Row key={p.id}>
          <span className="text-sm font-semibold" style={{ color: NAVY }}>{p.name}</span>
          <span className={`${cx.badge} ${PROJECT_STAGE_BADGE_CLASS[p.stage]}`}>{STAGE_LABELS[p.stage]}</span>
        </Row>
      ))}
    </Section>
  );
};

const InternalSalesSection = ({ companyIds }: { companyIds: string[] }) => {
  const { orders, loading } = useMyInternalSalesOrders(companyIds);
  if (loading) return null;
  return (
    <Section title="Order Approvals (Internal Sales)" count={orders.length}>
      {orders.map(o => (
        <Row key={o.id}>
          <span className="text-sm font-semibold" style={{ color: NAVY }}>Order {o.id.slice(0, 8).toUpperCase()}</span>
          <span className={`${cx.badge} ${ORDER_STAGE_BADGE_CLASS[o.stage]}`}>{ORDER_STAGE_LABELS[o.stage]}</span>
        </Row>
      ))}
    </Section>
  );
};

const DispatchSection = ({ companyIds }: { companyIds: string[] }) => {
  const { rows, loading } = useMyDispatchDeliveries(companyIds);
  if (loading) return null;
  return (
    <Section title="Deliveries (Dispatch)" count={rows.length}>
      {rows.map(({ order, deliveries }) => (
        <Row key={order.id}>
          <span className="text-sm font-semibold" style={{ color: NAVY }}>Order {order.id.slice(0, 8).toUpperCase()}</span>
          <span className={cx.footnote}>
            {deliveries.length === 0 ? "No deliveries yet" : deliveries.map(d => (
              <span key={d.id} className={`${cx.badge} ml-1 ${DELIVERY_STATUS_BADGE_CLASS[d.status]}`}>{DELIVERY_STATUS_LABELS[d.status]}</span>
            ))}
          </span>
        </Row>
      ))}
    </Section>
  );
};

const BdmSection = ({ companyIds }: { companyIds: string[] }) => {
  const { companies, loading } = useMyBdmCompanies(companyIds);
  if (loading) return null;
  return (
    <Section title="My Companies (Business Development)" count={companies.length}>
      {companies.map(c => (
        <Row key={c.id}>
          <span className="text-sm font-semibold" style={{ color: NAVY }}>{c.name}</span>
          <span className={cx.footnote}>
            {c.activeProjects} project{c.activeProjects === 1 ? "" : "s"} &middot; {c.activeOrders} order{c.activeOrders === 1 ? "" : "s"}
            {c.openRequests > 0 && <> &middot; {c.openRequests} open request{c.openRequests === 1 ? "" : "s"}</>}
          </span>
        </Row>
      ))}
    </Section>
  );
};

export const AdminMyAssignmentsPage = ({ auth }: { auth: UseAuth }) => {
  const { byRole, loading, error } = useMyStaffCompanyIds(auth.user?.id ?? null);

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;
  if (error) return <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>;

  const total = Object.values(byRole).reduce((sum, ids) => sum + ids.length, 0);
  if (total === 0) {
    return (
      <div className={`${cx.card} mt-6 text-center`}>
        <p className={cx.footnote}>You're not assigned to any company as Speedpanel staff yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <PmSection companyIds={byRole.project_manager} />
      <BdmSection companyIds={byRole.bdm} />
      <InternalSalesSection companyIds={byRole.internal_sales} />
      <DispatchSection companyIds={byRole.dispatch} />
      <TechnicalSection companyIds={byRole.technical_services} />
    </div>
  );
};
