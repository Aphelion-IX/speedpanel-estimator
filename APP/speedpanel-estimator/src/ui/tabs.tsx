// =============================================================================
// Tabs
// =============================================================================
// Click-to-switch pill tab bar + panel-visibility helper -- for the future
// Estimate Results card (Overview / Selected Wall / Connections / Order).
// Visually modeled on SectionNav's pill styling (src/ui/primitives.tsx) but
// deliberately simpler: plain controlled active-id switching, no
// IntersectionObserver scroll-spy (that's SectionNav's job for long stacked
// pages, not this card's internal tab switching).
// =============================================================================
import { cx } from "../styleTokens";

export interface TabItem {
  id: string;
  label: string;
}

export const Tabs = ({ tabs, activeId, onChange }: {
  tabs: TabItem[]; activeId: string; onChange: (id: string) => void;
}) => (
  <div className={cx.tabList}>
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} className={t.id === activeId ? cx.tabActive : cx.tabInactive}>
        {t.label}
      </button>
    ))}
  </div>
);

// Mirrors CollapsibleSection's open-gated-children convention: renders its
// children only while `id` matches the active tab, so callers can lay out
// every panel's JSX unconditionally and let TabPanel gate visibility.
export const TabPanel = ({ id, activeId, children }: {
  id: string; activeId: string; children: React.ReactNode;
}) => (id === activeId ? <div className="mt-4">{children}</div> : null);
