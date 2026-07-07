// =============================================================================
// System Selector -- option card
// =============================================================================
import { Check } from "lucide-react";
import { NAVY, BLUE, WHITE, MUTED, cx } from "../styleTokens";
import type { WallSystemOption } from "./systemOptions";

export const WallSystemOptionCard = ({ option, selected }: { option: WallSystemOption; selected: boolean }) => {
  const Icon = option.icon;
  return (
    <div className={cx.card + " h-full flex flex-col gap-3"} style={selected ? { borderColor: BLUE, borderWidth: 2 } : undefined}>
      <div className="relative">
        <div className="h-20 rounded-lg grid place-items-center border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <Icon size={28} style={{ color: BLUE }} />
        </div>
        {selected && (
          <div className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full shadow-sm" style={{ background: BLUE }}>
            <Check size={14} color={WHITE} strokeWidth={3} />
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-bold" style={{ color: NAVY }}>{option.title}</div>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }}>{option.description}</p>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
        <p className={cx.footnote + " pt-0"}>{option.note}</p>
      </div>
      {/* mt-auto pins the CTA to the bottom regardless of how tall the title/
          description/note above it are -- keeps every card's button aligned
          on the same row once the grid stretches all cards to equal height. */}
      {selected ? (
        <div className="mt-auto flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
          <Check size={14} /> Selected
        </div>
      ) : (
        // Inert stub for this pass -- no onClick wired yet (see SystemSelector.tsx's file-level note).
        <button className="mt-auto w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ color: BLUE }}>
          Select System
        </button>
      )}
    </div>
  );
};
