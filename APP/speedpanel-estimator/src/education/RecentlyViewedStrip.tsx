// =============================================================================
// Education Hub -- recently viewed strip
// =============================================================================
import { ChevronRight, Clock } from "lucide-react";
import { BLUE, NAVY, MUTED } from "../styleTokens";
import { SectionLabel } from "../ui/primitives";
import type { EduDocument } from "./catalog";

export const RecentlyViewedStrip = ({ ids, docs, onSelect }: { ids: string[]; docs: EduDocument[]; onSelect: (id: string) => void }) => {
  if (ids.length === 0) return null;
  const recentDocs = ids.map(id => docs.find(d => d.id === id)).filter((d): d is EduDocument => !!d);
  return (
    <div className="mt-5">
      <SectionLabel icon={<Clock size={14} />}>Recently Viewed</SectionLabel>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recentDocs.map(d => (
          <button key={d.id} onClick={() => onSelect(d.id)}
            className="shrink-0 w-56 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-3 text-left active:scale-95 transition-all">
            <div className="text-sm font-bold truncate" style={{ color: NAVY }}>{d.title}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs font-medium" style={{ color: MUTED }}>
              <span className="truncate">{d.category} · p.{d.pageCount}</span>
              <ChevronRight size={13} className="shrink-0" style={{ color: BLUE }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
