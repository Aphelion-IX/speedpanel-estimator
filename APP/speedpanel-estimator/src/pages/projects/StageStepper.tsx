// =============================================================================
// Stage stepper
// =============================================================================
// New presentational primitive -- no stepper/progress-bar component exists
// anywhere else in this codebase. A plain horizontal row of the four linear
// stages (draft -> install_review -> technical_review -> approved), with
// every stage up to and including the current one filled, later ones muted.
// Reused by both the customer's ProjectDashboard and the admin review queue.
// =============================================================================
import { cx, BLUE, WHITE, MUTED } from "../../styleTokens";
import { STAGES, STAGE_LABELS, type Stage } from "./projectTypes";

export const StageStepper = ({ stage }: { stage: Stage }) => {
  const currentIndex = STAGES.indexOf(stage);
  return (
    <div>
      <div className={cx.cardHd}>Project stage</div>
      <div className="flex items-center gap-1.5">
        {STAGES.map((s, i) => {
          const reached = i <= currentIndex;
          return (
            <div key={s} className="flex flex-1 items-center gap-1.5">
              <div className="flex-1 rounded-full py-1.5 text-center text-xs font-bold uppercase tracking-wide"
                style={reached ? { background: BLUE, color: WHITE } : { background: "transparent", color: MUTED, border: "1px solid currentColor" }}>
                {STAGE_LABELS[s]}
              </div>
              {i < STAGES.length - 1 && <div className="h-0.5 w-3 shrink-0" style={{ background: i < currentIndex ? BLUE : "#cbd5e1" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
