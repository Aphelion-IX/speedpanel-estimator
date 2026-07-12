// =============================================================================
// Education Hub
// =============================================================================
// Self-contained document catalog/viewer page (no dependency on Wall or the
// compute engine). Catalog data now comes live from Supabase's admin_documents
// table via educationCatalogStore.ts -- the same table Admin > Documents
// edits -- rather than the static eduDocuments.json snapshot; types, the
// category taxonomy, and swatch resolution still live in catalog.ts. The
// pdfjs-dist lazy-loader is in pdfjsLoader.ts, and the filter/card/section/
// PDF-viewer/detail-panel pieces each in their own file -- this file is just
// the page component: search/category/selection state, filtering, and
// grid+detail composition.
// =============================================================================
import { useEffect, useState, useMemo } from "react";
import { Search, FileText } from "lucide-react";
import { cx, NAVY, MUTED } from "../styleTokens";
import type { EffectiveLayout } from "../useLayoutMode";
import { CardGrid, SectionLabel } from "../ui/primitives";
import { type EduCategory, type EduDocument } from "./catalog";
import { useEducationCatalog } from "./educationCatalogStore";
import { FilterChips } from "./FilterChips";
import { RecentlyViewedStrip } from "./RecentlyViewedStrip";
import { DocumentCard } from "./DocumentCard";
import { DocumentDetailPanel, type DetailTab } from "./DocumentDetailPanel";

// Matches metadata plus the document's full extracted PDF text (searchText,
// empty for mock entries with no PDF) -- see educationCatalogStore.ts.
const matchesQuery = (d: EduDocument, q: string): boolean =>
  [d.title, d.category, d.description, d.searchText ?? "", ...d.tags].some(f => f.toLowerCase().includes(q));

export const EducationHub = ({ layoutMode }: { layoutMode: EffectiveLayout }) => {
  const { documents, loading, error, reload } = useEducationCatalog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EduCategory>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [detailTab, setDetailTab] = useState<DetailTab>("scan");
  // Grid + a persistent detail panel (aside on web, stacked below on phone) is always the
  // default view -- expanded is purely an opt-in "make the viewer bigger" toggle, not a
  // separate mode the user has to enter/exit to see anything.
  const [expanded, setExpanded] = useState(false);

  // Seed the initial selection once documents arrive -- can't default
  // synchronously to documents[0].id like the old EDU_DOCUMENTS constant
  // allowed, since this is now an async Supabase fetch.
  useEffect(() => {
    if (!selectedId && documents.length > 0) setSelectedId(documents[0].id);
  }, [documents, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byCategory = (d: EduDocument) => category === "All" || d.category === category;
    return documents.filter(d => byCategory(d) && (!q || matchesQuery(d, q)));
  }, [documents, query, category]);

  const selectDoc = (id: string) => {
    setSelectedId(id);
    setRecentIds(prev => [id, ...prev.filter(x => x !== id)].slice(0, 6));
    setDetailTab("scan"); // every selection path lands on the Quick Scan view.
  };

  const openQuickScan = (id: string) => {
    selectDoc(id);
    setExpanded(true);
  };

  const selectedDoc = documents.find(d => d.id === selectedId) ?? documents[0] ?? null;

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
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search guides, tags, categories..."
          className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
      </div>
      <div className="mt-3"><FilterChips active={category} onChange={setCategory} /></div>
      <RecentlyViewedStrip ids={recentIds} docs={documents} onSelect={selectDoc} />
      <div className="mt-5"><SectionLabel icon={<FileText size={14} />}>All Documents ({filtered.length})</SectionLabel></div>
      {filtered.length === 0 ? (
        <div className={cx.card + " mt-3 text-center"}>
          <p className={cx.footnote}>No documents match your search.</p>
        </div>
      ) : (
        <CardGrid layoutMode={layoutMode} minWidth={280}>
          {filtered.map(d => (
            <DocumentCard key={d.id} doc={d} selected={d.id === selectedId} onSelect={selectDoc} onQuickScan={openQuickScan} />
          ))}
        </CardGrid>
      )}
    </>
  );

  // Null when the catalog has no documents at all (e.g. every row deleted in
  // Admin > Documents) -- DocumentDetailPanel requires a non-null doc, so the
  // wrapper below only renders it once a selection exists.
  const detailPanel = selectedDoc && (
    <DocumentDetailPanel
      doc={selectedDoc} allDocs={documents} tab={detailTab} onTabChange={setDetailTab} onSelectRelated={selectDoc}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)} layoutMode={layoutMode}
    />
  );

  // The wrapper around detailPanel keeps the same element/position across the expanded
  // toggle -- only its className changes -- so React preserves DocumentDetailPanel's (and
  // PdfViewer's) component state (current page, loaded PDF) instead of remounting it and
  // losing all of that whenever full screen is toggled on/off.
  const expandedClass = "fixed inset-0 z-50 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 md:p-8";

  if (layoutMode === "phone") {
    return (
      <div className="mt-2">
        {gridBody}
        {detailPanel && <div className={expanded ? expandedClass : "mt-6"}>{detailPanel}</div>}
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-[1fr_380px] items-start gap-6">
      <div className="min-w-0">{gridBody}</div>
      {detailPanel && <aside className={expanded ? expandedClass : "sticky top-5"}>{detailPanel}</aside>}
    </div>
  );
};
