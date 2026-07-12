// =============================================================================
// Admin > Price Lists -- manage PL1 - Standard and any negotiated lists
// =============================================================================
// Master/detail, same composition as AdminProductsPage.tsx: a card grid of
// price_lists rows on the left/top, a persistent detail panel on the
// right/bottom. The detail panel reuses AdminProductsPage's own category-
// chips + search + card-grid *pattern* (not the component -- this is
// editing one price per row, not full product specs) for picking which
// product to set a price on. Super_admin/null-gated -- omitted from
// adminSectionAccess.ts's SECTION_ROLES, same as Products/Companies.
// =============================================================================
import { useMemo, useState } from "react";
import { Plus, Search, Copy, Trash2, Pencil, Check, X } from "lucide-react";
import { cx, BLUE, WHITE, NAVY, MUTED } from "../../styleTokens";
import type { EffectiveLayout } from "../../useLayoutMode";
import { CardGrid, SectionLabel } from "../../ui/primitives";
import { Field } from "../shared/fields";
import { useProductStore } from "./products/productStore";
import { CATEGORY_KEY, CATEGORY_LABEL } from "./products/productTypes";
import { itemTitle } from "./products/productCategoryViews";
import type { ProductItem } from "./products/productCard";
import { useAdminPriceLists, useAdminPriceListPrices } from "./priceLists/priceListsStore";
import { PRICEABLE_CATEGORIES, priceRowProductId, type PriceListSummaryRow, type PriceableCategory } from "./priceLists/priceListTypes";

const matchesQuery = (item: ProductItem, q: string): boolean => JSON.stringify(item).toLowerCase().includes(q);

const PriceListCard = ({ pl, selected, onSelect }: { pl: PriceListSummaryRow; selected: boolean; onSelect: () => void }) => (
  <div onClick={onSelect} className={cx.card + " cursor-pointer"} style={selected ? { borderColor: BLUE, borderWidth: 2 } : undefined}>
    <div className="flex items-center justify-between gap-2">
      <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{pl.name}</div>
      {pl.is_default && <span className={cx.badge} style={{ background: BLUE, color: WHITE }}>Default</span>}
    </div>
    <p className={cx.footnote}>
      {pl.product_count} priced product{pl.product_count === 1 ? "" : "s"} &middot; {pl.company_count} compan{pl.company_count === 1 ? "y" : "ies"}
    </p>
  </div>
);

// One row in the detail panel's product picker: label + current price on
// this list (blank if unset) + Save/Clear.
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
          className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-right"
          style={{ color: NAVY }}
        />
        {dirty && (
          <button onClick={commit} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: BLUE, color: WHITE }}><Check size={14} /></button>
        )}
        {priceRowId && !dirty && (
          <button onClick={() => { onClear(); setDraft(""); }} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

const PriceListDetail = ({ pl, layoutMode, onRenamed, onDuplicated, onDeleted }: {
  pl: PriceListSummaryRow; layoutMode: EffectiveLayout;
  onRenamed: () => void; onDuplicated: (id: string) => void; onDeleted: () => void;
}) => {
  const { catalog, loading: catalogLoading } = useProductStore();
  const { prices, loading: pricesLoading, error: pricesError, setPrice, deletePrice } = useAdminPriceListPrices(pl.id);
  const { renamePriceList, duplicatePriceList, deletePriceList } = useAdminPriceLists();
  const [category, setCategory] = useState<PriceableCategory>("panel");
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(pl.name);
  const [busyError, setBusyError] = useState<string | null>(null);

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

  const handleRename = async () => {
    if (!nameDraft.trim()) return;
    const error = await renamePriceList(pl.id, nameDraft.trim());
    if (error) { setBusyError(error); return; }
    setRenaming(false);
    onRenamed();
  };

  const handleDuplicate = async () => {
    const name = window.prompt("Name for the new price list:", `${pl.name} (copy)`);
    if (!name || !name.trim()) return;
    const { id, error } = await duplicatePriceList(pl.id, name.trim());
    if (error) { setBusyError(error); return; }
    if (id) onDuplicated(id);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${pl.name}"? This can't be undone.`)) return;
    const error = await deletePriceList(pl.id);
    if (error) { setBusyError(error); return; }
    onDeleted();
  };

  return (
    <div className="mt-2">
      <div className={cx.card}>
        <div className="flex items-center justify-between gap-2">
          {renaming ? (
            <div className="flex flex-1 items-center gap-2">
              <Field label="" value={nameDraft} onChange={setNameDraft} />
              <button onClick={handleRename} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: BLUE, color: WHITE }}><Check size={14} /></button>
              <button onClick={() => { setRenaming(false); setNameDraft(pl.name); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700"><X size={14} /></button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold" style={{ color: NAVY }}>{pl.name}</span>
                {pl.is_default && <span className={cx.badge} style={{ background: BLUE, color: WHITE }}>Default</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setRenaming(true)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"><Pencil size={14} /></button>
                <button onClick={handleDuplicate} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"><Copy size={14} /></button>
                {!pl.is_default && pl.company_count === 0 && (
                  <button onClick={handleDelete} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-500"><Trash2 size={14} /></button>
                )}
              </div>
            </>
          )}
        </div>
        {busyError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{busyError}</p>}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
        <Search size={16} className="shrink-0" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products..."
          className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRICEABLE_CATEGORIES.map(c => {
          const on = category === c;
          return (
            <button key={c} onClick={() => setCategory(c)}
              className={"rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
              style={on ? { borderColor: BLUE, background: BLUE, color: WHITE } : { color: BLUE }}>
              {CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>
      <div className="mt-5"><SectionLabel icon={<Search size={14} />}>{CATEGORY_LABEL[category]} ({filtered.length})</SectionLabel></div>

      {pricesError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{pricesError}</p>}

      {catalogLoading || pricesLoading ? (
        <div className={`${cx.card} mt-3 text-sm`} style={{ color: MUTED }}>Loading...</div>
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
                onSave={price => setPrice(category, item.id, price)}
                onClear={() => entry && deletePrice(entry.id)}
              />
            );
          })}
        </CardGrid>
      )}
    </div>
  );
};

export const AdminPriceListsPage = ({ layoutMode }: { layoutMode: EffectiveLayout }) => {
  const { priceLists, loading, error, reload, createPriceList } = useAdminPriceLists();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const selected = priceLists.find(pl => pl.id === selectedId) ?? null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const { id, error: err } = await createPriceList(newName.trim());
    if (err) { setCreateError(err); return; }
    setNewName("");
    setCreating(false);
    if (id) setSelectedId(id);
  };

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (error) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Price Lists</h1>
        {!creating && (
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
            <Plus size={15} /> New price list
          </button>
        )}
      </div>

      {creating && (
        <div className={`${cx.card} mt-3`}>
          <Field label="Name" value={newName} onChange={setNewName} />
          {createError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{createError}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={handleCreate} className="rounded-xl px-4 py-2 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>Create</button>
            <button onClick={() => { setCreating(false); setNewName(""); setCreateError(null); }} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-bold" style={{ color: NAVY }}>Cancel</button>
          </div>
        </div>
      )}

      <CardGrid layoutMode={layoutMode} minWidth={260}>
        {priceLists.map(pl => (
          <PriceListCard key={pl.id} pl={pl} selected={pl.id === selectedId} onSelect={() => setSelectedId(pl.id === selectedId ? null : pl.id)} />
        ))}
      </CardGrid>

      {selected && (
        <PriceListDetail
          pl={selected}
          layoutMode={layoutMode}
          onRenamed={reload}
          onDuplicated={id => { reload(); setSelectedId(id); }}
          onDeleted={() => { reload(); setSelectedId(null); }}
        />
      )}
    </div>
  );
};
