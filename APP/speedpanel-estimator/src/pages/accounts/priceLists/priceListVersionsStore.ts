// =============================================================================
// Company Accounts & Pricing -- Price Lists library + draft editor (Phase 7)
// =============================================================================
// Two new read-only RPCs (see supabase/schema.sql's "Pricing: Price Lists
// library + draft editor" section, right after Phase 6's price-list
// versioning RPCs): admin_list_price_list_versions() backs both the
// library's cross-list Draft Versions/Scheduled/Archived tabs (p_price_list_id
// null) and one list's own version history in its draft editor (given an
// id); admin_diff_price_list_versions() is the shared version-diff table
// this phase's Publish tab uses, reused as-is by Phase 8's Compare & Publish
// screen per the plan. All writes (create/rename/duplicate/delete a price
// list, create a draft, set/delete a draft price) already exist in
// src/pages/admin/priceLists/priceListsStore.ts (Phase 6) -- reused
// directly, not duplicated here.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { PRICEABLE_CATEGORIES } from "../../admin/priceLists/priceListTypes";

const NOT_CONFIGURED = "Price lists aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export const PRICE_LIST_VERSION_STATUSES = ["draft", "scheduled", "active", "expired", "archived"] as const;
export type PriceListVersionStatus = typeof PRICE_LIST_VERSION_STATUSES[number];

export const PRICE_LIST_VERSION_STATUS_LABELS: Record<PriceListVersionStatus, string> = {
  draft: "Draft", scheduled: "Scheduled", active: "Active", expired: "Expired", archived: "Archived",
};

const AdminPriceListVersionRowSchema = z.object({
  id: z.string(), price_list_id: z.string(), price_list_name: z.string(),
  version_number: z.number(), status: z.enum(PRICE_LIST_VERSION_STATUSES),
  effective_date: z.string().nullable(), notes: z.string().nullable(),
  created_by: z.string().nullable(), created_by_name: z.string().nullable(), created_at: z.string(),
  published_at: z.string().nullable(), published_by: z.string().nullable(), published_by_name: z.string().nullable(),
  price_count: z.number(),
});
export type AdminPriceListVersionRow = z.infer<typeof AdminPriceListVersionRowSchema>;

interface VersionsState { versions: AdminPriceListVersionRow[]; loading: boolean; error: string | null; }

// priceListId null -> every version across every price list (the library's
// cross-list tabs); given an id, that one list's own version history.
export function useAdminPriceListVersions(priceListId: string | null) {
  const [state, setState] = useState<VersionsState>({ versions: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase) { setState({ versions: [], loading: false, error: NOT_CONFIGURED }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_price_list_versions", { p_price_list_id: priceListId });
    if (error) { setState({ versions: [], loading: false, error: error.message }); return; }
    const parsed = AdminPriceListVersionRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ versions: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ versions: parsed.data, loading: false, error: null });
  }, [priceListId]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}

const PriceDiffRowSchema = z.object({
  category: z.enum(PRICEABLE_CATEGORIES),
  panel_id: z.string().nullable(), track_id: z.string().nullable(),
  fixing_id: z.string().nullable(), sealant_id: z.string().nullable(),
  old_price: z.number().nullable(), new_price: z.number().nullable(),
  change_type: z.enum(["added", "removed", "changed", "unchanged"]),
});
export type PriceDiffRow = z.infer<typeof PriceDiffRowSchema>;

// Same coalesce(...)-the-one-non-null-id pattern priceRowProductId() already
// establishes for PriceListPriceRow -- a diff row identifies a product the
// same way, just without an `id` of its own (it's synthesized across two
// versions' rows, see admin_diff_price_list_versions()'s own comment).
export function priceDiffRowProductId(row: PriceDiffRow): string {
  return (row.panel_id ?? row.track_id ?? row.fixing_id ?? row.sealant_id)!;
}

interface DiffState { rows: PriceDiffRow[]; loading: boolean; error: string | null; }

// toVersionId null (no draft/target version yet) skips the call entirely --
// there's nothing to diff against.
export function useVersionDiff(fromVersionId: string | null, toVersionId: string | null) {
  const [state, setState] = useState<DiffState>({ rows: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!supabase) { setState({ rows: [], loading: false, error: NOT_CONFIGURED }); return; }
      if (!toVersionId) { setState({ rows: [], loading: false, error: null }); return; }
      setState(s => ({ ...s, loading: true, error: null }));
      const { data, error } = await supabase.rpc("admin_diff_price_list_versions", {
        p_from_version_id: fromVersionId, p_to_version_id: toVersionId,
      });
      if (cancelled) return;
      if (error) { setState({ rows: [], loading: false, error: error.message }); return; }
      const parsed = PriceDiffRowSchema.array().safeParse(data ?? []);
      if (!parsed.success) { setState({ rows: [], loading: false, error: BAD_SHAPE }); return; }
      setState({ rows: parsed.data, loading: false, error: null });
    }

    run();
    return () => { cancelled = true; };
  }, [fromVersionId, toVersionId]);

  return state;
}
