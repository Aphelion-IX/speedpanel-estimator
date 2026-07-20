// =============================================================================
// System rows
// =============================================================================
// A full-weight Orientation row for the active wall. Instantiated once by
// the root component and passed down as `systemSelector` into Calculator.
//
// Used to also carry a second "Wall type" row (Internal/External), switching
// which of ExternalCalculator/InternalCalculator rendered for the whole
// project. That project-level split is gone now that each wall picks its
// own application (see wallDomain.ts's Wall.application) -- the equivalent
// choice lives in firstWallSetup.tsx's "1. Wall type" step for a project's
// first wall instead (see docs/unified-estimator-merge-plan.md's Phase 4
// scope note for why this doesn't yet add a way to change an existing
// wall's application afterward).
// =============================================================================
import { BLUE, WHITE, cx, selectedFill, selectableOffCx } from "../styleTokens";

export const SystemRows = ({ orient, switchOrient }: {
  orient: "vertical" | "horizontal"; switchOrient: (o: "vertical" | "horizontal") => void;
}) => {
  const isHoriz = orient === "horizontal";
  return (
    <div className="space-y-3">
      <div>
        <div className={cx.cardHd}>Orientation</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => switchOrient("vertical")}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (!isHoriz ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
            style={!isHoriz ? selectedFill : undefined}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 1.5v10M6.5 1.5v10M10 1.5v10" stroke={!isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: !isHoriz ? WHITE : BLUE }}>Vertical</span>
          </button>
          <button onClick={() => switchOrient("horizontal")}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (isHoriz ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
            style={isHoriz ? selectedFill : undefined}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1.5 3h10M1.5 6.5h10M1.5 10h10" stroke={isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isHoriz ? WHITE : BLUE }}>Horizontal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
