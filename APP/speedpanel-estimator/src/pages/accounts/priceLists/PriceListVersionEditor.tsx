// =============================================================================
// Company Accounts & Pricing -- Price List draft editor (Phase 7/8)
// =============================================================================
// Reached by opening a price list from PriceListsPage.tsx. Product Prices
// tab reuses useAdminPriceListPrices() (Phase 6, src/pages/admin/priceLists/
// priceListsStore.ts) verbatim -- the same auto-fork-a-draft-on-first-edit
// stopgap AdminPriceListsPage.tsx already exercises, just presented in this
// module's own chrome/tabs rather than that page's flat layout. Publish tab
// is ComparePublishPage.tsx (Phase 8) -- the diff/checklist/company-impact/
// approval-note/real Publish action live there, not inline here.
// =============================================================================
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, Search, Copy, Trash2, Pencil, Check, X, Download, Upload } from "lucide-react";
import { cx, BLUE, WHITE, NAVY, MUTED } from "../../../styleTokens";
import { CardGrid, SectionLabel, IconButton } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { Badge } from "../../../ui/badge";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { ConfirmDialog, ErrorDialog } from "../../../ui/confirmDialog";
import { Tabs, TabPanel } from "../../../ui/tabs";
import { Table, type TableColumn } from "../../../ui/table";
import { Field } from "../../shared/fields";
import type { Route } from "../../../appShell/useHashRoute";
import type { EffectiveLayout } from "../../../useLayoutMode";
import { useProductStore } from "../../admin/products/productStore";
import { CATEGORY_KEY, CATEGORY_LABEL } from "../../admin/products/productTypes";
import { itemTitle } from "../../admin/products/productCategoryViews";
import type { ProductItem } from "../../admin/products/productCard";
import { useAdminPriceLists, useAdminPriceListPrices } from "../../admin/priceLists/priceListsStore";
import { PRICEABLE_CATEGORIES, priceRowProductId, type PriceableCategory } from "../../admin/priceLists/priceListTypes";
import { buildPriceListCsvRows, exportPriceListCsv, parsePriceListCsv, type ImportParseResult } from "../../admin/priceLists/priceListCsv";
import { useAdminCompanies } from "../../admin/companies/companiesStore";
import {
  useAdminPriceListVersions, PRICE_LIST_VERSION_STATUS_LABELS, type AdminPriceListVersionRow,
} from "./priceListVersionsStore";
import { ComparePublishPage } from "./ComparePublishPage";

const matchesQuery = (item: ProductItem, q: string): boolean => JSON.stringify(item).toLowerCase().includes(q);

// =============================================================================
// Product Prices tab -- same category-chips + search + price-row pattern
// AdminPriceListsPage.tsx's PriceListDetail already established for Phase 6;
// this is that same UX, just as this module's own tab rather than a flat
// page (the two coexist until Phase 14 retires the old page, see the plan).
// =============================================================================
const PriceRow = ({ item, category, currentPrice, priceRowId, onSave, onClear }: {
  item: ProductItem; category: PriceableCategory; currentPrice: number | null; priceRowId: string | null;
  onSave: (price: number) => void; onClear: () => void;
}) => {
  const [draft, setDraft] = useState(currentPrice != null ? String(currentPrice) : "");
  const [editing, setEditing] = useState(false);
  const dirty = editing && draft !== (currentPrice != null ? String(currentPrice) : "");

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === "" || Number.isNaN(parsed)) return;
    onSave(parsed);
    setEditing(false);
  };

  return (
    <div className={`${cx.card} flex items-center justify-between gap-3`}>
      <div className="min-w-0 truncate text-sm font-semibold" style={{ color: NAVY }}>{itemTitle(category, item)}</div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          value={editing ? draft : (currentPrice != null ? String(currentPrice) : "")}
          onFocus={() => setEditing(true)}
          onChange={e => { setEditing(true); setDraft(e.target.value); }}
          placeholder="Not set"
          className="w-24 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-right"
          style={{ color: NAVY }}
        />
        {dirty && (
          <button onClick={commit} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: BLUE, color: WHITE }}><Check size={14} /></button>
        )}
        {priceRowId && !dirty && (
          <IconButton variant="danger" size="sm" ariaLabel="Clear price" onClick={() => { onClear(); setDraft(""); }}>
            <Trash2 size={14} />
          </IconButton>
        )}
      </div>
    </div>
  );
};

const ProductPricesTab = ({ priceListId, priceListName, layoutMode, onChanged }: {
  priceListId: string; priceListName: string; layoutMode: EffectiveLayout;
  // Called after a write that may have auto-forked a draft (see
  // useAdminPriceListPrices()'s own resolveDraftVersionId()) -- the parent's
  // own useAdminPriceListVersions() call (the header's "Draft in progress"
  // badge, the Publish tab's diff) is a separate hook instance with its own
  // stale state until told to refetch; this is that signal.
  onChanged: () => void;
}) => {
  const { catalog, loading: catalogLoading } = useProductStore();
  const { prices, versionStatus, loading: pricesLoading, error: pricesError, setPrice, setPrices, deletePrice } = useAdminPriceListPrices(priceListId);
  const [category, setCategory] = useState<PriceableCategory>("panel");
  const [query, setQuery] = useState("");
  const [busyError, setBusyError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const list = catalog[CATEGORY_KEY[category]] as ProductItem[];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter(i => matchesQuery(i, q)) : list;
  }, [list, query]);

  const priceByProductId = useMemo(() => {
    const map = new Map<string, { price: number; id: string }>();
    for (const row of prices) map.set(`${row.category}:${priceRowProductId(row)}`, { price: row.price, id: row.id });
    return map;
  }, [prices]);

  const handleExport = () => { exportPriceListCsv(priceListName, buildPriceListCsvRows(catalog, prices)); };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportSummary(null);
    const result = await parsePriceListCsv(file);
    if (result.missingColumns) { setBusyError('That file is missing one of the required columns: "Category", "Product ID", "Price".'); return; }
    if (result.rows.length === 0) { setBusyError("No usable price rows found in that file."); return; }
    setImportPreview(result);
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    const { successCount, errors } = await setPrices(importPreview.rows);
    setImporting(false);
    setImportPreview(null);
    if (errors.length > 0) setBusyError(`${errors.length} price${errors.length === 1 ? "" : "s"} failed to import: ${errors[0]}`);
    setImportSummary(`Imported ${successCount} price${successCount === 1 ? "" : "s"}.`);
    if (successCount > 0) onChanged();
  };

  return (
    <div>
      <ConfirmDialog
        open={!!importPreview}
        title="Import prices"
        description={importPreview ? [
          `This will set ${importPreview.rows.length} price${importPreview.rows.length === 1 ? "" : "s"} on this draft.`,
          importPreview.skipped > 0 ? `${importPreview.skipped} row${importPreview.skipped === 1 ? "" : "s"} skipped (blank or unreadable price).` : null,
          importPreview.unknownCategories > 0 ? `${importPreview.unknownCategories} row${importPreview.unknownCategories === 1 ? "" : "s"} skipped (unrecognized category).` : null,
        ].filter(Boolean).join(" ") : ""}
        confirmLabel={importing ? "Importing..." : "Import"}
        onConfirm={handleConfirmImport}
        onCancel={() => setImportPreview(null)}
      />
      <ErrorDialog message={busyError} onDismiss={() => setBusyError(null)} />
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelected} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: MUTED }}>
          {versionStatus === "draft"
            ? "Editing the current draft -- these prices go live once the draft is published."
            : "Showing today's live prices -- editing one automatically starts a new draft."}
        </p>
        <div className="flex items-center gap-2">
          <IconButton size="sm" ariaLabel="Export prices to CSV" title="Export CSV" onClick={handleExport} disabled={catalogLoading}><Download size={14} /></IconButton>
          <IconButton size="sm" ariaLabel="Import prices from CSV" title="Import CSV" onClick={() => fileInputRef.current?.click()}><Upload size={14} /></IconButton>
        </div>
      </div>
      {importSummary && <p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>{importSummary}</p>}

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
        <Search size={16} className="shrink-0" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products..."
          className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRICEABLE_CATEGORIES.map(c => {
          const on = category === c;
          return (
            <button key={c} onClick={() => setCategory(c)}
              className={"rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 " + (on ? "" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800")}
              style={on ? { borderColor: BLUE, background: BLUE, color: WHITE } : { color: BLUE }}>
              {CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>
      <div className="mt-5"><SectionLabel icon={<Search size={14} />}>{CATEGORY_LABEL[category]} ({filtered.length})</SectionLabel></div>

      {pricesError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{pricesError}</p>}

      {catalogLoading || pricesLoading ? (
        <LoadingState className="mt-3" label="Loading products" />
      ) : (
        <CardGrid layoutMode={layoutMode} minWidth={280}>
          {filtered.map(item => {
            const entry = priceByProductId.get(`${category}:${item.id}`);
            return (
              <PriceRow
                key={item.id}
                item={item}
                category={category}
                currentPrice={entry?.price ?? null}
                priceRowId={entry?.id ?? null}
                onSave={price => { setPrice(category, item.id, price).then(err => { if (!err) onChanged(); }); }}
                onClear={() => { if (entry) deletePrice(entry.id).then(err => { if (!err) onChanged(); }); }}
              />
            );
          })}
        </CardGrid>
      )}
    </div>
  );
};

// =============================================================================
// Details tab -- rename/duplicate/delete + this list's own version history.
// =============================================================================
const DetailsTab = ({ priceListId, versions, versionsLoading, versionsError, onReloadVersions, navigate }: {
  priceListId: string; versions: AdminPriceListVersionRow[]; versionsLoading: boolean; versionsError: string | null;
  onReloadVersions: () => void; navigate: (r: Route) => void;
}) => {
  const { priceLists, renamePriceList, duplicatePriceList, deletePriceList } = useAdminPriceLists();
  const pl = priceLists.find(p => p.id === priceListId);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(pl?.name ?? "");
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyError, setBusyError] = useState<string | null>(null);

  if (!pl) return null;

  const handleRename = async () => {
    if (!nameDraft.trim()) return;
    const err = await renamePriceList(pl.id, nameDraft.trim());
    if (err) { setBusyError(err); return; }
    setRenaming(false);
  };

  const startDuplicate = () => { setDuplicateName(`${pl.name} (copy)`); setBusyError(null); setDuplicating(true); };
  const handleDuplicate = async () => {
    if (!duplicateName.trim()) return;
    const { id, error: err } = await duplicatePriceList(pl.id, duplicateName.trim());
    if (err) { setBusyError(err); return; }
    setDuplicating(false);
    if (id) navigate({ tab: "accounts", sub: "priceLists", priceListId: id });
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    const err = await deletePriceList(pl.id);
    if (err) { setBusyError(err); return; }
    navigate({ tab: "accounts", sub: "priceLists" });
  };

  const versionColumns: TableColumn<typeof versions[number]>[] = [
    { key: "version", header: "Version", cell: v => `v${v.version_number}` },
    { key: "status", header: "Status", cell: v => <Badge tone={v.status === "active" ? "ok" : v.status === "draft" ? "warn" : "neutral"}>{PRICE_LIST_VERSION_STATUS_LABELS[v.status]}</Badge> },
    { key: "prices", header: "Priced products", align: "center", cell: v => v.price_count },
    { key: "created", header: "Created by", cell: v => v.created_by_name ?? "—" },
    { key: "created_at", header: "Created", cell: v => new Date(v.created_at).toLocaleDateString() },
    { key: "published", header: "Published", cell: v => v.published_at ? new Date(v.published_at).toLocaleDateString() : "—" },
  ];

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={confirmDelete} danger title="Delete price list"
        description={`Delete "${pl.name}"? This can't be undone.`}
        confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)}
      />
      <ErrorDialog message={busyError} onDismiss={() => setBusyError(null)} />

      <div className={cx.card}>
        <h2 className={cx.h3}>Name &amp; actions</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {renaming ? (
            <>
              <Field label="" value={nameDraft} onChange={setNameDraft} />
              <button onClick={handleRename} aria-label="Save name" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: BLUE, color: WHITE }}><Check size={14} /></button>
              <IconButton size="lg" ariaLabel="Cancel rename" onClick={() => { setRenaming(false); setNameDraft(pl.name); }}><X size={14} /></IconButton>
            </>
          ) : duplicating ? (
            <>
              <Field label="" value={duplicateName} onChange={setDuplicateName} />
              <button onClick={handleDuplicate} aria-label="Save duplicate name" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: BLUE, color: WHITE }}><Check size={14} /></button>
              <IconButton size="lg" ariaLabel="Cancel duplicate" onClick={() => setDuplicating(false)}><X size={14} /></IconButton>
            </>
          ) : (
            <>
              <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => setRenaming(true)}>Rename</Button>
              <Button variant="secondary" icon={<Copy size={14} />} onClick={startDuplicate}>Duplicate</Button>
              {!pl.is_default && pl.company_count === 0 && (
                <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>Delete</Button>
              )}
            </>
          )}
        </div>
        {pl.is_default && (
          <p className="mt-3 text-xs" style={{ color: MUTED }}>This is the default price list -- it can't be deleted, and every customer whose company has no explicit assignment falls back to it.</p>
        )}
        {!pl.is_default && pl.company_count > 0 && (
          <p className="mt-3 text-xs" style={{ color: MUTED }}>Still assigned to {pl.company_count} compan{pl.company_count === 1 ? "y" : "ies"} -- unassign them first (Company Impact tab) to delete this list.</p>
        )}
      </div>

      <div className={cx.card}>
        <h2 className={cx.h3}>Version history</h2>
        {versionsLoading && <LoadingState className="mt-3" label="Loading versions" />}
        {!versionsLoading && versionsError && <ErrorState className="mt-3" message={versionsError} onRetry={onReloadVersions} />}
        {!versionsLoading && !versionsError && (
          <div className="mt-3"><Table columns={versionColumns} rows={versions} rowKey={v => v.id} /></div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Visibility tab -- informational: who can see this list's prices, and why.
// =============================================================================
const VisibilityTab = ({ isDefault }: { isDefault: boolean }) => (
  <div className={`${cx.card} space-y-3`}>
    <h2 className={cx.h3}>Who can see these prices</h2>
    <p className="text-sm" style={{ color: MUTED }}>
      Speedpanel staff with price-list access can always read every list's prices, published or draft. A customer only
      ever sees this list's <strong style={{ color: NAVY }}>currently published (active)</strong> prices -- a draft in
      progress is never visible to them, no matter how far along it is.
    </p>
    {isDefault ? (
      <p className="text-sm" style={{ color: MUTED }}>
        This is the <strong style={{ color: NAVY }}>default</strong> price list -- every authenticated customer can read its
        active prices, not just companies explicitly assigned to it, since it's the fallback used whenever a product has no
        price on a company's own assigned list.
      </p>
    ) : (
      <p className="text-sm" style={{ color: MUTED }}>
        Only companies explicitly assigned to this list (see the Company Impact tab) can read its active prices.
      </p>
    )}
  </div>
);

// =============================================================================
// Company Impact tab -- which companies are assigned to this list today.
// =============================================================================
const CompanyImpactTab = ({ priceListId, navigate }: { priceListId: string; navigate: (r: Route) => void }) => {
  const { companies, loading, error, reload } = useAdminCompanies();
  const assigned = companies.filter(c => c.price_list_id === priceListId);

  const columns: TableColumn<typeof assigned[number]>[] = [
    { key: "name", header: "Company", cell: c => <span className="font-bold" style={{ color: NAVY }}>{c.name}</span> },
    { key: "status", header: "Status", cell: c => <Badge tone={c.status === "active" ? "ok" : c.status === "on_hold" ? "warn" : c.status === "suspended" ? "danger" : "neutral"}>{c.status}</Badge> },
    { key: "primary", header: "Primary user", cell: c => c.primary_user_name ?? "—" },
    { key: "users", header: "Users", align: "center", cell: c => c.member_count },
    {
      key: "action", header: "", align: "right",
      cell: c => <Button variant="secondary" onClick={() => navigate({ tab: "accounts", sub: "companies", companyId: c.id })}>Open</Button>,
    },
  ];

  if (loading) return <LoadingState className="mt-3" label="Loading companies" />;
  if (error) return <ErrorState className="mt-3" message={error} onRetry={() => reload()} />;
  if (assigned.length === 0) return <EmptyState className={`${cx.card} text-center`} message="No companies are assigned to this list yet." />;
  return <Table columns={columns} rows={assigned} rowKey={c => c.id} />;
};

export const PriceListVersionEditor = ({ priceListId, layoutMode, navigate }: {
  priceListId: string; layoutMode: EffectiveLayout; navigate: (r: Route) => void;
}) => {
  const { priceLists, loading, error, reload } = useAdminPriceLists();
  // Lifted here (not called separately inside DetailsTab/ProductPricesTab)
  // so every tab shares one source of truth -- ProductPricesTab's onChanged
  // calls this reload after a write that may have auto-forked a draft,
  // which is what keeps the header badge and the Publish tab's diff from
  // going stale the moment a price is first edited.
  const { versions, loading: versionsLoading, error: versionsError, reload: reloadVersions } = useAdminPriceListVersions(priceListId);
  const [activeTab, setActiveTab] = useState("prices");

  const pl = priceLists.find(p => p.id === priceListId);
  const activeVersion = versions.find(v => v.status === "active");
  const draftVersion = versions.find(v => v.status === "draft");

  if (loading) return <LoadingState className="mt-6" label="Loading price list" />;
  if (error) return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;
  if (!pl) return <ErrorState className="mt-6" message="Price list not found." onRetry={() => reload()} />;

  return (
    <div>
      <button
        className="flex items-center gap-1 text-sm font-semibold hover:underline"
        style={{ color: BLUE }}
        onClick={() => navigate({ tab: "accounts", sub: "priceLists" })}
      >
        <ChevronLeft size={14} /> Price Lists
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className={cx.h1}>{pl.name}</h1>
        {pl.is_default && <Badge tone="info">Default</Badge>}
        {draftVersion && <Badge tone="warn">Draft in progress</Badge>}
      </div>

      <div className="mt-5">
        <Tabs
          tabs={[
            { id: "prices", label: "Product Prices" },
            { id: "details", label: "Details" },
            { id: "visibility", label: "Visibility" },
            { id: "impact", label: "Company Impact" },
            { id: "publish", label: "Publish" },
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <TabPanel id="prices" activeId={activeTab}>
        <ProductPricesTab priceListId={priceListId} priceListName={pl.name} layoutMode={layoutMode} onChanged={reloadVersions} />
      </TabPanel>
      <TabPanel id="details" activeId={activeTab}>
        <DetailsTab
          priceListId={priceListId} versions={versions} versionsLoading={versionsLoading} versionsError={versionsError}
          onReloadVersions={reloadVersions} navigate={navigate}
        />
      </TabPanel>
      <TabPanel id="visibility" activeId={activeTab}><VisibilityTab isDefault={pl.is_default} /></TabPanel>
      <TabPanel id="impact" activeId={activeTab}><CompanyImpactTab priceListId={priceListId} navigate={navigate} /></TabPanel>
      <TabPanel id="publish" activeId={activeTab}>
        <ComparePublishPage
          priceListId={priceListId} activeVersionId={activeVersion?.id ?? null} draftVersionId={draftVersion?.id ?? null}
          onPublished={() => { reloadVersions(); setActiveTab("prices"); }}
        />
      </TabPanel>
    </div>
  );
};
