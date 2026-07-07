// =============================================================================
// Education Hub -- document sections list
// =============================================================================
import { NAVY, MUTED } from "../styleTokens";
import type { EduSection } from "./catalog";

export const SectionsList = ({ sections, onOpenSection }: { sections: EduSection[]; onOpenSection?: (pages: string) => void }) => (
  <div className="space-y-2.5">
    {sections.map((s, i) => {
      const cardCx = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-left"
        + (onOpenSection ? " active:scale-95 transition-all" : "");
      const body = (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold" style={{ color: NAVY }}>{s.name}</span>
            <span className="text-xs font-semibold shrink-0" style={{ color: MUTED }}>p.{s.pages}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }}>{s.description}</p>
        </>
      );
      // No onOpenSection (no-file doc) -- nothing to jump to, so it's a plain
      // card, not a dead button that looks pressable but does nothing.
      return onOpenSection
        ? <button key={i} onClick={() => onOpenSection(s.pages)} className={cardCx}>{body}</button>
        : <div key={i} className={cardCx}>{body}</div>;
    })}
  </div>
);
