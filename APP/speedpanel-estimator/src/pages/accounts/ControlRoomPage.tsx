// =============================================================================
// Company Accounts & Pricing -- Control Room
// =============================================================================
// KPI tiles + price-list allocation are real data (controlRoomStore.ts).
// The design screenshots also show an "Account Operations" action queue with
// items like "Price override expires in 7 days" and "Major Contractor v4 is
// ready" -- those depend on company_price_overrides/price_list_versions,
// neither of which exist yet (see the phased plan's Phase 9/6-8). Only
// "invitations pending" and "company on hold" are real enough to show today;
// the rest is intentionally omitted rather than faked, with this comment as
// the marker for whoever picks up those later phases to wire the rest in.
// Same reasoning for the screenshots' "Module Owner"/"Pricing Administrators"
// owner cards -- there's no per-module ownership-assignment concept in the
// backend, so nothing plausible to show; omitted rather than invented.
// =============================================================================
import { Building2, Users, Mail, ListTree, AlertTriangle, Plus } from "lucide-react";
import { cx, MUTED } from "../../styleTokens";
import { LoadingState, ErrorState } from "../../ui/states";
import { Button } from "../../ui/button";
import type { Route } from "../../appShell/useHashRoute";
import { useControlRoom } from "./controlRoomStore";

const KPI_ICONS = { companies: Building2, externalUsers: Users, pendingInvitations: Mail, activePriceLists: ListTree };

export const ControlRoomPage = ({ navigate }: { navigate: (r: Route) => void }) => {
  const { counts, allocation, loading, error } = useControlRoom();

  if (loading) return <LoadingState className="mt-6" label="Loading Control Room" />;
  if (error || !counts) return <ErrorState className="mt-6" message={error ?? "Something went wrong."} />;

  const kpis: { key: keyof typeof KPI_ICONS; label: string; value: number }[] = [
    { key: "companies", label: "Active companies", value: counts.companies },
    { key: "externalUsers", label: "External users", value: counts.externalUsers },
    { key: "pendingInvitations", label: "Pending invitations", value: counts.pendingInvitations },
    { key: "activePriceLists", label: "Active price lists", value: counts.activePriceLists },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className={cx.eyebrow}>Internal website administration</span>
          <h1 className={cx.h1 + " mt-1"}>Company Accounts & Pricing</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-300">
            Manage external companies as parent accounts, company users, primary-user ownership, invitations, predefined price lists and company-specific item pricing.
          </p>
        </div>
        <Button icon={<Plus size={15} />} onClick={() => navigate({ tab: "accounts", sub: "companies" })}>
          Add company
        </Button>
      </div>

      <div className="cap-kpis mt-6">
        {kpis.map(k => {
          const Icon = KPI_ICONS[k.key];
          return (
            <div key={k.key} className="cap-kpi">
              <span className="cap-kpi-label"><Icon size={11} className="mb-1 inline-block" style={{ color: "var(--blue)" }} /> {k.label}</span>
              <span className="cap-kpi-value">{k.value}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={cx.card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={cx.h3}>Account Operations</h2>
          </div>
          <p className="mt-1 text-xs" style={{ color: MUTED }}>Current company and customer account activity.</p>

          <div className="mt-4">
            {counts.pendingInvitations > 0 && (
              <div className="cap-queue-item">
                <span className="cap-queue-icon"><Mail size={15} /></span>
                <div className="cap-queue-copy">
                  <strong>{counts.pendingInvitations} invitation{counts.pendingInvitations === 1 ? "" : "s"} pending</strong>
                  <span>Awaiting acceptance across all companies.</span>
                </div>
                <Button variant="secondary" onClick={() => navigate({ tab: "accounts", sub: "invitations" })}>Open</Button>
              </div>
            )}
            {counts.companiesOnHold > 0 && (
              <div className="cap-queue-item">
                <span className="cap-queue-icon warn"><AlertTriangle size={15} /></span>
                <div className="cap-queue-copy">
                  <strong>{counts.companiesOnHold} compan{counts.companiesOnHold === 1 ? "y" : "ies"} on hold</strong>
                  <span>Ordering is currently blocked for these accounts.</span>
                </div>
                <Button variant="secondary" onClick={() => navigate({ tab: "accounts", sub: "companies" })}>Review</Button>
              </div>
            )}
            {counts.pendingInvitations === 0 && counts.companiesOnHold === 0 && (
              <p className="text-sm" style={{ color: MUTED }}>Nothing needs attention right now.</p>
            )}
          </div>
        </section>

        <section className={cx.card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={cx.h3}>Price List Allocation</h2>
          </div>
          <p className="mt-1 text-xs" style={{ color: MUTED }}>Companies assigned to each price list.</p>

          <div className="mt-4">
            {allocation.length === 0 && <p className="text-sm" style={{ color: MUTED }}>No price lists yet.</p>}
            {allocation.map(a => (
              <div key={a.id} className="cap-allocation-item">
                <span className="cap-queue-icon"><ListTree size={14} /></span>
                <div>
                  <strong>{a.name}{a.isDefault ? " (default)" : ""}</strong>
                  <span>{a.companyCount} compan{a.companyCount === 1 ? "y" : "ies"}</span>
                </div>
                <span className="cap-allocation-count">{a.companyCount}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
