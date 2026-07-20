// =============================================================================
// Top navigation
// =============================================================================
// Wordmark + the app's top-level feature tabs, wired up to the hash router
// so their URLs are deep-linkable on GitHub Pages -- see App.tsx. `right`
// renders the notification bell/theme/layout/reset/account controls passed
// down from the root component, plus a hamburger menu that appears whenever
// the six tab labels don't actually fit next to the wordmark and `right`.
//
// This used to be a fixed Tailwind breakpoint (`hidden md:flex` / `md:hidden`,
// later bumped to `lg`), which just relocated the bug instead of fixing it:
// measuring the real rendered width shows the six full-text labels plus the
// icon/avatar cluster in `right` don't actually fit until nearly full desktop
// width (upwards of ~1400px in testing, well past both `md` 768px and `lg`
// 1024px) -- so any single fixed breakpoint either clips the row (the
// original bug: "System Selector" cut off mid-word at iPad width, with no
// scroll affordance) or leaves a wide dead zone that could still clip
// (confirmed happening as late as 1360px). `right`'s own width also isn't
// fixed (notification badge, company name, avatar name/role text), so a
// static breakpoint can never account for it correctly. Instead, measure
// whether the row actually fits and collapse to the hamburger only when it
// doesn't, at any width -- see useNavFit below.
//
// App.tsx wraps this in its own full-width header bar (background + the
// brand gradient line as its bottom border) -- this component itself just
// renders the row's contents, same as before.
// =============================================================================
import { useLayoutEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { BLUE, WHITE, NAVY } from "../styleTokens";
import { IconButton } from "../ui/primitives";

// "company" is intentionally not in TOP_NAV_ITEMS below -- Company Team/
// Activity/Create pages are reached via a header control near AuthStatus.tsx
// and entry-point callouts on ProjectsListPage.tsx, not a top-nav tab. "admin"
// isn't in the list either -- it's reached via the account dropdown's Admin
// shortcut (AuthStatus.tsx) instead of a top-nav tab. Same for "myRequests" --
// reached via the account dropdown's "My Requests" shortcut. All three are
// still part of this union purely so route.tab (which includes them)
// type-checks as an activeTab value -- they just never match any
// TOP_NAV_ITEMS key, so no button ever highlights for them.
export type TopNavTab = "home" | "order" | "estimator" | "selector" | "education" | "projects" | "admin" | "company" | "myRequests";

const TOP_NAV_ITEMS: { key: TopNavTab; label: string }[] = [
  { key: "home",      label: "Home" },
  { key: "order",     label: "Orders" },
  { key: "projects",  label: "Projects" },
  { key: "selector",  label: "System Selector" },
  { key: "estimator", label: "Project Estimator" },
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

// --- useNavFit ----------------------------------------------------------------
// Whether the inline tab row actually fits between the wordmark and `right`,
// remeasured on every resize of the row itself (covers both a window resize
// AND `right`'s own width changing, e.g. a longer company/avatar name --
// ResizeObserver on the row picks up both, since the row's allocated width
// shrinks/grows as its shrink-0 siblings do). `rowRef` holds the real,
// visible tab row (flex-1 min-w-0 overflow-hidden, so flexbox actually
// squeezes its allocated box down to whatever's left over); `measureRef`
// holds an unconstrained twin of the same buttons (see its own 0x0
// overflow-hidden wrapper below) purely so its intrinsic (natural,
// un-squeezed) width can be read via offsetWidth regardless of how little
// space the real row has been given -- comparing the two tells us whether
// the content is actually being clipped.
// The measuring twin has to stay permanently mounted (not conditionally
// rendered away once collapsed) or there'd be nothing left to remeasure the
// next time the window grows back wide enough to fit again.
function useNavFit() {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const row = rowRef.current, measure = measureRef.current;
    if (!row || !measure) return;
    const check = () => setFits(measure.offsetWidth <= row.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(row);
    ro.observe(measure);
    return () => ro.disconnect();
  }, []);

  return { rowRef, measureRef, fits };
}

export const TopNav = ({ activeTab, onTabChange, right }: { activeTab: TopNavTab; onTabChange: (t: TopNavTab) => void; right: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { rowRef, measureRef, fits } = useNavFit();

  const tabButtons = (onSelect: (item: TopNavTab) => void, className?: string) =>
    TOP_NAV_ITEMS.map(item => (
      <TopNavTabButton key={item.key} label={item.label} active={activeTab === item.key} onClick={() => onSelect(item.key)} className={className} />
    ));

  return (
    <div>
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        <div className="relative flex min-w-0 flex-1 items-center gap-0 sm:gap-4">
          <div className="shrink-0 leading-none">
            <div className="flex items-baseline whitespace-nowrap">
              <span className="text-sm font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-xl">my</span>
              <span className="text-sm font-black tracking-[-0.04em] sm:text-xl" style={{ color: BLUE }}>SPEEDPORTAL</span>
            </div>
          </div>
          <div ref={rowRef} className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
            {fits && tabButtons(onTabChange)}
          </div>
          {/* Unconstrained measuring twin, permanently mounted so there's
              always something to remeasure -- the 0x0 overflow-hidden
              wrapper takes it fully out of the page's paint/scroll area (a
              plain `absolute` element here, without this, would still
              contribute its full natural width -- up to ~700px for six
              labels -- to the page's scrollable area on a narrow viewport,
              producing an invisible horizontal scrollbar), while the inner
              div's own offsetWidth is still its true natural (un-squeezed)
              content width regardless of that clipping. */}
          <div className="absolute left-0 top-0 h-0 w-0 overflow-hidden" aria-hidden>
            {/* inline-flex, not flex -- a block-level flex container's
                `width: auto` fills its containing block's width (here, the
                0px-wide wrapper above), not its own content's natural width,
                which silently measured as offsetWidth 0 and made every fit
                check pass regardless of actual content width until this was
                caught by a live-width probe. inline-flex uses shrink-to-fit
                sizing instead, so offsetWidth reflects the six buttons' true
                natural width. */}
            <div ref={measureRef} className="inline-flex items-center gap-0.5 whitespace-nowrap">
              {tabButtons(() => {})}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 sm:gap-1.5">
          {right}
          {!fits && (
            <IconButton size="header" onClick={() => setMobileOpen(v => !v)}>
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </IconButton>
          )}
        </div>
      </div>
      {!fits && mobileOpen && (
        <div className="mt-3 flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 shadow-sm">
          {tabButtons(item => { onTabChange(item); setMobileOpen(false); }, "w-full text-left")}
        </div>
      )}
    </div>
  );
};
