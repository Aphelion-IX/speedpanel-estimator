// =============================================================================
// Placeholder page
// =============================================================================
// Shared shell for the not-yet-built admin/projects routes -- title, short
// description, and a "Test environment" status badge. Swapped out for real
// content page-by-page as each area is built in a later phase.
// =============================================================================
import { cx, tone } from "../styleTokens";

export const PlaceholderPage = ({ title, description, children }: {
  title: string; description: string; children?: React.ReactNode;
}) => (
  <div className={cx.card + " mt-6"}>
    <h1 className={cx.h1}>{title}</h1>
    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-300">{description}</p>
    <span className={`${cx.badge} mt-4 inline-block ${tone("warn")}`}>
      Status: Test environment
    </span>
    {children && <div className="mt-5">{children}</div>}
  </div>
);
