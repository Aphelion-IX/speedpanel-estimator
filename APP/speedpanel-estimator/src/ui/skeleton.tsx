// =============================================================================
// Skeleton placeholder primitives
// =============================================================================
// Low-level pulsing-placeholder building blocks. Kept intentionally minimal --
// just what LoadingState (states.tsx) needs to swap its spinner+text for
// placeholder shapes. Every real loading container shape in the app already
// goes through LoadingState (full-page, route-level, list-page-with-header,
// card/section-embedded, sub-section-within-page), so there's no case yet for
// bespoke table-row/list-row skeleton variants -- add those if/when a real
// caller renders Table mid-loading.
// =============================================================================

export const SkeletonBar = ({ className = "" }: { className?: string }) => (
  <span className={`block animate-pulse rounded-full bg-slate-200 dark:bg-slate-700 ${className}`} />
);

export const SkeletonIcon = ({ size = 20 }: { size?: number }) => (
  <span
    className="block shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700"
    style={{ width: size, height: size }}
  />
);
