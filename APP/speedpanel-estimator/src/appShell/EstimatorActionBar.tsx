// =============================================================================
// Estimator action bar
// =============================================================================
// Persistent bottom action bar for the Estimator tab (both layouts, not just
// phone -- promoted from the old mobile-only pattern) -- Export to Excel
// (wired to the active calculator's own already-computed export state) plus
// two visually-disabled placeholders for features that don't exist yet
// (Generate order schedule / Submit for review), signposting only, no
// handler. Rendered directly by each calculator (Internal/External already
// compute hasExportData/handleExport for their own LockedDataFooter, so this
// just reuses that instead of lifting export state up into App.tsx). The
// existing Save Draft / Save as Project / open-project Save flow stays
// exactly where it is today (App.tsx's top banners) -- not duplicated here.
// =============================================================================
import { Download, FileSpreadsheet, Send } from "lucide-react";
import { BLUE, WHITE } from "../styleTokens";

export const EstimatorActionBar = ({ disabled, onExport }: { disabled: boolean; onExport: () => void }) => (
  <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2.5 shadow-[0_-18px_48px_-30px_rgba(15,23,42,0.35)]">
    <div className="mx-auto flex w-full max-w-[1520px] items-center justify-end gap-2">
      <button disabled title="Coming soon"
        className="hidden items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-300 dark:text-slate-600 cursor-not-allowed sm:inline-flex">
        <FileSpreadsheet size={14} /> Generate order schedule
      </button>
      <button disabled title="Coming soon"
        className="hidden items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-300 dark:text-slate-600 cursor-not-allowed sm:inline-flex">
        <Send size={14} /> Submit for review
      </button>
      <button onClick={onExport} disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: BLUE, color: WHITE }}>
        <Download size={14} /> Export to Excel
      </button>
    </div>
  </div>
);
