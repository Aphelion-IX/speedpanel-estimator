// =============================================================================
// System Selector -- "select a system" CTA placeholder
// =============================================================================
// Static, entirely presentational -- no props.
// =============================================================================
import { FileText } from "lucide-react";
import { NAVY, BLUE, MUTED, cx } from "../styleTokens";

export const SelectSystemPlaceholder = () => (
  <div className="mt-5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 p-6 flex items-center justify-between gap-6">
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "rgba(37,99,235,0.12)" }}>
        <FileText size={18} style={{ color: BLUE }} />
      </div>
      <div>
        <div className="text-sm font-bold" style={{ color: NAVY }}>Select a wall system to begin</div>
        <p className={cx.footnote + " pt-1"}>Choose one of the systems above to load the matching estimate form.</p>
      </div>
    </div>
    <svg className="hidden md:block shrink-0" width="140" height="80" viewBox="0 0 140 80" fill="none">
      <path d="M10 70 L10 30 L70 10 L130 30 L130 70 Z" stroke={MUTED} strokeWidth="1" opacity="0.35" />
      <path d="M10 30 L130 30" stroke={MUTED} strokeWidth="1" opacity="0.35" />
      <rect x="55" y="45" width="14" height="25" stroke={MUTED} strokeWidth="1" opacity="0.35" />
      <rect x="20" y="40" width="16" height="14" stroke={MUTED} strokeWidth="1" opacity="0.35" />
      <rect x="100" y="40" width="16" height="14" stroke={MUTED} strokeWidth="1" opacity="0.35" />
    </svg>
  </div>
);
