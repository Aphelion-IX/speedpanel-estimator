// =============================================================================
// Education Hub -- document card
// =============================================================================
// Touching anywhere on the card selects the document, updating the persistent
// detail column/panel (see EducationHub) -- the action buttons below route
// through the same callback (with stopPropagation so a button press doesn't
// double-fire the card's handler).
// =============================================================================
import { FileText, MoreVertical } from "lucide-react";
import { cx, BLUE, WHITE, NAVY, MUTED } from "../styleTokens";
import { eduBadgeCx, type EduDocument } from "./catalog";

export const DocumentCard = ({ doc, selected, onSelect, onQuickScan }: { doc: EduDocument; selected: boolean; onSelect: (id: string) => void; onQuickScan: (id: string) => void }) => (
  <div onClick={() => onSelect(doc.id)}
    className={cx.card + " flex cursor-pointer flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-md"}
    style={selected ? { borderColor: BLUE, borderWidth: 2 } : undefined}>
    <div className="h-24 rounded-lg grid place-items-center" style={{ background: `linear-gradient(135deg, ${doc.swatch}, color-mix(in srgb, ${doc.swatch} 100%, black 18%))` }}>
      <FileText size={28} color={WHITE} />
    </div>
    <div>
      <span className={eduBadgeCx}>{doc.category}</span>
      <div className="mt-2 text-sm font-bold" style={{ color: NAVY }}>{doc.title}</div>
      <p className="mt-1 text-sm leading-relaxed line-clamp-2" style={{ color: MUTED }}>{doc.description}</p>
    </div>
    <div className="flex flex-wrap gap-1.5">
      {doc.tags.map(t => (
        <span key={t} className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-semibold" style={{ color: MUTED }}>{t}</span>
      ))}
    </div>
    <div className={cx.footnote + " pt-0 flex flex-wrap items-center gap-x-1.5 text-xs"}>
      <span>{doc.edition}</span><span>·</span><span>{doc.date}</span><span>·</span><span>{doc.fileSize}</span>
    </div>
    <div className="mt-1 flex items-center gap-2">
      <button onClick={e => { e.stopPropagation(); onQuickScan(doc.id); }}
        className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2 text-xs font-bold active:scale-95 transition-all"
        style={{ color: BLUE }}>Quick Scan</button>
      {doc.fileUrl ? (
        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" onClick={e => { e.stopPropagation(); onSelect(doc.id); }}
          className="flex-1 rounded-xl py-2 text-center text-xs font-bold active:scale-95 transition-all"
          style={{ background: BLUE, color: WHITE }}>Open PDF</a>
      ) : (
        <button onClick={e => { e.stopPropagation(); onSelect(doc.id); }}
          className="flex-1 rounded-xl py-2 text-xs font-bold active:scale-95 transition-all"
          style={{ background: BLUE, color: WHITE }}>Open PDF</button>
      )}
      {/* No-op overflow button -- a real menu (rename/download/etc) is out of scope for v1. */}
      <button onClick={e => e.stopPropagation()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-400">
        <MoreVertical size={15} />
      </button>
    </div>
  </div>
);
