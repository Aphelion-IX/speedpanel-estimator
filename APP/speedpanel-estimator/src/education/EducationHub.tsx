// =============================================================================
// Education Hub
// =============================================================================
// Self-contained document catalog/viewer page (no dependency on Wall or the
// compute engine). Catalog data/search index lives in catalog.ts, the
// pdfjs-dist lazy-loader in pdfjsLoader.ts, and the filter/card/section/
// PDF-viewer/detail-panel pieces each in their own file -- this file is just
// the page component: search/category/selection state, filtering, and
// grid+detail composition.
// =============================================================================
import { useState, useMemo } from "react";
import { Search, FileText } from "lucide-react";
import { cx, NAVY, MUTED } from "../styleTokens";
import type { EffectiveLayout } from "../useLayoutMode";
import { CardGrid, SectionLabel } from "../ui/primitives";
import { EDU_DOCUMENTS, eduSearchIndex, type EduCategory, type EduDocument } from "./catalog";
import { FilterChips } from "./FilterChips";
import { RecentlyViewedStrip } from "./RecentlyViewedStrip";
import { DocumentCard } from "./DocumentCard";
import { DocumentDetailPanel, type DetailTab } from "./DocumentDetailPanel";

export const EducationHub = ({ layoutMode }: { layoutMode: EffectiveLayout }) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EduCategory>("All");
  const [selectedId, setSelectedId] = useState<string>(EDU_DOCUMENTS[0].id);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [detailTab, setDetailTab] = useState<DetailTab>("scan");
  // Grid + a persistent detail panel (aside on web, stacked below on phone) is always the
  // default view -- expanded is purely an opt-in "make the viewer bigger" toggle, not a
  // separate mode the user has to enter/exit to see anything.
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim();
    const byCategory = (d: EduDocument) => category === "All" || d.category === category;
    if (!q) return EDU_DOCUMENTS.filter(byCategory);
    // Full-text search (title/tags/category/description/extracted PDF text) via the
    // pre-built MiniSearch index -- see scripts/add-education-doc.mjs.
    const matchIds = new Set(eduSearchIndex.search(q, { prefix: true, fuzzy: 0.2, boost: { title: 3, tags: 2 } }).map(r => r.id));
    return EDU_DOCUMENTS.filter(d => byCategory(d) && matchIds.has(d.id));
  }, [query, category]);

  const selectDoc = (id: string) => {
    setSelectedId(id);
    setRecentIds(prev => [id, ...prev.filter(x => x !== id)].slice(0, 6));
    setDetailTab("scan"); // every selection path lands on the Quick Scan view.
  };

  const openQuickScan = (id: string) => {
    selectDoc(id);
    setExpanded(true);
  };

  const selectedDoc = EDU_DOCUMENTS.find(d => d.id === selectedId) ?? EDU_DOCUMENTS[0];

  const gridBody = (
    <>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
        <Search size={16} className="shrink-0" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search guides, tags, categories..."
          className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
      </div>
      <div className="mt-3"><FilterChips active={category} onChange={setCategory} /></div>
      <RecentlyViewedStrip ids={recentIds} docs={EDU_DOCUMENTS} onSelect={selectDoc} />
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

  const detailPanel = (
    <DocumentDetailPanel
      doc={selectedDoc} allDocs={EDU_DOCUMENTS} tab={detailTab} onTabChange={setDetailTab} onSelectRelated={selectDoc}
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
        <div className={expanded ? expandedClass : "mt-6"}>{detailPanel}</div>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-[1fr_380px] items-start gap-6">
      <div className="min-w-0">{gridBody}</div>
      <aside className={expanded ? expandedClass : "sticky top-5"}>{detailPanel}</aside>
    </div>
  );
};
