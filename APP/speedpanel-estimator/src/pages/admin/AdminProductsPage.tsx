// =============================================================================
// Admin > Products -- catalog CRUD page
// =============================================================================
// Master/detail page for browsing/editing Speedpanel's material catalogs
// (Panels, Tracks, Fixings, Sealant, External colours), a live Supabase
// fetch via useProductStore (RLS-gated writes, see productStore.ts).
// Composition mirrors EducationHub.tsx: gridBody (search + category chips
// + card grid) and a persistent detailPanel, stacked on phone / a sticky
// aside on web. Category/
// selection state stays page-local -- #/admin/products remains the one stable
// URL, same as EducationHub keeps its selection out of the URL too.
// =============================================================================
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { cx, NAVY, MUTED } from "../../styleTokens";
import type { EffectiveLayout } from "../../useLayoutMode";
import { CardGrid, SectionLabel } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import { ErrorDialog } from "../../ui/confirmDialog";
import { useProductStore } from "./products/productStore";
import { ProductCategoryChips } from "./products/productCategoryChips";
import { ProductCard, type ProductItem } from "./products/productCard";
import { ProductDetailPanel } from "./products/productDetailPanel";
import { CATEGORY_KEY, CATEGORY_LABEL, type ProductCategory } from "./products/productTypes";

const matchesQuery = (item: ProductItem, q: string): boolean =>
  JSON.stringify(item).toLowerCase().includes(q);

export const AdminProductsPage = ({ layoutMode }: { layoutMode: EffectiveLayout }) => {
  const { catalog, loading, error, reload, add, update, remove } = useProductStore();
  const [category, setCategory] = useState<ProductCategory>("panel");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = catalog[CATEGORY_KEY[category]] as ProductItem[];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter(item => matchesQuery(item, q)) : list;
  }, [list, query]);

  const selectedItem = list.find(i => i.id === selectedId) ?? null;

  const selectCategory = (c: ProductCategory) => {
    setCategory(c);
    setSelectedId(null);
    setEditingId(null);
    setIsAdding(false);
  };

  const selectItem = (id: string) => {
    setSelectedId(id);
    setEditingId(null);
    setIsAdding(false);
  };

  const startAdd = () => {
    setSelectedId(null);
    setEditingId(null);
    setIsAdding(true);
  };

  const cancelForm = () => {
    setEditingId(null);
    setIsAdding(false);
  };

  // The detail panel's draft is an untyped Record (it edits five very
  // differently-shaped entities); category ties it back to the matching
  // CatalogEntityMap member for add/update, which is the one place a cast is
  // needed at this generic-form/typed-store boundary.
  const handleSave = async (values: Record<string, unknown>) => {
    if (isAdding) {
      const { id, error } = await add(category, values as never);
      if (error) { setActionError(error); return; }
      setSelectedId(id);
      setIsAdding(false);
    } else if (editingId) {
      const error = await update(category, editingId, values as never);
      if (error) { setActionError(error); return; }
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const error = await remove(category, id);
    if (error) { setActionError(error); return; }
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  };

  if (loading) {
    return <LoadingState className="mt-6" label="Loading catalog" />;
  }

  if (error) {
    return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;
  }

  const gridBody = (
    <>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
        <Search size={16} className="shrink-0" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search this catalog..."
          className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
      </div>
      <div className="mt-3"><ProductCategoryChips active={category} onChange={selectCategory} /></div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <SectionLabel icon={<Search size={14} />}>{CATEGORY_LABEL[category]} ({filtered.length})</SectionLabel>
        <Button icon={<Plus size={13} />} onClick={startAdd}>Add</Button>
      </div>
      {filtered.length === 0 ? (
        <EmptyState className={`${cx.card} mt-3 text-center`} message="No items match your search." />
      ) : (
        <CardGrid layoutMode={layoutMode} minWidth={240}>
          {filtered.map(item => (
            <ProductCard key={item.id} category={category} item={item} selected={item.id === selectedId} onSelect={selectItem} onDelete={handleDelete} />
          ))}
        </CardGrid>
      )}
    </>
  );

  const detailPanel = (
    <ProductDetailPanel
      category={category}
      item={selectedItem}
      isAdding={isAdding}
      isEditing={!!editingId}
      onSave={handleSave}
      onCancel={cancelForm}
      onStartEdit={() => selectedItem && setEditingId(selectedItem.id)}
      onDelete={() => selectedItem && handleDelete(selectedItem.id)}
    />
  );

  const errorDialog = <ErrorDialog message={actionError} onDismiss={() => setActionError(null)} />;

  if (layoutMode === "phone") {
    return (
      <div className="mt-2">
        {errorDialog}
        {gridBody}
        <div className="mt-6">{detailPanel}</div>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-[1fr_380px] items-start gap-6">
      {errorDialog}
      <div className="min-w-0">{gridBody}</div>
      <aside className="sticky top-5">{detailPanel}</aside>
    </div>
  );
};
