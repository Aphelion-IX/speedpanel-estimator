// =============================================================================
// Company Accounts & Pricing -- live Customer Price Preview (Phase 9)
// =============================================================================
// Shows exactly what a member of this company would see priced at right
// now -- reuses the SAME data path a real order/estimate goes through
// (useEffectivePriceListPrices() -> applyEffectivePricing()'s 3-tier
// resolution in src/export/applyEffectivePricing.ts), not a parallel
// re-implementation, so this preview can never drift from real pricing
// behavior. Read-only: no write actions live here, only the resolved price
// and which tier produced it.
// =============================================================================
import { useMemo, useState } from "react";
import { cx, MUTED, BLUE, WHITE } from "../../../styleTokens";
import { Badge } from "../../../ui/badge";
import { LoadingState, ErrorState } from "../../../ui/states";
import { SearchBox } from "../../../ui/primitives";
import { Table, type TableColumn } from "../../../ui/table";
import { useProductStore } from "../../admin/products/productStore";
import { CATEGORY_KEY, CATEGORY_LABEL } from "../../admin/products/productTypes";
import { itemTitle } from "../../admin/products/productCategoryViews";
import type { ProductItem } from "../../admin/products/productCard";
import { useEffectivePriceListPrices } from "../../admin/priceLists/priceListsStore";
import { PRICEABLE_CATEGORIES, priceRowProductId, type PriceableCategory } from "../../admin/priceLists/priceListTypes";
import { overrideProductId } from "./companyPriceOverridesStore";

type PriceSource = "override" | "assigned" | "default" | "catalog";
const SOURCE_LABEL: Record<PriceSource, string> = {
  override: "Item override", assigned: "Assigned list", default: "PL1 -- Standard", catalog: "Catalog default",
};
const SOURCE_TONE: Record<PriceSource, "ok" | "info" | "neutral" | "warn"> = {
  override: "ok", assigned: "info", default: "neutral", catalog: "warn",
};

export const CustomerPricePreview = ({ companyId }: { companyId: string }) => {
  const { catalog, loading: catalogLoading } = useProductStore();
  const { overrides, assigned, defaultList, loading: pricingLoading, error } = useEffectivePriceListPrices(companyId);
  const [category, setCategory] = useState<PriceableCategory>("panel");
  const [query, setQuery] = useState("");

  const resolved = useMemo(() => {
    const overrideMap = new Map(overrides.map(r => [`${r.category}:${overrideProductId(r)}`, r.override_price]));
    const assignedMap = new Map(assigned.map(r => [`${r.category}:${priceRowProductId(r)}`, r.price]));
    const defaultMap = new Map(defaultList.map(r => [`${r.category}:${priceRowProductId(r)}`, r.price]));

    return (existingPrice: number | undefined, cat: PriceableCategory, productId: string): { price: number | undefined; source: PriceSource } => {
      const key = `${cat}:${productId}`;
      if (overrideMap.has(key)) return { price: overrideMap.get(key), source: "override" };
      if (assignedMap.has(key)) return { price: assignedMap.get(key), source: "assigned" };
      if (defaultMap.has(key)) return { price: defaultMap.get(key), source: "default" };
      return { price: existingPrice, source: "catalog" };
    };
  }, [overrides, assigned, defaultList]);

  const list = catalog[CATEGORY_KEY[category]] as ProductItem[];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter(i => JSON.stringify(i).toLowerCase().includes(q)) : list;
    return filtered.map(item => {
      const existing = (item as { pricePerPanel?: number; pricePerMetre?: number; pricePerBox?: number })
        .pricePerPanel ?? (item as { pricePerMetre?: number }).pricePerMetre ?? (item as { pricePerBox?: number }).pricePerBox;
      const { price, source } = resolved(existing, category, item.id);
      return { item, price, source };
    });
  }, [list, query, category, resolved]);

  if (catalogLoading || pricingLoading) return <LoadingState className="mt-3" label="Resolving effective pricing" />;
  if (error) return <ErrorState className="mt-3" message={error} />;

  const columns: TableColumn<typeof rows[number]>[] = [
    { key: "product", header: "Product", cell: r => itemTitle(category, r.item) },
    { key: "price", header: "Effective price", align: "right", cell: r => r.price != null ? `$${r.price.toFixed(2)}` : "Not set" },
    { key: "source", header: "Source", align: "right", cell: r => <Badge tone={SOURCE_TONE[r.source]}>{SOURCE_LABEL[r.source]}</Badge> },
  ];

  return (
    <section className={cx.card}>
      <h2 className={cx.h3}>Customer Price Preview</h2>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>What this company's users would actually be charged right now, for every product -- live, not a snapshot.</p>

      <SearchBox value={query} onChange={setQuery} placeholder="Search products..." />
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

      <div className="mt-4">
        <Table columns={columns} rows={rows} rowKey={r => r.item.id} />
      </div>
    </section>
  );
};
