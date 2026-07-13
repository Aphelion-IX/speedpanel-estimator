// =============================================================================
// Project journey timeline -- the derived 8-step JourneyStage, web + phone
// =============================================================================
// Two genuinely different renderings, not "the same thing with overflow-x-
// auto" -- web reproduces the mockup's circular icon-dot + connecting-line
// style; phone reuses StageStepper.tsx's existing pill-row visual language
// (this app's already-approved phone-friendly pattern for a linear stage
// pipeline), wrapped onto two rows of 4 and extended to distinguish "done"
// (emerald) from "current" (blue) the way the web version's check-mark vs.
// ring already does. `stage` is always the DISPLAY-ONLY value from
// journeyStage.ts -- see that file's header comment for why this is never a
// persisted column.
// =============================================================================
import { Check, Package, Settings, ShieldCheck, Truck } from "lucide-react";
import { MUTED } from "../../styleTokens";
import type { EffectiveLayout } from "../../useLayoutMode";
import { JOURNEY_STAGES, JOURNEY_STAGE_LABELS, type JourneyStage } from "./journeyStage";

// Mirrors the mockup's own icon choice exactly: a per-stage icon for the
// upcoming/current dot, overridden by a plain checkmark once a step is done.
const STEP_ICON: Partial<Record<JourneyStage, typeof Settings>> = {
  manufacturing: Package,
  ready_for_delivery: Truck,
  completed: ShieldCheck,
};

export const ProjectJourneyTimeline = ({ stage, layoutMode }: { stage: JourneyStage; layoutMode: EffectiveLayout }) => {
  const activeIndex = JOURNEY_STAGES.indexOf(stage);
  return layoutMode === "phone" ? <PhoneJourneyTimeline activeIndex={activeIndex} /> : <WebJourneyTimeline activeIndex={activeIndex} />;
};

const WebJourneyTimeline = ({ activeIndex }: { activeIndex: number }) => (
  <div className="overflow-x-auto">
    <div className="relative grid min-w-[760px] grid-cols-8 gap-1 py-2">
      <div className="absolute left-[6%] right-[6%] top-7 h-0.5 bg-slate-200 dark:bg-slate-700" />
      <div className="absolute left-[6%] top-7 h-0.5 bg-emerald-400" style={{ width: `${Math.max(0, (activeIndex / (JOURNEY_STAGES.length - 1)) * 88)}%` }} />
      {JOURNEY_STAGES.map((s, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        const Icon = STEP_ICON[s] ?? Settings;
        return (
          <div key={s} className="relative z-10 text-center">
            <div className={[
              "mx-auto grid h-14 w-14 place-items-center rounded-full border-2 bg-white dark:bg-slate-800",
              done && "border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400",
              current && "border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-400 ring-4 ring-blue-100 dark:ring-blue-900/40",
              !done && !current && "border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500",
            ].filter(Boolean).join(" ")}>
              {done ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{JOURNEY_STAGE_LABELS[s]}</p>
            <p className={`mt-1 text-xs ${current ? "font-semibold text-blue-700 dark:text-blue-400" : done ? "text-emerald-600 dark:text-emerald-400" : ""}`} style={!current && !done ? { color: MUTED } : undefined}>
              {current ? "Current Stage" : done ? "Complete" : ""}
            </p>
          </div>
        );
      })}
    </div>
  </div>
);

const PhoneJourneyTimeline = ({ activeIndex }: { activeIndex: number }) => (
  <div className="flex flex-wrap gap-1.5">
    {JOURNEY_STAGES.map((s, i) => {
      const done = i < activeIndex;
      const current = i === activeIndex;
      return (
        <div key={s}
          className={[
            "flex min-w-[45%] flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 px-2.5 text-center text-[10px] font-bold uppercase tracking-wide",
            current ? "bg-blue-600 text-white" : done ? "bg-emerald-500 text-white" : "border border-slate-300 dark:border-slate-600",
          ].join(" ")}
          style={!current && !done ? { color: MUTED } : undefined}>
          {done && <Check className="h-3 w-3 shrink-0" />}
          <span className="truncate">{JOURNEY_STAGE_LABELS[s]}</span>
        </div>
      );
    })}
  </div>
);
