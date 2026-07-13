// =============================================================================
// Quick Order -- create an order by picking products directly, no Estimator
// =============================================================================
// Sibling to OrderBuilderPage.tsx (same props/page chrome/submit flow), but
// skips computeProjectReportData/priceReportData entirely -- there's no wall
// data to recompute from. Reuses the exact same customer-facing pricing
// chain OrderBuilderPage.tsx already proved out: useProductStore() (catalog)
// + useEffectivePriceListPrices(project.company_id) + applyEffectivePricing()
// to get real, company-correct prices, then builds OrderLineItem rows
// directly from whatever the customer picks. createOrder() is unchanged --
// it's a plain insert, agnostic to how lineItems/totals were computed.
// =============================================================================
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { cx, NAVY, BLUE, WHITE, MUTED, GOLD } from "../../../styleTokens";
import { Row } from "../../../ui/primitives";
import { SelectField, NumField } from "../../shared/fields";
import type { UseAuth } from "../../../lib/useAuth";
import { useProject } from "../projectDetailStore";
import { useProductStore } from "../../admin/products/productStore";
import { useEffectivePriceListPrices } from "../../admin/priceLists/priceListsStore";
import { PRICEABLE_CATEGORIES, type PriceableCategory } from "../../admin/priceLists/priceListTypes";
import { applyEffectivePricing } from "../../../export/applyEffectivePricing";
import { round2, GST_RATE, type OrderLineItem, type OrderLineItemUnit } from "../../../export/priceEstimateReportData";
import type { ProductCatalog } from "../../admin/products/productTypes";
import { useProjectOrders } from "./ordersStore";

const CATEGORY_LABELS: Record<PriceableCategory, string> = { panel: "Panel", track: "Track", fixing: "Fixing", sealant: "Sealant" };

// One place mapping each priceable category to its catalog list, display
// label, per-item unit, and price field -- collapses what would otherwise
// be four near-identical branches (see priceReportData()'s own panel/track/
// fixing/sealant handling) into data.
const CATEGORY_CONFIG: Record<PriceableCategory, { unit: OrderLineItemUnit; products: (catalog: ProductCatalog) => { id: string; label: string; price: number | null | undefined }[] }> = {
  panel:   { unit: "panel", products: c => c.panels.map(p => ({ id: p.id, label: p.label, price: p.pricePerPanel })) },
  track:   { unit: "metre", products: c => c.tracks.map(t => ({ id: t.id, label: t.label, price: t.pricePerMetre })) },
  fixing:  { unit: "box",   products: c => c.fixings.map(f => ({ id: f.id, label: f.code, price: f.pricePerBox })) },
  sealant: { unit: "box",   products: c => c.sealants.map(s => ({ id: s.id, label: s.product, price: s.pricePerBox })) },
};

function makeLineItem(category: PriceableCategory, label: string, qty: number, unitPrice: number | null): OrderLineItem {
  const matched = unitPrice != null;
  return {
    id: crypto.randomUUID(), category, label, qty, unit: CATEGORY_CONFIG[category].unit,
    unitPriceExGst: unitPrice, lineTotalExGst: matched ? round2(unitPrice! * qty) : 0, matched,
  };
}

const QuickOrderItemsTable = ({ items, onChange }: { items: OrderLineItem[]; onChange: (items: OrderLineItem[]) => void }) => {
  const setQty = (id: string, qty: number) => {
    onChange(items.map(i => i.id === id ? { ...i, qty, lineTotalExGst: i.matched ? round2((i.unitPriceExGst ?? 0) * qty) : 0 } : i));
  };
  const remove = (id: string) => onChange(items.filter(i => i.id !== id));

  if (items.length === 0) return <p className={cx.footnote} style={{ paddingTop: 0 }}>No items added yet -- use the picker above to add products.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="pb-1.5 pr-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Item</th>
            <th className="pb-1.5 pr-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Qty</th>
            <th className="pb-1.5 pr-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Unit</th>
            <th className="pb-1.5 pr-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Unit price</th>
            <th className="pb-1.5 pr-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Total (ex GST)</th>
            <th className="w-8 pb-1.5" />
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1.5 pr-2" style={{ color: NAVY }}>
                {item.label}
                {!item.matched && (
                  <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: GOLD, color: NAVY }}>Not priced</span>
                )}
              </td>
              <td className="py-1.5 pr-2 text-right">
                <input type="number" min={1} value={item.qty} onChange={e => setQty(item.id, Math.max(1, Number(e.target.value)))}
                  className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-right text-xs" style={{ color: NAVY }} />
              </td>
              <td className="py-1.5 pr-2" style={{ color: MUTED }}>{item.unit}</td>
              <td className="py-1.5 pr-2 text-right" style={{ color: MUTED }}>{item.unitPriceExGst != null ? `$${item.unitPriceExGst.toFixed(2)}` : "--"}</td>
              <td className="py-1.5 pr-2 text-right font-semibold" style={{ color: NAVY }}>${item.lineTotalExGst.toFixed(2)}</td>
              <td className="py-1.5 text-right">
                <button onClick={() => remove(item.id)} title="Remove" className="text-red-500">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const QuickOrderPage = ({ projectId, auth, onBack, onCreated }: {
  projectId: string; auth: UseAuth; onBack: () => void; onCreated: (orderId: string) => void;
}) => {
  const { project, loading: projectLoading, error: projectError } = useProject(projectId);
  const { catalog, loading: catalogLoading, error: catalogError } = useProductStore();
  const { assigned, defaultList, loading: pricingLoading, error: pricingError } = useEffectivePriceListPrices(project?.company_id ?? null);
  const { createOrder } = useProjectOrders(projectId);

  const effectiveCatalog = useMemo(() => applyEffectivePricing(catalog, assigned, defaultList), [catalog, assigned, defaultList]);

  const [category, setCategory] = useState<PriceableCategory>("panel");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<OrderLineItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const products = CATEGORY_CONFIG[category].products(effectiveCatalog);

  const addItem = () => {
    const product = products.find(p => p.id === productId);
    if (!product || qty <= 0) return;
    setItems(prev => [...prev, makeLineItem(category, product.label, qty, product.price ?? null)]);
    setProductId("");
    setQty(1);
  };

  const totals = useMemo(() => {
    const subtotalExGst = round2(items.reduce((sum, i) => sum + i.lineTotalExGst, 0));
    const gstAmount = round2(subtotalExGst * GST_RATE);
    return { subtotalExGst, gstAmount, totalIncGst: round2(subtotalExGst + gstAmount), unpricedItemCount: items.filter(i => !i.matched).length };
  }, [items]);

  const handleCreate = async () => {
    if (!auth.user) return;
    if (items.length === 0) { setCreateError("Add at least one line item."); return; }
    setCreating(true);
    setCreateError(null);
    const { id, error } = await createOrder(auth.user.id, {
      lineItems: items, subtotalExGst: totals.subtotalExGst, gstRate: GST_RATE,
      gstAmount: totals.gstAmount, totalIncGst: totals.totalIncGst, unpricedItemCount: totals.unpricedItemCount,
    });
    setCreating(false);
    if (error) { setCreateError(error); return; }
    if (id) onCreated(id);
  };

  if (projectLoading || catalogLoading || pricingLoading) {
    return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;
  }

  if (projectError || !project) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{projectError || "Project not found."}</p>
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back to project</button>
      </div>
    );
  }

  if (catalogError || pricingError) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{catalogError || pricingError}</p>
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back to project</button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back to project</button>

      <div className={`${cx.card} mt-3`}>
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Quick Order -- {project.name}</h1>
        <p className={cx.footnote}>Add products directly, without using the Estimator.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto] sm:items-end">
          <SelectField label="Category" value={category}
            options={PRICEABLE_CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))}
            onChange={v => { setCategory(v as PriceableCategory); setProductId(""); }} />
          <SelectField label="Product" value={productId}
            options={[{ value: "", label: "Choose a product..." }, ...products.map(p => ({
              value: p.id, label: p.price != null ? `${p.label} -- $${p.price.toFixed(2)}/${CATEGORY_CONFIG[category].unit}` : `${p.label} -- not priced`,
            }))]}
            onChange={setProductId} />
          <NumField label="Qty" value={qty} onChange={setQty} />
          <button onClick={addItem} disabled={!productId || qty <= 0}
            className="h-[46px] shrink-0 rounded-xl px-4 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
            + Add
          </button>
        </div>

        {totals.unpricedItemCount > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {totals.unpricedItemCount} item{totals.unpricedItemCount !== 1 ? "s" : ""} couldn't be priced automatically -- included at $0, Speedpanel will confirm pricing for these separately.
          </div>
        )}

        <div className="mt-4">
          <QuickOrderItemsTable items={items} onChange={setItems} />
        </div>

        <div className="mt-4 max-w-xs ml-auto space-y-1">
          <Row k="Subtotal (ex GST)" v={`$${totals.subtotalExGst.toFixed(2)}`} dim />
          <Row k={`GST (${(GST_RATE * 100).toFixed(0)}%)`} v={`$${totals.gstAmount.toFixed(2)}`} dim />
          <Row k="Total (inc GST)" v={`$${totals.totalIncGst.toFixed(2)}`} hl />
        </div>

        {createError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{createError}</p>}

        <button onClick={handleCreate} disabled={creating || items.length === 0}
          className="mt-4 w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
          {creating ? "Creating..." : "Create order"}
        </button>
      </div>
    </div>
  );
};
