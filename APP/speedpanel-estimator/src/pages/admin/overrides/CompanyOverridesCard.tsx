// =============================================================================
// Admin > Companies -- "Customer Overrides" AccordionCard content
// =============================================================================
// Drops into AdminCompaniesPage.tsx's CompanyRow, immediately after
// PR1's "Price List" card, per that file's own documented extension point.
// Lists existing company_product_overrides rows (label + price + Clear),
// plus an "Override Price" button that opens an inline product picker --
// a duplicate (not an extraction) of AdminPriceListsPage.tsx's
// category-chip + search pattern, matching this codebase's existing "reuse
// the pattern, not the component" convention for that exact shape. Kept as
// a simple vertical list rather than CardGrid since this is a small,
// embedded picker inside a company row, not a full page (no layoutMode
// prop is threaded down through AdminCompaniesPage/AdminRoot for it).
// =============================================================================
import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { cx, BLUE, WHITE, NAVY, MUTED } from "../../../styleTokens";
import { useProductStore } from "../products/productStore";
import { CATEGORY_KEY, CATEGORY_LABEL } from "../products/productTypes";
import { itemTitle } from "../products/productCategoryViews";
import type { ProductItem } from "../products/productCard";
import { useCompanyOverrides } from "./overridesStore";
import { PRICEABLE_CATEGORIES, priceRowProductId, type PriceableCategory } from "../priceLists/priceListTypes";

const matchesQuery = (item: ProductItem, q: string): boolean => JSON.stringify(item).toLowerCase().includes(q);

export const CompanyOverridesCard = ({ companyId }: { companyId: string }) => {
  const { catalog, loading: catalogLoading } = useProductStore();
  const { overrides, loading: overridesLoading, error, setOverride, clearOverride } = useCompanyOverrides(companyId);
  const [picking, setPicking] = useState(false);
  const [category, setCategory] = useState<PriceableCategory>("panel");
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const list = catalog[CATEGORY_KEY[category]] as ProductItem[];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter(i => matchesQuery(i, q)) : list;
  }, [list, query]);

  const labelFor = (cat: PriceableCategory, productId: string): string => {
    const items = catalog[CATEGORY_KEY[cat]] as ProductItem[];
    const item = items.find(i => i.id === productId);
    return item ? itemTitle(cat, item) : "Unknown product";
  };

  const closePicker = () => { setPicking(false); setPickedId(null); setPriceDraft(""); setSaveError(null); };

  const handleSave = async () => {
    if (!pickedId) return;
    const parsed = Number(priceDraft);
    if (priceDraft.trim() === "" || Number.isNaN(parsed)) { setSaveError("Enter a valid price."); return; }
    const err = await setOverride(category, pickedId, parsed);
    if (err) { setSaveError(err); return; }
    closePicker();
  };

  if (catalogLoading || overridesLoading) return <p className={cx.footnote} style={{ paddingTop: 0 }}>Loading...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div>
      {overrides.length === 0 ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>No price overrides for this company.</p>
      ) : (
        <div className="space-y-2">
          {overrides.map(o => (
            <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold" style={{ color: NAVY }}>{labelFor(o.category, priceRowProductId(o))}</div>
                <p className={cx.footnote} style={{ paddingTop: 0 }}>{CATEGORY_LABEL[o.category]} &middot; ${o.price}</p>
              </div>
              <button onClick={() => clearOverride(o.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!picking && (
        <button onClick={() => setPicking(true)} className="mt-3 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
          <Plus size={14} /> Override Price
        </button>
      )}

      {picking && (
        <div className="mt-3">
          {!pickedId ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                <Search size={14} className="shrink-0" style={{ color: MUTED }} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products..."
                  className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRICEABLE_CATEGORIES.map(c => {
                  const on = category === c;
                  return (
                    <button key={c} onClick={() => setCategory(c)}
                      className={"rounded-full border px-3 py-1 text-xs font-bold transition-all active:scale-95 " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
                      style={on ? { borderColor: BLUE, background: BLUE, color: WHITE } : { color: BLUE }}>
                      {CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                {filtered.map(item => (
                  <button key={item.id} onClick={() => setPickedId(item.id)}
                    className="block w-full truncate rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm" style={{ color: NAVY }}>
                    {itemTitle(category, item)}
                  </button>
                ))}
                {filtered.length === 0 && <p className={cx.footnote} style={{ paddingTop: 0 }}>No products match.</p>}
              </div>
              <button onClick={closePicker} className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Cancel</button>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>{labelFor(category, pickedId)}</p>
              <div className="mt-2 flex items-center gap-2">
                <input value={priceDraft} onChange={e => setPriceDraft(e.target.value)} placeholder="Price ($)"
                  className={cx.input} style={{ color: NAVY }} />
                <button onClick={handleSave} className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>Save</button>
              </div>
              {saveError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{saveError}</p>}
              <button onClick={() => setPickedId(null)} className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Back</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
