// =============================================================================
// Create Order -- review + confirm priced line items from a project's estimate
// =============================================================================
// Recomputes the project's estimate headlessly (computeProjectReportData),
// prices it against the live catalog (priceReportData), lets the customer
// review/adjust quantities and exclude items before confirming, then hands
// off to the delivery-splitting step (OrderDetailPage, once the order row
// exists in 'draft'). No stage gating -- reachable from a project at any
// stage, per the feature's design.
// =============================================================================
import { useEffect, useMemo, useState } from "react";
import { cx, BLUE } from "../../../styleTokens";
import { Row } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { LoadingState, ErrorState } from "../../../ui/states";
import type { UseAuth } from "../../../lib/useAuth";
import { useProject } from "../projectDetailStore";
import { useProductStore } from "../../admin/products/productStore";
import { useEffectivePriceListPrices } from "../../admin/priceLists/priceListsStore";
import { applyEffectivePricing } from "../../../export/applyEffectivePricing";
import { computeProjectReportData } from "../../../estimate/computeProjectReportData";
import { priceReportData, round2, GST_RATE } from "../../../export/priceEstimateReportData";
import { useProjectOrders } from "./ordersStore";
import { OrderLineItemsTable, type DraftLineItem } from "./OrderLineItemsTable";

export const OrderBuilderPage = ({ projectId, auth, onBack, onCreated }: {
  projectId: string; auth: UseAuth; onBack: () => void; onCreated: (orderId: string) => void;
}) => {
  const { project, loading: projectLoading, error: projectError } = useProject(projectId);
  const { catalog, loading: catalogLoading, error: catalogError } = useProductStore();
  const { assigned, defaultList, loading: pricingLoading, error: pricingError } = useEffectivePriceListPrices(project?.company_id ?? null);
  const { createOrder } = useProjectOrders(projectId);

  const [items, setItems] = useState<DraftLineItem[] | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!project || catalogLoading || pricingLoading) return;
    try {
      const report = computeProjectReportData(project.data);
      const effectiveCatalog = applyEffectivePricing(catalog, assigned, defaultList);
      const priced = priceReportData(report, effectiveCatalog);
      setItems(priced.items.map(i => ({ ...i, included: true })));
    } catch (err) {
      setComputeError(err instanceof Error ? err.message : "This project's estimate couldn't be priced.");
    }
    // Re-price only when the project, catalog, or price lists actually
    // change -- not on every keystroke while the customer is adjusting
    // quantities below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.data, catalog, assigned, defaultList, pricingLoading]);

  const totals = useMemo(() => {
    if (!items) return null;
    const included = items.filter(i => i.included);
    const subtotalExGst = round2(included.reduce((sum, i) => sum + i.lineTotalExGst, 0));
    const gstAmount = round2(subtotalExGst * GST_RATE);
    return {
      includedItems: included, subtotalExGst, gstAmount, totalIncGst: round2(subtotalExGst + gstAmount),
      unpricedItemCount: included.filter(i => !i.matched).length,
    };
  }, [items]);

  const handleCreate = async () => {
    if (!totals || !auth.user) return;
    if (totals.includedItems.length === 0) { setCreateError("Include at least one line item."); return; }
    setCreating(true);
    setCreateError(null);
    const { id, error } = await createOrder(auth.user.id, {
      lineItems: totals.includedItems, subtotalExGst: totals.subtotalExGst, gstRate: GST_RATE,
      gstAmount: totals.gstAmount, totalIncGst: totals.totalIncGst, unpricedItemCount: totals.unpricedItemCount,
    });
    setCreating(false);
    if (error) { setCreateError(error); return; }
    if (id) onCreated(id);
  };

  if (projectLoading || catalogLoading || pricingLoading) {
    return <LoadingState className="mt-6" label="Loading estimate" />;
  }

  if (projectError || !project) {
    return (
      <div className="mt-6">
        <ErrorState message={projectError || "Project not found."} />
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back to project</button>
      </div>
    );
  }

  if (computeError || catalogError || pricingError) {
    return (
      <div className="mt-6">
        <ErrorState message={computeError || catalogError || pricingError || "Something went wrong."} />
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back to project</button>
      </div>
    );
  }

  if (!items || !totals) {
    return <LoadingState className="mt-6" label="Loading estimate" />;
  }

  return (
    <div className="mt-2">
      <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back to project</button>

      <div className={`${cx.card} mt-3`}>
        <h1 className={cx.h1}>Create order -- {project.name}</h1>
        <p className={cx.footnote}>Review the priced line items below, then continue to arrange delivery.</p>

        {totals.unpricedItemCount > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {totals.unpricedItemCount} item{totals.unpricedItemCount !== 1 ? "s" : ""} couldn't be priced automatically -- included at $0, Speedpanel will confirm pricing for these separately.
          </div>
        )}

        <div className="mt-4">
          <OrderLineItemsTable items={items} onChange={setItems} />
        </div>

        <div className="mt-4 max-w-xs ml-auto space-y-1">
          <Row k="Subtotal (ex GST)" v={`$${totals.subtotalExGst.toFixed(2)}`} dim />
          <Row k={`GST (${(GST_RATE * 100).toFixed(0)}%)`} v={`$${totals.gstAmount.toFixed(2)}`} dim />
          <Row k="Total (inc GST)" v={`$${totals.totalIncGst.toFixed(2)}`} hl />
        </div>

        {createError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{createError}</p>}

        <Button onClick={handleCreate} disabled={creating} className="mt-4 w-full">
          {creating ? "Creating..." : "Continue to deliveries"}
        </Button>
      </div>
    </div>
  );
};
