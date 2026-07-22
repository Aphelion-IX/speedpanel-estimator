// =============================================================================
// Company Accounts & Pricing -- Price Lists library (Phase 7)
// =============================================================================
// Overview/Price Lists/Draft Versions/Scheduled/Archived tabs. "Price Lists"
// is the library table (one row per price_lists row, reusing
// useAdminPriceLists() -- the same Phase 6 hook AdminPriceListsPage.tsx
// already uses for create/rename/duplicate/delete); the other three status
// tabs share one VersionsTable over useAdminPriceListVersions(null) (every
// version across every list), filtered client-side by status -- Scheduled/
// Archived stay genuinely empty until Phase 8's publish flow exists (no
// version is ever created with either status yet), which is the honest
// state to show, not something to fake data for. Per-company breakdown
// lives one level down, on a list's own Company Impact tab
// (PriceListVersionEditor.tsx) -- this page only shows the summary count.
// =============================================================================
import { useMemo, useState } from "react";
import { Plus, ListTree, FileEdit, Clock, Archive } from "lucide-react";
import { cx, MUTED, NAVY, BLUE } from "../../../styleTokens";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { Button } from "../../../ui/button";
import { Table, type TableColumn } from "../../../ui/table";
import { Badge } from "../../../ui/badge";
import { Tabs, TabPanel } from "../../../ui/tabs";
import { Field } from "../../shared/fields";
import type { Route } from "../../../appShell/useHashRoute";
import { useAdminPriceLists } from "../../admin/priceLists/priceListsStore";
import type { PriceListSummaryRow } from "../../admin/priceLists/priceListTypes";
import {
  useAdminPriceListVersions, PRICE_LIST_VERSION_STATUS_LABELS,
  type AdminPriceListVersionRow, type PriceListVersionStatus,
} from "./priceListVersionsStore";

const VERSION_STATUS_TONE: Record<PriceListVersionStatus, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  draft: "warn", scheduled: "info", active: "ok", expired: "neutral", archived: "neutral",
};

const NewPriceListForm = ({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) => {
  const { createPriceList } = useAdminPriceLists();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const { id, error: err } = await createPriceList(name.trim());
    setSubmitting(false);
    if (err) { setError(err); return; }
    if (id) onCreated(id);
  };

  return (
    <form onSubmit={submit} className={`${cx.card} mt-3 space-y-3`}>
      <Field label="Name" value={name} onChange={setName} required />
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !name.trim()}>{submitting ? "Creating..." : "Create"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};

const VersionsTable = ({ versions, loading, error, onReload, onOpen, emptyMessage }: {
  versions: AdminPriceListVersionRow[]; loading: boolean; error: string | null; onReload: () => void;
  onOpen: (priceListId: string) => void; emptyMessage: string;
}) => {
  const columns: TableColumn<AdminPriceListVersionRow>[] = [
    { key: "list", header: "Price list", cell: v => <span className="font-bold" style={{ color: NAVY }}>{v.price_list_name}</span> },
    { key: "version", header: "Version", align: "center", cell: v => `v${v.version_number}` },
    { key: "status", header: "Status", cell: v => <Badge tone={VERSION_STATUS_TONE[v.status]}>{PRICE_LIST_VERSION_STATUS_LABELS[v.status]}</Badge> },
    { key: "prices", header: "Priced products", align: "center", cell: v => v.price_count },
    { key: "created", header: "Created by", cell: v => v.created_by_name ?? "—" },
    { key: "created_at", header: "Created", cell: v => new Date(v.created_at).toLocaleDateString() },
    {
      key: "action", header: "", align: "right",
      cell: v => <Button variant="secondary" onClick={() => onOpen(v.price_list_id)}>Open</Button>,
    },
  ];

  if (loading) return <LoadingState className="mt-6" label="Loading versions" />;
  if (error) return <ErrorState className="mt-6" message={error} onRetry={onReload} />;
  if (versions.length === 0) return <EmptyState className={`${cx.card} mt-6 text-center`} message={emptyMessage} />;
  return <div className="mt-6"><Table columns={columns} rows={versions} rowKey={v => v.id} onRowClick={v => onOpen(v.price_list_id)} /></div>;
};

export const PriceListsPage = ({ navigate }: { navigate: (r: Route) => void }) => {
  const { priceLists, loading, error, reload } = useAdminPriceLists();
  const { versions, loading: versionsLoading, error: versionsError, reload: reloadVersions } = useAdminPriceListVersions(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [creating, setCreating] = useState(false);

  const openList = (priceListId: string) => navigate({ tab: "accounts", sub: "priceLists", priceListId });

  const byStatus = useMemo(() => ({
    draft: versions.filter(v => v.status === "draft"),
    scheduled: versions.filter(v => v.status === "scheduled"),
    archived: versions.filter(v => v.status === "archived" || v.status === "expired"),
  }), [versions]);

  const libraryColumns: TableColumn<PriceListSummaryRow>[] = [
    {
      key: "name", header: "Name",
      cell: pl => (
        <div className="flex items-center gap-2">
          <span className="font-bold" style={{ color: NAVY }}>{pl.name}</span>
          {pl.is_default && <Badge tone="info">Default</Badge>}
        </div>
      ),
    },
    { key: "products", header: "Priced products", align: "center", cell: pl => pl.product_count },
    { key: "companies", header: "Companies", align: "center", cell: pl => pl.company_count },
    { key: "updated", header: "Last updated", cell: pl => new Date(pl.updated_at).toLocaleDateString() },
    {
      key: "action", header: "", align: "right",
      cell: pl => <Button variant="secondary" onClick={() => openList(pl.id)}>Open</Button>,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className={cx.eyebrow}>Account Management</span>
          <h1 className={cx.h1 + " mt-1"}>Price Lists</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-300">
            Versioned pricing catalogs -- every edit here targets a draft, never today's live prices, until it's published.
          </p>
        </div>
        {!creating && <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>New price list</Button>}
      </div>

      {creating && <NewPriceListForm onCreated={id => { setCreating(false); reload(); openList(id); }} onCancel={() => setCreating(false)} />}

      <div className="cap-kpis mt-6">
        <div className="cap-kpi">
          <span className="cap-kpi-label"><ListTree size={11} className="mb-1 inline-block" style={{ color: BLUE }} /> Price lists</span>
          <span className="cap-kpi-value">{priceLists.length}</span>
        </div>
        <div className="cap-kpi">
          <span className="cap-kpi-label"><FileEdit size={11} className="mb-1 inline-block" style={{ color: BLUE }} /> Drafts in progress</span>
          <span className="cap-kpi-value">{byStatus.draft.length}</span>
        </div>
        <div className="cap-kpi">
          <span className="cap-kpi-label"><Clock size={11} className="mb-1 inline-block" style={{ color: BLUE }} /> Scheduled</span>
          <span className="cap-kpi-value">{byStatus.scheduled.length}</span>
        </div>
        <div className="cap-kpi">
          <span className="cap-kpi-label"><Archive size={11} className="mb-1 inline-block" style={{ color: BLUE }} /> Archived</span>
          <span className="cap-kpi-value">{byStatus.archived.length}</span>
        </div>
      </div>

      <div className="mt-5">
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "priceLists", label: "Price Lists" },
            { id: "drafts", label: "Draft Versions" },
            { id: "scheduled", label: "Scheduled" },
            { id: "archived", label: "Archived" },
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <TabPanel id="overview" activeId={activeTab}>
        {byStatus.draft.length === 0 ? (
          <EmptyState className={`${cx.card} mt-6 text-center`} message="No drafts in progress -- every price list's live prices are up to date." />
        ) : (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold" style={{ color: NAVY }}>Drafts awaiting publish</p>
            <VersionsTable
              versions={byStatus.draft} loading={versionsLoading} error={versionsError}
              onReload={reloadVersions} onOpen={openList}
              emptyMessage="No drafts in progress."
            />
          </div>
        )}
        <p className="mt-5 text-xs" style={{ color: MUTED }}>
          Publishing a draft (making it the live, active version) is coming in Phase 8 -- for now, drafts stay editable here until then.
        </p>
      </TabPanel>

      <TabPanel id="priceLists" activeId={activeTab}>
        {loading && <LoadingState className="mt-6" label="Loading price lists" />}
        {!loading && error && <ErrorState className="mt-6" message={error} onRetry={() => reload()} />}
        {!loading && !error && priceLists.length === 0 && (
          <EmptyState className={`${cx.card} mt-6 text-center`} message="No price lists yet." />
        )}
        {!loading && !error && priceLists.length > 0 && (
          <div className="mt-6"><Table columns={libraryColumns} rows={priceLists} rowKey={pl => pl.id} onRowClick={pl => openList(pl.id)} /></div>
        )}
      </TabPanel>

      <TabPanel id="drafts" activeId={activeTab}>
        <VersionsTable
          versions={byStatus.draft} loading={versionsLoading} error={versionsError}
          onReload={reloadVersions} onOpen={openList}
          emptyMessage="No draft versions in progress."
        />
      </TabPanel>

      <TabPanel id="scheduled" activeId={activeTab}>
        <VersionsTable
          versions={byStatus.scheduled} loading={versionsLoading} error={versionsError}
          onReload={reloadVersions} onOpen={openList}
          emptyMessage="No scheduled versions -- scheduling a future activation date is coming in Phase 8."
        />
      </TabPanel>

      <TabPanel id="archived" activeId={activeTab}>
        <VersionsTable
          versions={byStatus.archived} loading={versionsLoading} error={versionsError}
          onReload={reloadVersions} onOpen={openList}
          emptyMessage="No archived versions yet -- a version is archived once a newer one replaces it as active."
        />
      </TabPanel>
    </div>
  );
};
