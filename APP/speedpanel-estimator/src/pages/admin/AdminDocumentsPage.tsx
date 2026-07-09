// =============================================================================
// Admin > Documents -- catalog CRUD page
// =============================================================================
// Master/detail page for staging Education Hub document metadata, persisted to
// localStorage via useDocumentStore -- fully decoupled from src/education/ and
// the live Education Hub (see documentStore.ts/seedFromEducation.ts).
// Composition mirrors AdminProductsPage.tsx (itself modeled on EducationHub.tsx):
// gridBody (search + category chips + card grid) and a persistent detailPanel,
// stacked on phone / a sticky aside on web. Category filter chips are reused
// directly from src/education/FilterChips.tsx rather than duplicated, since
// this catalog uses the same EduCategory taxonomy.
// =============================================================================
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { BLUE, WHITE, cx, NAVY, MUTED } from "../../styleTokens";
import type { EffectiveLayout } from "../../useLayoutMode";
import { CardGrid, SectionLabel } from "../../ui/primitives";
import { FilterChips } from "../../education/FilterChips";
import type { EduCategory } from "../../education/catalog";
import { useDocumentStore } from "./documents/documentStore";
import { DocumentAdminCard } from "./documents/documentCard";
import { DocumentAdminDetailPanel } from "./documents/documentDetailPanel";
import type { AdminDocument } from "./documents/documentTypes";

const matchesQuery = (item: AdminDocument, q: string): boolean =>
  JSON.stringify(item).toLowerCase().includes(q);

export const AdminDocumentsPage = ({ layoutMode }: { layoutMode: EffectiveLayout }) => {
  const { documents, loading, error, reload, add, update, remove } = useDocumentStore();
  const [category, setCategory] = useState<EduCategory>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter(d => (category === "All" || d.category === category) && (!q || matchesQuery(d, q)));
  }, [documents, category, query]);

  const selectedItem = documents.find(d => d.id === selectedId) ?? null;

  const selectCategory = (c: EduCategory) => {
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

  // The detail panel's draft is an untyped Record -- see DocumentAdminDetailPanel.
  const handleSave = async (values: Record<string, unknown>) => {
    if (isAdding) {
      const { id, error } = await add(values as never);
      if (error) { window.alert(error); return; }
      setSelectedId(id);
      setIsAdding(false);
    } else if (editingId) {
      const error = await update(editingId, values as never);
      if (error) { window.alert(error); return; }
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const error = await remove(id);
    if (error) { window.alert(error); return; }
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  };

  if (loading) {
    return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;
  }

  if (error) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
  }

  const gridBody = (
    <>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
        <Search size={16} className="shrink-0" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search documents..."
          className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
      </div>
      <div className="mt-3"><FilterChips active={category} onChange={selectCategory} /></div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <SectionLabel icon={<Search size={14} />}>Documents ({filtered.length})</SectionLabel>
        <button onClick={startAdd} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: BLUE, color: WHITE }}>
          <Plus size={13} /> Add
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className={cx.card + " mt-3 text-center"}>
          <p className={cx.footnote}>No documents match your search.</p>
        </div>
      ) : (
        <CardGrid layoutMode={layoutMode} minWidth={240}>
          {filtered.map(item => (
            <DocumentAdminCard key={item.id} item={item} selected={item.id === selectedId} onSelect={selectItem} onDelete={handleDelete} />
          ))}
        </CardGrid>
      )}
    </>
  );

  const detailPanel = (
    <DocumentAdminDetailPanel
      item={selectedItem}
      isAdding={isAdding}
      isEditing={!!editingId}
      onSave={handleSave}
      onCancel={cancelForm}
      onStartEdit={() => selectedItem && setEditingId(selectedItem.id)}
      onDelete={() => selectedItem && handleDelete(selectedItem.id)}
    />
  );

  if (layoutMode === "phone") {
    return (
      <div className="mt-2">
        {gridBody}
        <div className="mt-6">{detailPanel}</div>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-[1fr_380px] items-start gap-6">
      <div className="min-w-0">{gridBody}</div>
      <aside className="sticky top-5">{detailPanel}</aside>
    </div>
  );
};
