// =============================================================================
// Education Hub -- document detail panel
// =============================================================================
import { useState, useEffect } from "react";
import { FileText, Maximize2, Minimize2, MoreVertical, Share2 } from "lucide-react";
import { cx, BLUE, WHITE, NAVY, MUTED } from "../styleTokens";
import type { EffectiveLayout } from "../useLayoutMode";
import { Row } from "../ui/primitives";
import { eduBadgeCx, type EduDocument } from "./catalog";
import { PdfViewer } from "./PdfViewer";
import { SectionsList } from "./SectionsList";

export type DetailTab = "scan" | "details" | "related";
export const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "scan", label: "Quick Scan" }, { key: "details", label: "Details" }, { key: "related", label: "Related" },
];

// Parses the leading page number out of a section's "pages" string ("8-15" -> 8, "37" -> 37) for
// jumping the PDF viewer there.
export const firstPage = (pages: string): number => parseInt(pages, 10) || 1;

export const DocumentDetailPanel = ({ doc, allDocs, tab, onTabChange, onSelectRelated, expanded, onToggleExpand, layoutMode }: {
  doc: EduDocument; allDocs: EduDocument[]; tab: DetailTab; onTabChange: (t: DetailTab) => void;
  onSelectRelated: (id: string) => void;
  expanded: boolean; onToggleExpand: () => void; layoutMode: EffectiveLayout;
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => setCurrentPage(1), [doc.id]);
  const related = allDocs.filter(d => d.id !== doc.id && d.category === doc.category).slice(0, 4);
  // Maximised on desktop gets room for a side-by-side layout; maximised on phone (or
  // not maximised at all) keeps the PDF viewer and contents stacked in one column.
  const sideBySide = expanded && layoutMode === "web";
  // While side-by-side, the doc info/actions/tabs move into the sticky contents column
  // next to "Sections in this guide" instead of sitting above the two-column grid -- but
  // only for the Quick Scan tab, which is the only one that renders that grid; Details/
  // Related still render single-column with the header on top, same as non-maximised.
  const headerInSidebar = sideBySide && tab === "scan" && !!doc.fileUrl;

  const header = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Document viewer</span>
        <button onClick={onToggleExpand} title={expanded ? "Exit full screen" : "Full screen"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-400">
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
      <div className="h-32 rounded-lg grid place-items-center" style={{ background: doc.swatch }}>
        <FileText size={32} color={WHITE} />
      </div>
      <div className="mt-3 text-base font-bold" style={{ color: NAVY }}>{doc.title}</div>
      <span className={eduBadgeCx + " mt-1.5 inline-block"}>{doc.category}</span>
      <div className="mt-3 space-y-1">
        <Row k="Edition" v={doc.edition} dim />
        <Row k="Date" v={doc.date} dim />
        <Row k="File" v={`${doc.fileType} · ${doc.fileSize}`} dim />
      </div>
      <div className="mt-3 flex items-center gap-2">
        {doc.fileUrl ? (
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 rounded-xl py-2.5 text-center text-sm font-bold" style={{ background: BLUE, color: WHITE }}>Open PDF</a>
        ) : (
          <button className="flex-1 rounded-xl py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>Open PDF</button>
        )}
        <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-400"><Share2 size={15} /></button>
        <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-400"><MoreVertical size={15} /></button>
      </div>
    </>
  );

  const tabsNav = (
    <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-slate-200 dark:border-slate-600 p-1">
      {DETAIL_TABS.map(t => (
        <button key={t.key} onClick={() => onTabChange(t.key)}
          className={"rounded-lg py-2 text-xs font-bold transition-all " + (tab === t.key ? "" : "text-slate-400 dark:text-slate-400")}
          style={tab === t.key ? { background: BLUE, color: WHITE } : undefined}>
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={cx.card}>
      {!headerInSidebar && (
        <>
          {header}
          {tabsNav}
        </>
      )}
      <div className={headerInSidebar ? "" : "mt-4"}>
        {tab === "scan" && (
          doc.fileUrl ? (
            sideBySide ? (
              <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
                <PdfViewer key={doc.id} url={doc.fileUrl} page={currentPage} onPageChange={setCurrentPage} tall={expanded} />
                <div className="sticky top-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {header}
                  {tabsNav}
                  <div className={cx.cardHd + " mt-4"}>Sections in this guide</div>
                  <SectionsList sections={doc.sections} onOpenSection={pages => setCurrentPage(firstPage(pages))} />
                </div>
              </div>
            ) : (
              <>
                <PdfViewer key={doc.id} url={doc.fileUrl} page={currentPage} onPageChange={setCurrentPage} tall={expanded} />
                <div className={cx.cardHd + " mt-4"}>Sections in this guide</div>
                <SectionsList sections={doc.sections} onOpenSection={pages => setCurrentPage(firstPage(pages))} />
              </>
            )
          ) : (
            <>
              <div className={cx.cardHd}>About this guide</div>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{doc.description}</p>
              <div className={cx.cardHd + " mt-4"}>Sections in this guide</div>
              <SectionsList sections={doc.sections} />
            </>
          )
        )}
        {tab === "details" && (
          <div className="space-y-1">
            <Row k="Pages" v={doc.pageCount} dim />
            <Row k="Tags" v={doc.tags.join(", ")} dim />
            <Row k="Category" v={doc.category} dim />
          </div>
        )}
        {tab === "related" && (
          related.length === 0
            ? <p className={cx.footnote}>No related documents in this category.</p>
            : <div className="space-y-2">
                {related.map(d => (
                  <button key={d.id} onClick={() => onSelectRelated(d.id)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 px-3.5 py-2.5 text-left text-sm font-semibold" style={{ color: NAVY }}>
                    {d.title}
                  </button>
                ))}
              </div>
        )}
      </div>
    </div>
  );
};
