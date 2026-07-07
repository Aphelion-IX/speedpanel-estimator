// =============================================================================
// Coming soon panel
// =============================================================================
// Placeholder body shown for top-nav tabs that don't have real content yet
// (Projects -- see App.tsx).
// =============================================================================
import { BLUE, cx } from "../styleTokens";

export const ComingSoonPanel = ({ title }: { title: string }) => (
  <div className={cx.card + " mt-6 text-center"}>
    <p className="text-sm font-bold uppercase tracking-widest" style={{ color: BLUE }}>{title}</p>
    <p className={cx.footnote}>Coming soon.</p>
  </div>
);
