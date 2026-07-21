// =============================================================================
// Company Accounts & Pricing -- Company Overview
// =============================================================================
// Phase 2 scope was the Overview tab only -- Users/Pricing/Projects/Quotes/
// Orders/Audit still render PlaceholderPage until their own phase lands (4,
// 9, none planned yet, none planned yet, 10, 13 respectively), same "swap
// page-by-page" convention PlaceholderPage.tsx documents. Phase 3 makes
// Addresses real too (CompanyAddressesTab.tsx). Real data comes from the
// same useAdminCompanies() row Phase 2 extended admin_list_companies() to
// carry (see companiesStore.ts) plus useCompanyActivityCounts() for the two
// project/order KPI tiles.
// =============================================================================
import { useState } from "react";
import { Building2, Users as UsersIcon, ListTree, ClipboardList } from "lucide-react";
import { cx, NAVY, MUTED, BLUE, tone } from "../../../styleTokens";
import { LoadingState, ErrorState } from "../../../ui/states";
import { Button } from "../../../ui/button";
import { Tabs, TabPanel } from "../../../ui/tabs";
import { PlaceholderPage } from "../../PlaceholderPage";
import type { Route } from "../../../appShell/useHashRoute";
import {
  useAdminCompanies, useCompanyActivityCounts, adminSetCompanyStatus,
  COMPANY_STATUS_LABELS, COMPANY_STATUSES, type AdminCompanyRow, type CompanyStatus,
} from "../../admin/companies/companiesStore";
import { CompanyAddressesTab } from "./CompanyAddressesTab";

const STATUS_TONE: Record<CompanyStatus, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  pending: "info", active: "ok", on_hold: "warn", suspended: "danger", archived: "neutral",
};

const KV = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-700">
    <span style={{ color: MUTED }}>{label}</span>
    <strong style={{ color: NAVY }}>{value}</strong>
  </div>
);

const StatusChanger = ({ company, onChanged }: { company: AdminCompanyRow; onChanged: () => void }) => {
  const [status, setStatus] = useState<CompanyStatus>(company.status);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>Change status</Button>;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const err = await adminSetCompanyStatus(company.id, status, reason.trim() || undefined);
    setSubmitting(false);
    if (err) { setError(err); return; }
    setOpen(false);
    setReason("");
    onChanged();
  };

  return (
    <div className={`${cx.panel} flex flex-wrap items-center gap-2 p-3`}>
      <select value={status} onChange={e => setStatus(e.target.value as CompanyStatus)} className={cx.input + " w-auto"}>
        {COMPANY_STATUSES.map(s => <option key={s} value={s}>{COMPANY_STATUS_LABELS[s]}</option>)}
      </select>
      <input
        value={reason} onChange={e => setReason(e.target.value)}
        placeholder="Reason (optional)" className={cx.input + " w-56"}
      />
      <Button onClick={submit} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      {error && <p className="w-full text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
};

const OverviewTab = ({ company, navigate }: { company: AdminCompanyRow; navigate: (r: Route) => void }) => {
  const { counts } = useCompanyActivityCounts(company.id);

  return (
    <div>
      <div className="cap-kpis">
        <div className="cap-kpi">
          <span className="cap-kpi-label"><UsersIcon size={11} className="mb-1 inline-block" style={{ color: BLUE }} /> Active users</span>
          <span className="cap-kpi-value">{company.member_count}</span>
        </div>
        <div className="cap-kpi">
          <span className="cap-kpi-label"><ListTree size={11} className="mb-1 inline-block" style={{ color: BLUE }} /> Assigned price list</span>
          <span className="cap-kpi-value text-lg">{company.price_list_name ?? "None"}</span>
        </div>
        <div className="cap-kpi">
          <span className="cap-kpi-label"><ClipboardList size={11} className="mb-1 inline-block" style={{ color: BLUE }} /> Open projects</span>
          <span className="cap-kpi-value">{counts?.project_count ?? "—"}</span>
        </div>
        <div className="cap-kpi">
          <span className="cap-kpi-label"><ClipboardList size={11} className="mb-1 inline-block" style={{ color: BLUE }} /> Orders</span>
          <span className="cap-kpi-value">{counts?.order_count ?? "—"}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={cx.card}>
          <h2 className={cx.h3}>Company account</h2>
          <div className="mt-3">
            <KV label="Account code" value={company.account_code ?? "—"} />
            <KV label="ABN" value={company.abn ?? "—"} />
            <KV label="Primary user" value={company.primary_user_name ?? "None invited yet"} />
            <KV label="Internal owner" value={company.internal_owner_name ?? "—"} />
            <KV label="Payment terms" value={company.payment_terms ?? "—"} />
            <KV label="Created" value={new Date(company.created_at).toLocaleDateString()} />
          </div>
        </section>

        <section className={cx.card}>
          <h2 className={cx.h3}>Contact details</h2>
          <div className="mt-3">
            <KV label="Billing email" value={company.billing_email ?? "—"} />
            <KV label="Phone" value={company.phone ?? "—"} />
            <KV label="Address" value={company.address ?? "—"} />
          </div>
          <p className="mt-3 text-xs" style={{ color: MUTED }}>
            The address above is this company's original single stored value. Dedicated billing/delivery/office addresses now live on the Addresses tab.
          </p>
        </section>
      </div>

      {company.internal_notes && (
        <section className={`${cx.card} mt-5`}>
          <h2 className={cx.h3}>Internal notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm" style={{ color: NAVY }}>{company.internal_notes}</p>
        </section>
      )}

      <p className="mt-5 text-xs" style={{ color: MUTED }}>
        Item price overrides, price visibility rules and ordering permissions are coming in later phases (9, 10, 12) -- not shown here until they're real.
        {" "}
        <button className="font-semibold hover:underline" style={{ color: BLUE }} onClick={() => navigate({ tab: "accounts", sub: "companyUsers" })}>
          Manage company users
        </button>
      </p>
    </div>
  );
};

// "addresses" is deliberately absent -- it's real now (CompanyAddressesTab.tsx),
// dispatched separately below rather than through this PlaceholderPage list.
const OTHER_TABS: { id: string; label: string; title: string; description: string }[] = [
  { id: "users", label: "Users", title: "Company Users", description: "Roster, roles and invitations for this company -- coming in Phase 4." },
  { id: "pricing", label: "Pricing", title: "Company Pricing", description: "Assigned price list and item-specific overrides -- coming in Phase 9." },
  { id: "projects", label: "Projects", title: "Projects", description: "This company's projects, scoped to this workspace -- not yet planned." },
  { id: "quotes", label: "Quotes", title: "Quotes", description: "This company's quote requests, scoped to this workspace -- not yet planned." },
  { id: "orders", label: "Orders", title: "Orders", description: "This company's order history, scoped to this workspace -- coming in Phase 10." },
  { id: "audit", label: "Audit", title: "Audit History", description: "This company's audit trail -- coming in Phase 13." },
];

export const CompanyOverviewPage = ({ companyId, navigate }: { companyId: string; navigate: (r: Route) => void }) => {
  const { companies, loading, error, reload } = useAdminCompanies();
  const [activeTab, setActiveTab] = useState("overview");
  const company = companies.find(c => c.id === companyId);

  if (loading) return <LoadingState className="mt-6" label="Loading company" />;
  if (error) return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;
  if (!company) return <ErrorState className="mt-6" message="Company not found." onRetry={() => reload()} />;

  return (
    <div>
      <button
        className="text-sm font-semibold hover:underline"
        style={{ color: BLUE }}
        onClick={() => navigate({ tab: "accounts", sub: "companies" })}
      >
        &lsaquo; Companies
      </button>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--blue) 12%, transparent)", color: BLUE }}>
            <Building2 size={18} />
          </span>
          <div>
            <h1 className={cx.h1}>{company.name}</h1>
            <span className={`${cx.badge} mt-1 inline-block ${tone(STATUS_TONE[company.status])}`}>{COMPANY_STATUS_LABELS[company.status]}</span>
          </div>
        </div>
        <StatusChanger company={company} onChanged={reload} />
      </div>

      <div className="mt-5">
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "users", label: "Users" },
            { id: "pricing", label: "Pricing" },
            { id: "addresses", label: "Addresses" },
            { id: "projects", label: "Projects" },
            { id: "quotes", label: "Quotes" },
            { id: "orders", label: "Orders" },
            { id: "audit", label: "Audit" },
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <TabPanel id="overview" activeId={activeTab}><OverviewTab company={company} navigate={navigate} /></TabPanel>
      <TabPanel id="addresses" activeId={activeTab}><CompanyAddressesTab companyId={company.id} /></TabPanel>
      {OTHER_TABS.map(t => (
        <TabPanel key={t.id} id={t.id} activeId={activeTab}>
          <PlaceholderPage title={t.title} description={t.description} />
        </TabPanel>
      ))}
    </div>
  );
};
