// =============================================================================
// Step tracker -- shared linear-pipeline visual (web dot+connector / phone
// pill row), used for BOTH the order-driven journey timeline and the
// project.stage design-review stepper
// =============================================================================
// Extracted from ProjectJourneyTimeline.tsx's original web/phone rendering so
// the two trackers shown together on ProjectDetailPage.tsx ("Order Progress"
// and "Design Review") can't visually drift apart from each other -- one
// source of the dot/connector shape and the emerald(done)/blue(current)/
// slate(upcoming) + dark-mode color system, reused instead of copy-pasted.
// Purely presentational: given `steps` and which index is active, renders:
// done steps get a checkmark, the active step gets its own icon (or a
// generic fallback) plus a ring, later steps stay muted. No stage-specific
// knowledge lives here -- callers (ProjectJourneyTimeline.tsx,
// StageStepper.tsx) map their own stage enum into `steps` first.
// =============================================================================
import { Check, Settings } from "lucide-react";
import { MUTED } from "../../styleTokens";
import type { EffectiveLayout } from "../../useLayoutMode";

export interface TrackerStep {
  label: string;
  icon?: React.ElementType;
}

export const StepTracker = ({ steps, activeIndex, layoutMode }: {
  steps: TrackerStep[]; activeIndex: number; layoutMode: EffectiveLayout;
}) => (
  layoutMode === "phone" ? <PhoneStepTracker steps={steps} activeIndex={activeIndex} /> : <WebStepTracker steps={steps} activeIndex={activeIndex} />
);

const WebStepTracker = ({ steps, activeIndex }: { steps: TrackerStep[]; activeIndex: number }) => (
  <div className="overflow-x-auto">
    <div className="relative grid gap-1 py-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, minWidth: `${steps.length * 95}px` }}>
      <div className="absolute left-[6%] right-[6%] top-7 h-0.5 bg-slate-200 dark:bg-slate-700" />
      <div className="absolute left-[6%] top-7 h-0.5 bg-emerald-400" style={{ width: `${Math.max(0, (activeIndex / (steps.length - 1)) * 88)}%` }} />
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        const Icon = s.icon ?? Settings;
        return (
          <div key={s.label} className="relative z-10 text-center">
            <div className={[
              "mx-auto grid h-14 w-14 place-items-center rounded-full border-2 bg-white dark:bg-slate-800",
              done && "border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-300",
              current && "border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 ring-4 ring-blue-100 dark:ring-blue-900/40",
              !done && !current && "border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-400",
            ].filter(Boolean).join(" ")}>
              {done ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{s.label}</p>
            <p className={`mt-1 text-xs ${current ? "font-semibold text-blue-700 dark:text-blue-300" : done ? "text-emerald-600 dark:text-emerald-300" : ""}`} style={!current && !done ? { color: MUTED } : undefined}>
              {current ? "Current Stage" : done ? "Complete" : ""}
            </p>
          </div>
        );
      })}
    </div>
  </div>
);

const PhoneStepTracker = ({ steps, activeIndex }: { steps: TrackerStep[]; activeIndex: number }) => (
  <div className="flex flex-wrap gap-1.5">
    {steps.map((s, i) => {
      const done = i < activeIndex;
      const current = i === activeIndex;
      return (
        <div key={s.label}
          className={[
            "flex min-w-[45%] flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 px-2.5 text-center text-[10px] font-bold uppercase tracking-wide",
            current ? "bg-blue-600 text-white" : done ? "bg-emerald-500 text-white" : "border border-slate-300 dark:border-slate-600",
          ].join(" ")}
          style={!current && !done ? { color: MUTED } : undefined}>
          {done && <Check className="h-3 w-3 shrink-0" />}
          <span className="truncate">{s.label}</span>
        </div>
      );
    })}
  </div>
);
