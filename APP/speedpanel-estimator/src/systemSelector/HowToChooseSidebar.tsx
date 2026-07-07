// =============================================================================
// System Selector -- "How to choose" sidebar
// =============================================================================
// Static, entirely presentational -- the 3-step guide card and the "Need
// help choosing?" contact card. No props: doesn't depend on any live
// estimator state.
// =============================================================================
import { ChevronRight, HelpCircle, Layers, Phone } from "lucide-react";
import { NAVY, BLUE, WHITE, MUTED, cx } from "../styleTokens";

export const HowToChooseSidebar = () => (
  <>
    <div className={cx.card}>
      <div className={cx.cardTitle}><Layers size={13} style={{ color: BLUE }} />Choose Your Wall System</div>
      <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
        Select the wall type that matches how Speedpanel will be installed in your project.
        You'll enter measurements after you make your selection.
      </p>
      <div className={cx.infoNote}><span>This selector does not calculate or recommend automatically. You're in control.</span></div>
      <div className="mt-4 space-y-3">
        {[
          { n: 1, title: "Choose Orientation", sub: "Horizontal or Vertical", current: true },
          { n: 2, title: "Select Wall Type", sub: "Pick the system that fits your project", current: false },
          { n: 3, title: "Enter Measurements", sub: "Complete the form to calculate your estimate", current: false },
        ].map(step => (
          <div key={step.n} className="flex items-start gap-3">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
              style={step.current ? { background: BLUE, color: WHITE } : { color: MUTED, border: "1px solid #cbd5e1" }}>
              {step.n}
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: step.current ? BLUE : NAVY }}>{step.title}</div>
              <div className="text-xs" style={{ color: MUTED }}>{step.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className={cx.card + " mt-3"}>
      <div className={cx.cardTitle}><HelpCircle size={13} style={{ color: BLUE }} />Need help choosing?</div>
      <p className="text-sm leading-relaxed" style={{ color: MUTED }}>View our quick guide to understand each system type.</p>
      {/* Inert stub -- no destination wired yet, see SystemSelector.tsx's file-level note. */}
      <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ color: BLUE }}>
        View Guide <ChevronRight size={14} />
      </button>
      <p className="mt-3 text-center text-xs" style={{ color: MUTED }}>Or contact Speedpanel</p>
      <a href="tel:+61391156666" className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ background: BLUE, color: WHITE }}>
        <Phone size={14} /> +61 3 9115 6666
      </a>
    </div>
  </>
);
