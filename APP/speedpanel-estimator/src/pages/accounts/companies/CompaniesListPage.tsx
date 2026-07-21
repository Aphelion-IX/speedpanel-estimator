// =============================================================================
// Company Accounts & Pricing -- Companies list
// =============================================================================
// Real data via useAdminCompanies() (src/pages/admin/companies/companiesStore.ts,
// extended in place for Phase 2 rather than duplicated here -- see that
// file's own comment on admin_list_companies()'s row shape). Search/status/
// price-list filtering is all client-side over the already-loaded rows --
// this is an internal B2B company list (dozens, not thousands), the same
// scale assumption AdminProjectsBrowserPanel.tsx's search makes.
// =============================================================================
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { cx, MUTED, tone } from "../../../styleTokens";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { Button } from "../../../ui/button";
import { Table, type TableColumn } from "../../../ui/table";
import type { Route } from "../../../appShell/useHashRoute";
import { useAdminCompanies, COMPANY_STATUS_LABELS, type AdminCompanyRow } from "../../admin/companies/companiesStore";

const STATUS_TONE: Record<AdminCompanyRow["status"], "ok" | "warn" | "danger" | "info" | "neutral"> = {
  pending: "info", active: "ok", on_hold: "warn", suspended: "danger", archived: "neutral",
};

export const CompaniesListPage = ({ navigate }: { navigate: (r: Route) => void }) => {
  const { companies, loading, error, reload } = useAdminCompanies();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priceList, setPriceList] = useState<string>("all");

  const priceListOptions = useMemo(
    () => Array.from(new Set(companies.map(c => c.price_list_name).filter((n): n is string => !!n))).sort(),
    [companies],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter(c => {
      if (status !== "all" && c.status !== status) return false;
      if (priceList !== "all" && c.price_list_name !== priceList) return false;
      if (!q) return true;
      return [c.name, c.account_code ?? "", c.primary_user_name ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [companies, query, status, priceList]);

  const columns: TableColumn<AdminCompanyRow>[] = [
    {
      key: "company", header: "Company",
      cell: c => (
        <div>
          <div className="text-sm font-bold" style={{ color: "var(--navy)" }}>{c.name}</div>
          {c.account_code && <div className="text-xs" style={{ color: MUTED }}>{c.account_code}</div>}
        </div>
      ),
    },
    { key: "primary_user", header: "Primary user", cell: c => c.primary_user_name ?? "—" },
    { key: "users", header: "Users", align: "center", cell: c => c.member_count },
    {
      key: "status", header: "Status",
      cell: c => <span className={`${cx.badge} ${tone(STATUS_TONE[c.status])}`}>{COMPANY_STATUS_LABELS[c.status]}</span>,
    },
    { key: "pricing", header: "Assigned pricing", cell: c => c.price_list_name ?? "—" },
    { key: "owner", header: "Internal owner", cell: c => c.internal_owner_name ?? "—" },
    {
      key: "action", header: "", align: "right",
      cell: c => (
        <Button variant="secondary" onClick={() => navigate({ tab: "accounts", sub: "companies", companyId: c.id })}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className={cx.eyebrow}>Account Management</span>
          <h1 className={cx.h1 + " mt-1"}>Companies</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-300">
            The company is the parent commercial account. Search, create and manage every external customer organisation.
          </p>
        </div>
        <Button icon={<Plus size={15} />} onClick={() => navigate({ tab: "accounts", sub: "companies", newCompany: true })}>
          Add company
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search company, primary user or account code"
            className={cx.input + " pl-10"}
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className={cx.input + " w-auto"}>
          <option value="all">All statuses</option>
          {Object.entries(COMPANY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {priceListOptions.length > 0 && (
          <select value={priceList} onChange={e => setPriceList(e.target.value)} className={cx.input + " w-auto"}>
            <option value="all">All price lists</option>
            {priceListOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        )}
        <span className={`${cx.badge} ${tone("neutral")}`}>{filtered.length} compan{filtered.length === 1 ? "y" : "ies"}</span>
      </div>

      {loading && <LoadingState className="mt-6" label="Loading companies" />}
      {!loading && error && <ErrorState className="mt-6" message={error} onRetry={() => reload()} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          className={`${cx.card} mt-6 text-center`}
          message={companies.length === 0 ? "No company workspaces yet." : "No companies match your search."}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="mt-6">
          <Table columns={columns} rows={filtered} rowKey={c => c.id} />
        </div>
      )}
    </div>
  );
};
