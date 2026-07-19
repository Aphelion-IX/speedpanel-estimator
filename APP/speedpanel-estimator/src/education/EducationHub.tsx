// =============================================================================
// Education Hub
// =============================================================================
// Self-contained document catalog/viewer page (no dependency on Wall or the
// compute engine). Catalog data is bundled statically (see
// educationCatalogStore.ts's own header comment for why); types, the
// category taxonomy, and swatch resolution live in catalog.ts. The
// pdfjs-dist lazy-loader is in pdfjsLoader.ts, and the filter/card/section/
// PDF-viewer/detail-panel pieces each in their own file -- this file is just
// the page component: search/category/selection state, filtering, and
// grid+detail composition.
// =============================================================================
import { useEffect, useState, useMemo } from "react";
import { Search, FileText } from "lucide-react";
import { cx, NAVY, MUTED } from "../styleTokens";
import { LoadingState, ErrorState, EmptyState } from "../ui/states";
import type { EffectiveLayout } from "../useLayoutMode";
import { CardGrid, SectionLabel } from "../ui/primitives";
import { type EduCategory, type EduDocument } from "./catalog";
import { useEducationCatalog } from "./educationCatalogStore";
import { FilterChips } from "./FilterChips";
import { RecentlyViewedStrip } from "./RecentlyViewedStrip";
import { DocumentCard } from "./DocumentCard";
import { DocumentDetailPanel, type DetailTab } from "./DocumentDetailPanel";

const EducationHubHeader = ({ count }: { count: number }) => (
  <div>
    <h1 className={cx.h1}>Education Hub</h1>
    <p className="mt-1 text-sm" style={{ color: MUTED }}>
      Technical guides, installation manuals and reference documents for Speedpanel systems.
      {" "}&middot; {count} document{count !== 1 ? "s" : ""}
    </p>
  </div>
);

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

  // Seed the initial selection once documents are available. documents is
  // static now (see educationCatalogStore.ts), so this effect only ever
  // really fires once on mount -- kept as an effect (not computed inline)
  // so selecting a different doc later doesn't get stomped by this same
  // logic re-running.
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
    return <LoadingState className="mt-6" label="Loading education hub" />;
  }

  if (error) {
    return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;
  }

  const gridBody = (
    <>
      <label className="mt-4 flex h-11 items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all hover:border-blue-200 dark:hover:border-blue-700 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:shadow-[0_0_0_3.5px_rgba(0,103,185,0.15)] dark:focus-within:shadow-[0_0_0_3.5px_rgba(58,168,255,0.22)]">
        <Search size={16} className="shrink-0" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search guides, tags, categories..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" style={{ color: NAVY }} />
      </label>
      <div className="mt-3"><FilterChips active={category} onChange={setCategory} /></div>
      <RecentlyViewedStrip ids={recentIds} docs={documents} onSelect={selectDoc} />
      <div className="mt-5"><SectionLabel icon={<FileText size={14} />}>All Documents ({filtered.length})</SectionLabel></div>
      {filtered.length === 0 ? (
        <EmptyState className={`${cx.card} mt-3 text-center`} message="No documents match your search." />
      ) : (
        <CardGrid layoutMode={layoutMode} minWidth={280}>
          {filtered.map(d => (
            <DocumentCard key={d.id} doc={d} selected={d.id === selectedId} onSelect={selectDoc} onQuickScan={openQuickScan} />
          ))}
        </CardGrid>
      )}
    </>
  );

  // Null when the catalog has no documents at all (e.g. eduDocuments.json
  // edited down to an empty array) -- DocumentDetailPanel requires a
  // non-null doc, so the wrapper below only renders it once a selection
  // exists.
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
        {!expanded && <EducationHubHeader count={documents.length} />}
        {gridBody}
        {detailPanel && <div className={expanded ? expandedClass : "mt-6"}>{detailPanel}</div>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      {!expanded && <EducationHubHeader count={documents.length} />}
      <div className="grid grid-cols-[1fr_380px] items-start gap-6">
        <div className="min-w-0">{gridBody}</div>
        {detailPanel && <aside className={expanded ? expandedClass : "mt-4 sticky top-5"}>{detailPanel}</aside>}
      </div>
    </div>
  );
};
