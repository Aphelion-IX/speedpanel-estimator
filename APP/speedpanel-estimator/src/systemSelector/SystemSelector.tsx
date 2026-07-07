// =============================================================================
// System Selector
// =============================================================================
// Wall-type picker landing page for the "System Selector" top-nav tab -- the
// catalog of basic + application-specific wall systems, the option card, and
// the page component itself. Each card's "selected" highlight is derived
// read-only from live estimator state (system / activeWallSystem) passed down
// from the root component -- no local selection state, so it can never drift
// from what the estimator is actually configured with.
//
// NOTE: "Select System" and "View Guide" are intentionally inert stubs for now
// (no onClick wired) -- wiring them to actually switch system/orientation/
// wallSystem and jump to the System Estimator tab is a deliberate follow-up,
// not done here.
// =============================================================================
import { NAVY, MUTED, cx } from "../styleTokens";
import type { EffectiveLayout } from "../useLayoutMode";
import { CardGrid } from "../ui/primitives";
import type { WallSystemId } from "../App";
import { WALL_SYSTEM_OPTIONS, type WallSystemOption } from "./systemOptions";
import { WallSystemOptionCard } from "./WallSystemOptionCard";
import { HowToChooseSidebar } from "./HowToChooseSidebar";
import { SelectSystemPlaceholder } from "./SelectSystemPlaceholder";

// --- System Selector -------------------------------------------------------------
// Wall-type picker landing page for the "System Selector" top-nav tab. Each card's
// "selected" highlight is derived read-only from the live estimator state (system /
// active.wallSystem) passed down from SpeedpanelEstimator -- no local selection state,
// so it can never drift from what the estimator is actually configured with.
//
// NOTE: "Select System" and "View Guide" are intentionally inert stubs for now (no
// onClick wired) -- wiring them to actually switch system/orientation/wallSystem and
// jump to the System Estimator tab is a deliberate follow-up, not done here. When that
// lands: a naive switchSystem(option.system) alone is NOT enough, because active.orient
// is a separate per-wall field from `system` -- WallsCard's Standard/Corner/Shaft
// picker gates on active.orient === "horizontal", not sys.orient. The real wiring will
// need switchOrient(target.orient) (which already resets wallSystem/unlinks partners
// correctly) in addition to switchSystem, or selecting Corner/Shaft after a Vertical
// system would silently leave the wall vertical with no picker visible.
//
// The wall-system catalog lives in systemOptions.ts (pure data), the card renderer
// in WallSystemOptionCard.tsx, and the two static sidebar/placeholder blocks in
// HowToChooseSidebar.tsx / SelectSystemPlaceholder.tsx -- this file is just the page
// composition + selected-state logic.
export const SystemSelector = ({ layoutMode, system, activeWallSystem }: {
  layoutMode: EffectiveLayout; system: string; activeWallSystem: WallSystemId;
}) => {
  const isSelected = (option: WallSystemOption) =>
    option.system !== undefined && system === option.system &&
    (option.wallSystem === undefined || activeWallSystem === option.wallSystem);

  const sidebarNode = <HowToChooseSidebar />;

  const mainNode = (
    <>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>What type of wall are you estimating?</h1>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>Start by selecting how the panels will be installed.</p>
      </div>
      {/* Two clearly separated groups: the 4 core wall-type systems together in one
          card (no more horizontal/vertical split -- Single Wall and External Wall
          each work in either orientation), and the broader application catalog in
          its own card. */}
      <div className={cx.card + " mt-5"}>
        <div className={cx.cardHd}>Basic Systems</div>
        <CardGrid layoutMode={layoutMode} minWidth={260} stretch>
          {WALL_SYSTEM_OPTIONS.filter(o => o.group === "basic").map(o => (
            <WallSystemOptionCard key={o.id} option={o} selected={isSelected(o)} />
          ))}
        </CardGrid>
      </div>

      <div className={cx.card + " mt-5"}>
        <div className={cx.cardHd}>Application-Specific Systems</div>
        <CardGrid layoutMode={layoutMode} minWidth={260} stretch>
          {WALL_SYSTEM_OPTIONS.filter(o => o.group === "application").map(o => (
            <WallSystemOptionCard key={o.id} option={o} selected={isSelected(o)} />
          ))}
        </CardGrid>
      </div>
      <SelectSystemPlaceholder />
    </>
  );

  return layoutMode === "web"
    ? (
      <div className="mt-6 grid grid-cols-[340px_1fr] items-start gap-6">
        <aside className="sticky top-5">{sidebarNode}</aside>
        <div className="min-w-0">{mainNode}</div>
      </div>
    )
    : <div className="mt-6">{mainNode}{sidebarNode}</div>;
};
