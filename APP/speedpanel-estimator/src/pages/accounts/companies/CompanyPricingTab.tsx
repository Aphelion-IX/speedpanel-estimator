// =============================================================================
// Company Accounts & Pricing -- Company Pricing tab (Phase 9)
// =============================================================================
// CompanyOverviewPage.tsx's Pricing tab -- item-level price overrides
// (Method 2), the pricing-priority explainer, and the live Customer Price
// Preview, all scoped to one company. Overrides are keyed by
// (company, category, product) with a no-overlap trigger server-side (see
// company_price_overrides' guard_company_price_overrides_no_overlap() in
// supabase/schema.sql) -- admin_set_company_price_override() upserts, so
// "add an override" for a product that already has a current-or-upcoming
// one just replaces it rather than erroring. Editing an existing override
// keeps its product fixed (only price/dates/reason change) -- changing the
// product on an "edit" would upsert against a DIFFERENT override entirely
// and leave the one being edited untouched, so the category/product
// selects are disabled once a row is opened for editing.
// =============================================================================
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { Badge } from "../../../ui/badge";
import { IconButton } from "../../../ui/primitives";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { ConfirmDialog, ErrorDialog } from "../../../ui/confirmDialog";
import { Table, type TableColumn } from "../../../ui/table";
import { Field, SelectField, NumField, TextAreaField } from "../../shared/fields";
import { useProductStore } from "../../admin/products/productStore";
import { CATEGORY_KEY, CATEGORY_LABEL } from "../../admin/products/productTypes";
import { itemTitle } from "../../admin/products/productCategoryViews";
import type { ProductItem } from "../../admin/products/productCard";
import { PRICEABLE_CATEGORIES, type PriceableCategory } from "../../admin/priceLists/priceListTypes";
import type { AdminCompanyRow } from "../../admin/companies/companiesStore";
import {
  useCompanyPriceOverrides, adminSetCompanyPriceOverride, adminDeleteCompanyPriceOverride,
  overrideLifecycle, overrideProductId, type AdminCompanyPriceOverrideRow, type OverrideLifecycle,
} from "./companyPriceOverridesStore";
import { PricingPriorityExplainer } from "./PricingPriorityExplainer";
import { CustomerPricePreview } from "./CustomerPricePreview";
import { CompanyPriceListCard } from "../../admin/priceLists/CompanyPriceListCard";

const LIFECYCLE_TONE: Record<OverrideLifecycle, "ok" | "info" | "neutral"> = { active: "ok", scheduled: "info", expired: "neutral" };
const LIFECYCLE_LABEL: Record<OverrideLifecycle, string> = { active: "Active", scheduled: "Scheduled", expired: "Expired" };

const EXPIRY_WARNING_DAYS = 14;
const TODAY = () => new Date().toISOString().slice(0, 10);

function daysUntil(dateStr: string): number {
  return Math.round((new Date(`${dateStr}T00:00:00Z`).getTime() - new Date(`${TODAY()}T00:00:00Z`).getTime()) / 86_400_000);
}

const CATEGORY_OPTIONS = PRICEABLE_CATEGORIES.map(value => ({ value, label: CATEGORY_LABEL[value] }));

const emptyForm = { category: "panel" as PriceableCategory, productId: "", overridePrice: 0, effectiveDate: TODAY(), expiryDate: "", internalReason: "" };

const OverrideForm = ({ companyId, catalog, editing, onDone, onCancel }: {
  companyId: string; catalog: ReturnType<typeof useProductStore>["catalog"]; editing: AdminCompanyPriceOverrideRow | null;
  onDone: () => void; onCancel: () => void;
}) => {
  const [form, setForm] = useState(() => editing ? {
    category: editing.category, productId: overrideProductId(editing), overridePrice: editing.override_price,
    effectiveDate: editing.effective_date, expiryDate: editing.expiry_date ?? "", internalReason: editing.internal_reason ?? "",
  } : emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm(f => ({ ...f, [key]: value }));

  const productOptions = (catalog[CATEGORY_KEY[form.category]] as ProductItem[]).map(item => ({ value: item.id, label: itemTitle(form.category, item) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId || form.overridePrice <= 0) return;
    setSubmitting(true);
    setError(null);
    const err = await adminSetCompanyPriceOverride({
      companyId, category: form.category, productId: form.productId, overridePrice: form.overridePrice,
      effectiveDate: form.effectiveDate, expiryDate: form.expiryDate || null, internalReason: form.internalReason,
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
    onDone();
  };

  return (
    <form onSubmit={submit} className={`${cx.panel} mt-3 space-y-3 p-4`}>
      <h3 className={cx.h3}>{editing ? "Edit override" : "Add override"}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Category" value={form.category} options={CATEGORY_OPTIONS}
          onChange={v => setForm(f => ({ ...f, category: v as PriceableCategory, productId: "" }))}
        />
        <SelectField
          label="Product"
          value={form.productId || productOptions[0]?.value || ""}
          options={productOptions}
          onChange={v => set("productId", v)}
        />
      </div>
      {(editing && form.category !== editing.category) && (
        <p className="text-xs" style={{ color: MUTED }}>Changing the product creates a separate override -- the one being edited is left untouched.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <NumField label="Override price ($)" value={form.overridePrice} onChange={v => set("overridePrice", v)} />
        <Field label="Effective date" type="date" value={form.effectiveDate} onChange={v => set("effectiveDate", v)} required />
        <Field label="Expiry date (optional)" type="date" value={form.expiryDate} onChange={v => set("expiryDate", v)} />
      </div>
      <TextAreaField label="Internal reason (optional, staff-only)" value={form.internalReason} onChange={v => set("internalReason", v)} />

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !form.productId || form.overridePrice <= 0}>
          {submitting ? "Saving..." : editing ? "Save changes" : "Add override"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};

export const CompanyPricingTab = ({ company, onCompanyChanged }: { company: AdminCompanyRow; onCompanyChanged?: () => void }) => {
  const { catalog, loading: catalogLoading } = useProductStore();
  const { overrides, loading, error, reload } = useCompanyPriceOverrides(company.id);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyError, setBusyError] = useState<string | null>(null);

  const productName = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of PRICEABLE_CATEGORIES) {
      for (const item of catalog[CATEGORY_KEY[cat]] as ProductItem[]) map.set(`${cat}:${item.id}`, itemTitle(cat, item));
    }
    return (row: AdminCompanyPriceOverrideRow) => map.get(`${row.category}:${overrideProductId(row)}`) ?? "Unknown product";
  }, [catalog]);

  const expiringSoon = overrides.filter(o => overrideLifecycle(o) !== "expired" && o.expiry_date && daysUntil(o.expiry_date) <= EXPIRY_WARNING_DAYS);

  const editing = editingId ? overrides.find(o => o.id === editingId) ?? null : null;
  const showForm = adding || !!editing;

  // CustomerPricePreview.tsx runs its OWN useEffectivePriceListPrices()
  // instance (companyId-keyed, same hook the real order/estimate pricing
  // path uses) -- a write here never touches that instance's state, so
  // without this it'd keep showing a just-deleted/just-changed override
  // until an unrelated re-render happened to remount it. Bumping its `key`
  // below forces a fresh mount (and therefore a fresh fetch) after every
  // write, same "tell the sibling hook instance to refetch" problem Phase
  // 7's PriceListVersionEditor.tsx onChanged-lift fixed, just solved here
  // via remount instead since CustomerPricePreview has no reload() to call.
  const [previewRefreshToken, setPreviewRefreshToken] = useState(0);
  const refreshAll = () => { reload(); setPreviewRefreshToken(t => t + 1); };

  const handleDelete = async (id: string) => {
    setDeletingId(null);
    const err = await adminDeleteCompanyPriceOverride(id);
    if (err) { setBusyError(err); return; }
    refreshAll();
  };

  const columns: TableColumn<AdminCompanyPriceOverrideRow>[] = [
    { key: "product", header: "Product", cell: r => productName(r) },
    { key: "category", header: "Category", cell: r => CATEGORY_LABEL[r.category] },
    { key: "price", header: "Override price", align: "right", cell: r => `$${r.override_price.toFixed(2)}` },
    { key: "effective", header: "Effective", cell: r => r.effective_date },
    { key: "expiry", header: "Expiry", cell: r => r.expiry_date ?? "—" },
    {
      key: "status", header: "Status",
      cell: r => {
        const lc = overrideLifecycle(r);
        const soon = lc !== "expired" && r.expiry_date && daysUntil(r.expiry_date) <= EXPIRY_WARNING_DAYS;
        return (
          <span className="flex items-center gap-1.5">
            <Badge tone={LIFECYCLE_TONE[lc]}>{LIFECYCLE_LABEL[lc]}</Badge>
            {soon && <AlertTriangle size={13} className="text-amber-500" />}
          </span>
        );
      },
    },
    { key: "reason", header: "Reason", cell: r => r.internal_reason ?? "—" },
    { key: "added_by", header: "Added by", cell: r => r.created_by_name ?? "—" },
    {
      key: "actions", header: "", align: "right",
      cell: r => (
        <div className="flex justify-end gap-1.5">
          <IconButton size="sm" ariaLabel="Edit override" title="Edit" onClick={() => { setEditingId(r.id); setAdding(false); }}><Pencil size={14} /></IconButton>
          <IconButton size="sm" variant="danger" ariaLabel="Delete override" title="Delete" onClick={() => setDeletingId(r.id)}><Trash2 size={14} /></IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={!!deletingId}
        title="Remove this override?"
        description="This company's pricing for this product reverts to its assigned list (or PL1) immediately."
        confirmLabel="Remove" danger
        onConfirm={() => deletingId && handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
      <ErrorDialog message={busyError} onDismiss={() => setBusyError(null)} />

      <section className={cx.card}>
        <h2 className={cx.h3}>Assigned price list</h2>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>
          This company's Tier 2 pricing -- the list every product falls back to when there's no item override in effect.
        </p>
        <div className="mt-3"><CompanyPriceListCard companyId={company.id} onAssigned={onCompanyChanged} /></div>
      </section>

      <PricingPriorityExplainer />

      {expiringSoon.length > 0 && (
        <div className={`${cx.card} flex items-center gap-3 border-l-4 border-amber-500`}>
          <AlertTriangle size={18} className="shrink-0 text-amber-500" />
          <p className="text-sm" style={{ color: NAVY }}>
            {expiringSoon.length} override{expiringSoon.length === 1 ? "" : "s"} expiring within {EXPIRY_WARNING_DAYS} days -- review before {expiringSoon.length === 1 ? "it lapses" : "they lapse"}.
          </p>
        </div>
      )}

      <section className={cx.card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className={cx.h3}>Item price overrides</h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>Company-specific prices for individual products, overriding the assigned list.</p>
          </div>
          {!showForm && (
            <Button icon={<Plus size={15} />} onClick={() => { setAdding(true); setEditingId(null); }} disabled={catalogLoading}>
              Add override
            </Button>
          )}
        </div>

        {showForm && !catalogLoading && (
          <OverrideForm
            companyId={company.id} catalog={catalog} editing={editing}
            onDone={() => { setAdding(false); setEditingId(null); refreshAll(); }}
            onCancel={() => { setAdding(false); setEditingId(null); }}
          />
        )}

        <div className="mt-4">
          {loading || catalogLoading ? (
            <LoadingState label="Loading overrides" />
          ) : error ? (
            <ErrorState message={error} onRetry={() => reload()} />
          ) : overrides.length === 0 ? (
            <EmptyState message="No item price overrides for this company yet." />
          ) : (
            <Table columns={columns} rows={overrides} rowKey={r => r.id} />
          )}
        </div>
      </section>

      <CustomerPricePreview key={previewRefreshToken} companyId={company.id} />
    </div>
  );
};
