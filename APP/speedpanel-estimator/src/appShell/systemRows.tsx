// =============================================================================
// System rows
// =============================================================================
// Two full-weight rows, each with its own small label, so Orientation and
// Wall type read as two distinct, equally important decisions -- not one
// primary control with a smaller secondary one attached to it. Instantiated
// once by the root component and passed down as `systemSelector` into
// whichever of ExternalCalculator/InternalCalculator renders.
// =============================================================================
import { BLUE, WHITE, cx } from "../styleTokens";

export const SystemRows = ({ orient, switchOrient, isExt, switchSystem, findSys }: {
  orient: "vertical" | "horizontal"; switchOrient: (o: "vertical" | "horizontal") => void;
  isExt: boolean; switchSystem: (id: string) => void;
  findSys: (orientVal: "vertical" | "horizontal", ext: boolean) => { id: string };
}) => {
  const isHoriz = orient === "horizontal";
  return (
    <div className="space-y-3">
      <div>
        <div className={cx.cardHd}>Orientation</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => switchOrient("vertical")}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (!isHoriz ? "" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800")}
            style={!isHoriz ? { borderColor: BLUE, background: BLUE } : undefined}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 1.5v10M6.5 1.5v10M10 1.5v10" stroke={!isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: !isHoriz ? WHITE : BLUE }}>Vertical</span>
          </button>
          <button onClick={() => switchOrient("horizontal")}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (isHoriz ? "" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800")}
            style={isHoriz ? { borderColor: BLUE, background: BLUE } : undefined}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1.5 3h10M1.5 6.5h10M1.5 10h10" stroke={isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isHoriz ? WHITE : BLUE }}>Horizontal</span>
          </button>
        </div>
      </div>
      <div>
        <div className={cx.cardHd}>Wall type</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => switchSystem(findSys(orient, false).id)}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all " + (!isExt ? "" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800")}
            style={!isExt ? { borderColor: BLUE, background: BLUE } : undefined}>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: !isExt ? WHITE : BLUE }}>Internal</span>
          </button>
          <button onClick={() => switchSystem(findSys(orient, true).id)}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all " + (isExt ? "" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800")}
            style={isExt ? { borderColor: BLUE, background: BLUE } : undefined}>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isExt ? WHITE : BLUE }}>External</span>
          </button>
        </div>
      </div>
    </div>
  );
};
