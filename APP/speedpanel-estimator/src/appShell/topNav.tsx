// =============================================================================
// Top navigation
// =============================================================================
// Wordmark + the app's top-level feature tabs, wired up to the hash router
// so their URLs are deep-linkable on GitHub Pages -- see App.tsx. `right`
// renders the notification bell/theme/layout/reset/account controls passed
// down from the root component, plus a hamburger menu that only appears
// below the sm breakpoint. App.tsx wraps this in its own full-width header
// bar (background + the brand gradient line as its bottom border) -- this
// component itself just renders the row's contents, same as before.
// =============================================================================
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BLUE, WHITE, NAVY } from "../styleTokens";
import { IconButton } from "../ui/primitives";

// "company" is intentionally not in TOP_NAV_ITEMS below -- Company Team/
// Activity/Create pages are reached via a header control near AuthStatus.tsx
// and entry-point callouts on ProjectsListPage.tsx, not a top-nav tab. "admin"
// isn't in the list either -- it's reached via the account dropdown's Admin
// shortcut (AuthStatus.tsx) instead of a top-nav tab. Both are still part of
// this union purely so route.tab (which includes them) type-checks as an
// activeTab value -- they just never match any TOP_NAV_ITEMS key, so no
// button ever highlights for them.
export type TopNavTab = "home" | "estimator" | "selector" | "education" | "projects" | "admin" | "company";

const TOP_NAV_ITEMS: { key: TopNavTab; label: string }[] = [
  { key: "home",      label: "Home" },
  { key: "projects",  label: "Projects" },
  { key: "selector",  label: "System Selector" },
  { key: "estimator", label: "System Estimator" },
  { key: "education", label: "Education Hub" },
];

// Inactive labels use NAVY (the app's primary text colour, same token used
// for headings elsewhere) rather than a pale slate shade -- darker/more
// legible than the previous text-slate-400. Uppercase + tracking-wide
// matches the cx.lbl/cardHd convention already used for section headings.
const TopNavTabButton = ({ label, active, onClick, className = "" }: { label: string; active: boolean; onClick: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`rounded-xl px-2.5 py-2 text-sm font-bold uppercase tracking-wide whitespace-nowrap transition-all ${active ? "" : "hover:bg-slate-100 dark:hover:bg-slate-800"} ${className}`}
    style={active ? { background: BLUE, color: WHITE } : { color: NAVY }}
  >
    {label}
  </button>
);

export const TopNav = ({ activeTab, onTabChange, right }: { activeTab: TopNavTab; onTabChange: (t: TopNavTab) => void; right: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-4">
          <div className="shrink-0 leading-none">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">SPEED</span>
              <span className="text-xl font-black tracking-[-0.04em]" style={{ color: BLUE }}>HUB</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-0.5 overflow-x-auto">
            {TOP_NAV_ITEMS.map(item => (
              <TopNavTabButton key={item.key} label={item.label} active={activeTab === item.key} onClick={() => onTabChange(item.key)} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {right}
          <IconButton onClick={() => setMobileOpen(v => !v)} className="md:hidden">
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </IconButton>
        </div>
      </div>
      {mobileOpen && (
        <div className="mt-3 flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm md:hidden">
          {TOP_NAV_ITEMS.map(item => (
            <TopNavTabButton
              key={item.key} label={item.label} active={activeTab === item.key}
              className="w-full text-left"
              onClick={() => { onTabChange(item.key); setMobileOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
