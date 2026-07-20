// =============================================================================
// LoadingState / ErrorState / EmptyState
// =============================================================================
// Replaces the "Loading..." text block duplicated across ~34 files and the
// error-text paragraph duplicated across ~15 files with one shared,
// consistent component each.
// =============================================================================
import { AlertTriangle } from "lucide-react";
import { cx } from "../styleTokens";
import { SkeletonBar, SkeletonIcon } from "./skeleton";

// Renders as pulsing placeholder shapes (not the real label/hint text) so
// sighted users see a skeleton, while role="status"/aria-live and a visually-
// hidden text node keep the actual message announced to screen readers --
// the app had zero role="status" usage anywhere before this.
export const LoadingState = ({ label = "Loading", hint, className = "" }: {
  label?: string; hint?: string; className?: string;
}) => (
  <div role="status" aria-live="polite" className={`${cx.card} flex items-center gap-3.5 ${className}`}>
    <span aria-hidden="true" className="contents">
      <SkeletonIcon size={20} />
      <span className="min-w-0 flex-1">
        <SkeletonBar className="h-3.5 w-2/5" />
        {hint && <SkeletonBar className="mt-2 h-2.5 w-1/4" />}
      </span>
    </span>
    <span className="sr-only">{label}{hint ? ` -- ${hint}` : ""}</span>
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
