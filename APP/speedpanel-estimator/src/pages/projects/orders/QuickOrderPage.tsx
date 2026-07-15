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
//
// Panels are a special case: they're physical units, only sellable in whole
// packs (AdminPanel.pack), and their length matters (a piece length gets
// classified Stocked/Near stock/Custom against STOCK_LENGTHS, same as the
// real Estimator). So panel line items are DERIVED from a separate
// {panelType, lengthM} -> raw pieces map (panelGroups), re-packed via
// packInfo() on every change -- the billed qty is always the pack-rounded
// `ordered` count, never the raw pieces a customer typed in. Track is NOT
// pack-rounded (confirmed against priceEstimateReportData.ts: track bills
// raw linear metres x price/metre, "how many stock lengths that cuts into"
// is display-only there too) -- its picker stays a plain qty field. Fixing/
// sealant are already whole-box units by convention (unit: "box"), just
// clamped to a whole number here.
// =============================================================================
import { useMemo, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { cx, NAVY, BLUE, MUTED, GOLD } from "../../../styleTokens";
import { Row, IconButton } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { Table, type TableColumn } from "../../../ui/table";
import { StockBadge, PackNote } from "../../../ui/scheduleCards";
import { SelectField, NumField } from "../../shared/fields";
import type { UseAuth } from "../../../lib/useAuth";
import { useProject } from "../projectDetailStore";
import { useProductStore } from "../../admin/products/productStore";
import { useEffectivePriceListPrices } from "../../admin/priceLists/priceListsStore";
import { PRICEABLE_CATEGORIES, type PriceableCategory } from "../../admin/priceLists/priceListTypes";
import { applyEffectivePricing } from "../../../export/applyEffectivePricing";
import { round2, GST_RATE, type OrderLineItem, type OrderLineItemUnit } from "../../../export/priceEstimateReportData";
import type { ProductCatalog } from "../../admin/products/productTypes";
import { packInfo } from "../../../estimate/packPanels";
import { stockStatus } from "../../../estimate/computeUtils";
import { r1 } from "../../../estimate/mathUtils";
import { PACK, STOCK_LENGTHS } from "../../../data";
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

// One (panel type, length) group -- the raw pieces a customer has asked
// for at that length, kept separate from the derived, pack-rounded
// OrderLineItem so repeat "add 5 more" clicks can be re-packed from the
// true cumulative requirement instead of compounding an already-rounded
// quantity.
interface PanelGroup { panelType: number; label: string; price: number | null; lengthM: number; pieces: number; }

const panelGroupKey = (panelType: number, lengthM: number) => `panel:${panelType}:${lengthM}`;

const QuickOrderItemsTable = ({ items, onQtyChange, onRemove }: {
  items: OrderLineItem[]; onQtyChange: (id: string, qty: number) => void; onRemove: (item: OrderLineItem) => void;
}) => {
  if (items.length === 0) return <EmptyState message="No items added yet -- use the picker above to add products." />;

  const columns: TableColumn<OrderLineItem>[] = [
    {
      key: "item", header: "Item", cell: item => (
        <span style={{ color: NAVY }}>
          {item.label}
          {!item.matched && <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: GOLD, color: NAVY }}>Not priced</span>}
        </span>
      ),
    },
    {
      key: "qty", header: "Qty", align: "right", cell: item => {
        // Panel qty is derived (pack-rounded from panelGroups) -- edit via
        // "+ Add" at the same length, not by hand-editing the already-
        // rounded billed count.
        const editableQty = item.category !== "panel";
        return editableQty ? (
          <input type="number" min={1} value={item.qty} onChange={e => onQtyChange(item.id, Math.max(1, Number(e.target.value)))}
            className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-right text-xs" style={{ color: NAVY }} />
        ) : <span style={{ color: NAVY }}>{item.qty}</span>;
      },
    },
    { key: "unit", header: "Unit", cell: item => <span style={{ color: MUTED }}>{item.unit}</span> },
    { key: "unitPrice", header: "Unit price", align: "right", cell: item => <span style={{ color: MUTED }}>{item.unitPriceExGst != null ? `$${item.unitPriceExGst.toFixed(2)}` : "--"}</span> },
    { key: "total", header: "Total (ex GST)", align: "right", cell: item => <span className="font-semibold" style={{ color: NAVY }}>${item.lineTotalExGst.toFixed(2)}</span> },
    {
      key: "remove", header: "", cell: item => (
        <IconButton size="sm" variant="danger" title="Remove" ariaLabel={`Remove ${item.label}`} onClick={() => onRemove(item)}>
          <Trash2 size={14} />
        </IconButton>
      ),
    },
  ];

  return <Table columns={columns} rows={items} rowKey={item => item.id} />;
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
  const [lengthM, setLengthM] = useState(STOCK_LENGTHS[0]);
  const [panelGroups, setPanelGroups] = useState<Record<string, PanelGroup>>({});
  const [manualItems, setManualItems] = useState<OrderLineItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const products = CATEGORY_CONFIG[category].products(effectiveCatalog);
  const selectedPanel = category === "panel" ? effectiveCatalog.panels.find(p => p.id === productId) : undefined;

  const panelPreview = useMemo(() => {
    if (!selectedPanel || lengthM <= 0 || qty <= 0) return null;
    return { status: stockStatus(lengthM * 1000, STOCK_LENGTHS), pack: packInfo(qty, selectedPanel.type) };
  }, [selectedPanel, lengthM, qty]);

  const panelLineItems: OrderLineItem[] = useMemo(() => Object.entries(panelGroups).map(([key, g]) => {
    const pack = packInfo(g.pieces, g.panelType);
    return {
      id: key, category: "panel" as const, label: `${g.label} - ${r1(g.lengthM)} m`, qty: pack.ordered, unit: "panel" as const,
      unitPriceExGst: g.price, lineTotalExGst: g.price != null ? round2(g.price * pack.ordered) : 0, matched: g.price != null,
    };
  }), [panelGroups]);

  const items = useMemo(() => [...panelLineItems, ...manualItems], [panelLineItems, manualItems]);

  const addItem = () => {
    if (category === "panel") {
      if (!selectedPanel || lengthM <= 0 || qty <= 0) return;
      const key = panelGroupKey(selectedPanel.type, lengthM);
      setPanelGroups(prev => ({
        ...prev,
        [key]: {
          panelType: selectedPanel.type, label: selectedPanel.label, price: selectedPanel.pricePerPanel ?? null,
          lengthM, pieces: (prev[key]?.pieces ?? 0) + qty,
        },
      }));
      setQty(1);
      return;
    }
    const product = products.find(p => p.id === productId);
    if (!product || qty <= 0) return;
    // Fixing/sealant are whole-box units -- clamp to a whole number
    // (track stays fractional -- it's genuinely billed by raw metres).
    const finalQty = category === "fixing" || category === "sealant" ? Math.max(1, Math.round(qty)) : qty;
    setManualItems(prev => [...prev, makeLineItem(category, product.label, finalQty, product.price ?? null)]);
    setProductId("");
    setQty(1);
  };

  const handleQtyChange = (id: string, newQty: number) => {
    setManualItems(prev => prev.map(i => i.id === id ? { ...i, qty: newQty, lineTotalExGst: i.matched ? round2((i.unitPriceExGst ?? 0) * newQty) : 0 } : i));
  };
  const handleRemove = (item: OrderLineItem) => {
    if (item.category === "panel") {
      setPanelGroups(prev => { const next = { ...prev }; delete next[item.id]; return next; });
    } else {
      setManualItems(prev => prev.filter(i => i.id !== item.id));
    }
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
    return <LoadingState className="mt-6" label="Loading catalog" />;
  }

  if (projectError || !project) {
    return (
      <div className="mt-6">
        <ErrorState message={projectError || "Project not found."} />
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back to project</button>
      </div>
    );
  }

  if (catalogError || pricingError) {
    return (
      <div className="mt-6">
        <ErrorState message={catalogError || pricingError || "Something went wrong."} />
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back to project</button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back to project</button>

      <div className={`${cx.card} mt-3`}>
        <h1 className={cx.h1}>Quick Order -- {project.name}</h1>
        <p className={cx.footnote}>Add products directly, without using the Estimator.</p>

        <div className={`mt-4 grid gap-2 sm:items-end ${category === "panel" ? "sm:grid-cols-[1fr_1fr_90px_90px_auto]" : "sm:grid-cols-[1fr_1fr_100px_auto]"}`}>
          <SelectField label="Category" value={category}
            options={PRICEABLE_CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))}
            onChange={v => { setCategory(v as PriceableCategory); setProductId(""); setQty(1); }} />
          <SelectField label="Product" value={productId}
            options={[{ value: "", label: "Choose a product..." }, ...products.map(p => ({
              value: p.id, label: p.price != null ? `${p.label} -- $${p.price.toFixed(2)}/${CATEGORY_CONFIG[category].unit}` : `${p.label} -- not priced`,
            }))]}
            onChange={setProductId} />
          {category === "panel" && <NumField label="Length (m)" value={lengthM} onChange={setLengthM} />}
          <NumField label={category === "panel" ? "Pieces" : "Qty"} value={qty} onChange={setQty} />
          <Button icon={<Plus size={15} />} className="h-[46px] shrink-0" disabled={!productId || qty <= 0 || (category === "panel" && lengthM <= 0)} onClick={addItem}>
            Add
          </Button>
        </div>

        {category === "panel" && panelPreview && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm">
            <StockBadge status={panelPreview.status} />
            <span style={{ color: NAVY }}>
              {qty} piece{qty !== 1 ? "s" : ""} needed &rarr; {panelPreview.pack.ordered} ordered
              ({panelPreview.pack.packs} pack{panelPreview.pack.packs !== 1 ? "s" : ""} of {PACK[selectedPanel!.type]}, {panelPreview.pack.spare} spare)
            </span>
            {panelPreview.pack.underPack && <div className="w-full"><PackNote type={selectedPanel!.type} spare={panelPreview.pack.spare} /></div>}
          </div>
        )}

        {totals.unpricedItemCount > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {totals.unpricedItemCount} item{totals.unpricedItemCount !== 1 ? "s" : ""} couldn't be priced automatically -- included at $0, Speedpanel will confirm pricing for these separately.
          </div>
        )}

        <div className="mt-4">
          <QuickOrderItemsTable items={items} onQtyChange={handleQtyChange} onRemove={handleRemove} />
        </div>

        <div className="mt-4 max-w-xs ml-auto space-y-1">
          <Row k="Subtotal (ex GST)" v={`$${totals.subtotalExGst.toFixed(2)}`} dim />
          <Row k={`GST (${(GST_RATE * 100).toFixed(0)}%)`} v={`$${totals.gstAmount.toFixed(2)}`} dim />
          <Row k="Total (inc GST)" v={`$${totals.totalIncGst.toFixed(2)}`} hl />
        </div>

        {createError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{createError}</p>}

        <Button onClick={handleCreate} disabled={creating || items.length === 0} className="mt-4 w-full">
          {creating ? "Creating..." : "Create order"}
        </Button>
      </div>
    </div>
  );
};
