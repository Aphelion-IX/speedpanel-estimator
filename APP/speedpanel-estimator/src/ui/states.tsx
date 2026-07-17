// =============================================================================
// LoadingState / ErrorState / EmptyState
// =============================================================================
// Replaces the "Loading..." text block duplicated across ~34 files and the
// error-text paragraph duplicated across ~15 files with one shared,
// consistent component each.
// =============================================================================
import { Loader2, AlertTriangle } from "lucide-react";
import { cx } from "../styleTokens";

export const LoadingState = ({ label = "Loading", hint, className = "" }: {
  label?: string; hint?: string; className?: string;
}) => (
  <div className={`${cx.card} flex items-center gap-3.5 ${className}`}>
    <Loader2 size={20} className="shrink-0 animate-spin text-[color:var(--blue)]" />
    <div className="min-w-0">
      <p className="text-sm font-bold text-[color:var(--navy)]">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">{hint}</p>}
    </div>
  </div>
);

export const ErrorState = ({ message, onRetry, className = "" }: {
  message: string; onRetry?: () => void; className?: string;
}) => (
  <div className={`${cx.card} flex items-start gap-3.5 ${className}`}>
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300">
      <AlertTriangle size={16} />
    </span>
    <div className="min-w-0">
      <p className="text-sm font-bold text-red-600 dark:text-red-300">Something went wrong</p>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-300">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm font-bold text-[color:var(--blue)] hover:underline">
          Retry
        </button>
      )}
    </div>
  </div>
);

export const EmptyState = ({ message, className = "" }: { message: string; className?: string }) => (
  <p className={`${cx.footnote} ${className}`}>{message}</p>
);
