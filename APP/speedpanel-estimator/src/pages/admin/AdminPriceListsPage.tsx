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
import { CardGrid, SectionLabel, IconButton } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { LoadingState, ErrorState } from "../../ui/states";
import { ConfirmDialog, ErrorDialog } from "../../ui/confirmDialog";
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
      {pl.is_default && <Badge tone="info">Default</Badge>}
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
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const startDuplicate = () => { setDuplicateName(`${pl.name} (copy)`); setBusyError(null); setDuplicating(true); };
  const handleDuplicate = async () => {
    if (!duplicateName.trim()) return;
    const { id, error } = await duplicatePriceList(pl.id, duplicateName.trim());
    if (error) { setBusyError(error); return; }
    setDuplicating(false);
    if (id) onDuplicated(id);
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    const error = await deletePriceList(pl.id);
    if (error) { setBusyError(error); return; }
    onDeleted();
  };

  return (
    <div className="mt-2">
      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete price list"
        description={`Delete "${pl.name}"? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <ErrorDialog message={busyError} onDismiss={() => setBusyError(null)} />
      <div className={cx.card}>
        <div className="flex items-center justify-between gap-2">
          {renaming ? (
            <div className="flex flex-1 items-center gap-2">
              <Field label="" value={nameDraft} onChange={setNameDraft} />
              <button onClick={handleRename} aria-label="Save name" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: BLUE, color: WHITE }}><Check size={14} /></button>
              <IconButton size="lg" ariaLabel="Cancel rename" onClick={() => { setRenaming(false); setNameDraft(pl.name); }}><X size={14} /></IconButton>
            </div>
          ) : duplicating ? (
            <div className="flex flex-1 items-center gap-2">
              <Field label="" value={duplicateName} onChange={setDuplicateName} />
              <button onClick={handleDuplicate} aria-label="Save duplicate name" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: BLUE, color: WHITE }}><Check size={14} /></button>
              <IconButton size="lg" ariaLabel="Cancel duplicate" onClick={() => setDuplicating(false)}><X size={14} /></IconButton>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold" style={{ color: NAVY }}>{pl.name}</span>
                {pl.is_default && <Badge tone="info">Default</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <IconButton size="sm" ariaLabel="Rename price list" onClick={() => setRenaming(true)}><Pencil size={14} /></IconButton>
                <IconButton size="sm" ariaLabel="Duplicate price list" onClick={startDuplicate}><Copy size={14} /></IconButton>
                {!pl.is_default && pl.company_count === 0 && (
                  <IconButton size="sm" variant="danger" ariaLabel="Delete price list" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /></IconButton>
                )}
              </div>
            </>
          )}
        </div>
      </div>

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

  if (loading) return <LoadingState className="mt-6" label="Loading price lists" />;

  if (error) return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className={cx.h1}>Price Lists</h1>
        {!creating && (
          <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>New price list</Button>
        )}
      </div>

      {creating && (
        <div className={`${cx.card} mt-3`}>
          <Field label="Name" value={newName} onChange={setNewName} />
          {createError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{createError}</p>}
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={handleCreate}>Create</Button>
            <Button variant="secondary" onClick={() => { setCreating(false); setNewName(""); setCreateError(null); }}>Cancel</Button>
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
