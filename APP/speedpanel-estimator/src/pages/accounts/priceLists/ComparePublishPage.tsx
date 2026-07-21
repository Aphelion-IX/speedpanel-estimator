// =============================================================================
// Company Accounts & Pricing -- Compare & Publish (Phase 8)
// =============================================================================
// Powers PriceListVersionEditor.tsx's "Publish" tab. Grew out of Phase 7's
// inline PublishTab (diff table + validation checklist, but a permanently
// disabled button, since admin_publish_price_list_version() didn't exist
// yet) into its own file per the plan's file list, now with: a per-row
// Normal/Review flag (not just a checklist summary), a company-impact
// count, an approval note, an optional effective date (blank = publish now,
// a future date schedules it instead -- see the RPC's own comment in
// supabase/schema.sql for the "no cron job" lazy-activation story), and a
// real working Publish button.
// =============================================================================
import { useMemo, useState } from "react";
import { AlertTriangle, Building2 } from "lucide-react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { Badge } from "../../../ui/badge";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { ConfirmDialog, ErrorDialog } from "../../../ui/confirmDialog";
import { Table, type TableColumn } from "../../../ui/table";
import { useProductStore } from "../../admin/products/productStore";
import { CATEGORY_KEY, CATEGORY_LABEL } from "../../admin/products/productTypes";
import { itemTitle } from "../../admin/products/productCategoryViews";
import type { ProductItem } from "../../admin/products/productCard";
import { useAdminCompanies } from "../../admin/companies/companiesStore";
import {
  useVersionDiff, priceDiffRowProductId, adminPublishPriceListVersion, type PriceDiffRow,
} from "./priceListVersionsStore";

const LARGE_CHANGE_THRESHOLD = 0.2;

function isReviewRow(row: PriceDiffRow): boolean {
  if (row.new_price != null && row.new_price <= 0) return true;
  if (row.change_type === "changed" && row.old_price != null && row.old_price !== 0 && row.new_price != null) {
    return Math.abs((row.new_price - row.old_price) / row.old_price) > LARGE_CHANGE_THRESHOLD;
  }
  return false;
}

export const ComparePublishPage = ({ priceListId, activeVersionId, draftVersionId, onPublished }: {
  priceListId: string; activeVersionId: string | null; draftVersionId: string | null; onPublished: () => void;
}) => {
  const { catalog } = useProductStore();
  const { rows, loading, error } = useVersionDiff(activeVersionId, draftVersionId);
  const { companies } = useAdminCompanies();
  const [effectiveDate, setEffectiveDate] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busyError, setBusyError] = useState<string | null>(null);

  const impactedCompanyCount = useMemo(() => companies.filter(c => c.price_list_id === priceListId).length, [companies, priceListId]);

  const labelFor = (row: PriceDiffRow): string => {
    const productId = priceDiffRowProductId(row);
    const items = catalog[CATEGORY_KEY[row.category]] as ProductItem[];
    const item = items.find(i => i.id === productId);
    return item ? itemTitle(row.category, item) : productId;
  };

  const changed = rows.filter(r => r.change_type !== "unchanged");
  const reviewRows = changed.filter(isReviewRow);
  const removed = changed.filter(r => r.change_type === "removed");
  const isScheduled = effectiveDate !== "" && effectiveDate > new Date().toISOString().slice(0, 10);

  const handlePublish = async () => {
    if (!draftVersionId) return;
    setConfirming(false);
    setPublishing(true);
    const err = await adminPublishPriceListVersion(draftVersionId, effectiveDate || null, approvalNote.trim() || null);
    setPublishing(false);
    if (err) { setBusyError(err); return; }
    setEffectiveDate("");
    setApprovalNote("");
    onPublished();
  };

  if (!draftVersionId) {
    return <EmptyState className={`${cx.card} text-center`} message="No draft in progress -- start editing a price on the Product Prices tab to create one." />;
  }
  if (loading) return <LoadingState className="mt-3" label="Comparing versions" />;
  if (error) return <ErrorState className="mt-3" message={error} />;

  const columns: TableColumn<PriceDiffRow>[] = [
    { key: "product", header: "Product", cell: r => labelFor(r) },
    { key: "category", header: "Category", cell: r => CATEGORY_LABEL[r.category] },
    { key: "old", header: "Live price", align: "right", cell: r => r.old_price != null ? `$${r.old_price.toFixed(2)}` : "—" },
    { key: "new", header: "Draft price", align: "right", cell: r => r.new_price != null ? `$${r.new_price.toFixed(2)}` : "—" },
    {
      key: "change", header: "Change", align: "right",
      cell: r => {
        const t = r.change_type === "added" ? "info" : r.change_type === "removed" ? "danger" : r.change_type === "changed" ? "warn" : "neutral";
        const label = r.change_type === "added" ? "Added" : r.change_type === "removed" ? "Removed" : r.change_type === "changed" ? "Changed" : "Unchanged";
        return <Badge tone={t}>{label}</Badge>;
      },
    },
    {
      key: "flag", header: "Flag", align: "right",
      cell: r => isReviewRow(r) ? <Badge tone="danger">Review</Badge> : <Badge tone="neutral">Normal</Badge>,
    },
  ];

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={confirming}
        title={isScheduled ? "Schedule this publish?" : "Publish now?"}
        description={
          isScheduled
            ? `This draft will become the live price list on ${effectiveDate}, affecting ${impactedCompanyCount} compan${impactedCompanyCount === 1 ? "y" : "ies"}. Today's prices stay live until then.`
            : `This draft goes live immediately, affecting ${impactedCompanyCount} compan${impactedCompanyCount === 1 ? "y" : "ies"}. This can't be undone -- a later change needs a new draft.`
        }
        confirmLabel={publishing ? "Publishing..." : isScheduled ? "Schedule" : "Publish now"}
        onConfirm={handlePublish}
        onCancel={() => setConfirming(false)}
      />
      <ErrorDialog message={busyError} onDismiss={() => setBusyError(null)} />

      <div className={cx.card}>
        <h2 className={cx.h3}>Draft-validation checklist</h2>
        <div className="mt-3 space-y-2 text-sm">
          <p className={reviewRows.length > 0 ? "flex items-center gap-2 font-semibold text-red-600 dark:text-red-300" : "flex items-center gap-2"} style={reviewRows.length > 0 ? undefined : { color: MUTED }}>
            {reviewRows.length > 0 && <AlertTriangle size={14} />} {reviewRows.length} line{reviewRows.length === 1 ? "" : "s"} flagged for review (zero/negative price, or a change over {LARGE_CHANGE_THRESHOLD * 100}%)
          </p>
          <p style={{ color: MUTED }}>{removed.length} price{removed.length === 1 ? "" : "s"} removed, {changed.length} total change{changed.length === 1 ? "" : "s"}</p>
          <p className="flex items-center gap-2" style={{ color: MUTED }}>
            <Building2 size={14} /> {impactedCompanyCount} compan{impactedCompanyCount === 1 ? "y" : "ies"} assigned to this list today
          </p>
        </div>
      </div>

      <div className={cx.card}>
        <h2 className={cx.h3}>Changes vs. today's live prices</h2>
        {changed.length === 0 ? (
          <EmptyState className="mt-3 text-center" message="No changes yet -- this draft is identical to the live prices." />
        ) : (
          <div className="mt-3"><Table columns={columns} rows={changed} rowKey={(r, i) => `${r.category}-${priceDiffRowProductId(r)}-${i}`} /></div>
        )}
      </div>

      <div className={cx.card}>
        <h2 className={cx.h3}>Publish</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-semibold" style={{ color: NAVY }}>Effective date (optional)</span>
            <input
              type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)} className={cx.input}
            />
            <span className="mt-1 block text-xs" style={{ color: MUTED }}>
              Leave blank to publish immediately. A future date schedules it instead -- today's prices stay live until then.
            </span>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold" style={{ color: NAVY }}>Approval note (optional)</span>
            <textarea
              value={approvalNote} onChange={e => setApprovalNote(e.target.value)}
              rows={2} className={cx.input}
            />
          </label>
        </div>
        <div className="mt-4">
          <Button onClick={() => setConfirming(true)} disabled={publishing}>
            {isScheduled ? `Schedule for ${effectiveDate}` : "Publish now"}
          </Button>
        </div>
      </div>
    </div>
  );
};
