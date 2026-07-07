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
import {
  Check, ChevronRight, FileText, HelpCircle, Layers, Phone,
  RectangleHorizontal, CornerDownRight, Building2, Shield, RectangleVertical,
  CloudRain, Warehouse, Clapperboard, DoorOpen, Building, SquareParking, Wrench, LayoutPanelLeft,
} from "lucide-react";
import { NAVY, BLUE, WHITE, MUTED, cx } from "../styleTokens";
import type { EffectiveLayout } from "../useLayoutMode";
import { CardGrid } from "../ui/primitives";
import type { WallSystemId } from "../App";

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
export type WallSystemOptionId =
  | "single" | "corner" | "shaft" | "ext-horiz"
  | "external-app" | "separation" | "cinema" | "shaft-app" | "stair" | "intertenancy"
  | "car-park" | "plant-room" | "facade" | "scissor-horiz" | "scissor-vert";

export interface WallSystemOption {
  id: WallSystemOptionId;
  group: "basic" | "application";
  title: string;
  description: string;
  note: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  // One of SYSTEMS[].id -- for future wiring + selected-state matching. Left undefined
  // for application cards that don't correspond to one single engineering configuration
  // (e.g. Separation/Cinema/Car Park walls can be built either horizontal or vertical
  // per the product literature) -- those cards never show as "selected" and are
  // descriptive-only until a real mapping is decided.
  system?: string;
  wallSystem?: WallSystemId;  // only set for the horizontal-Internal cards
}

export const WALL_SYSTEM_OPTIONS: WallSystemOption[] = [
  { id: "single", group: "basic", title: "Single Wall",
    description: "Straight wall section — horizontal or vertical panel installation.",
    note: "Use this when estimating one continuous wall run, in either orientation.",
    icon: RectangleHorizontal, system: "int-horiz", wallSystem: "standard" },
  { id: "corner", group: "basic", title: "Corner Wall",
    description: "Two wall runs meeting at a corner",
    note: "Use this when estimating internal or external corners.",
    icon: CornerDownRight, system: "int-horiz", wallSystem: "corner" },
  { id: "shaft", group: "basic", title: "Shaft Wall",
    description: "Shaft, stair or lift enclosure walls.",
    note: "Use this when wall runs are broken into sections.",
    icon: Building2, system: "int-horiz", wallSystem: "shaft" },
  { id: "ext-horiz", group: "basic", title: "External Wall",
    description: "External wall system — horizontal or vertical panel installation, with weather-facing finish.",
    note: "Use this for weather-facing applications, in either orientation.",
    icon: Shield, system: "ext-horiz" },

  // --- Application-specific systems ---------------------------------------------
  // Broader use-case catalog from the product literature. Several of these describe
  // the same underlying engineering config as a card above (e.g. External Wall System
  // ~ External Wall, Shaft Wall System ~ Shaft Wall) under different naming -- kept as
  // separate cards per product request rather than deduped/replaced. "Shafts & Risers"
  // was merged into "Shaft Wall System" (both describe the same shaft application).
  { id: "external-app", group: "application", title: "External Wall System",
    description: "External walls, boundary walls, weather-facing walls.",
    note: "Use this for boundary or weather-facing external wall applications.",
    icon: CloudRain, system: "ext-horiz" },
  { id: "separation", group: "application", title: "Separation Wall System",
    description: "Factory, warehouse, fire and acoustic separation walls.",
    note: "Use this for factory or warehouse fire and acoustic separation." ,
    icon: Warehouse },
  { id: "cinema", group: "application", title: "Cinema Wall System",
    description: "High acoustic / fire-rated cinema partition walls.",
    note: "Use this for high acoustic or fire-rated cinema partitions.",
    icon: Clapperboard },
  { id: "shaft-app", group: "application", title: "Shaft Wall System",
    description: "Lift shafts, service shafts, open cores, multi-level shaft divisions, risers.",
    note: "Use this for lift/service shafts, open cores or riser divisions.",
    icon: Building2, system: "int-horiz", wallSystem: "shaft" },
  { id: "stair", group: "application", title: "Stair Wall System",
    description: "Fire stair walls, stairwell separation walls.",
    note: "Use this for fire stair or stairwell separation walls.",
    icon: DoorOpen },
  { id: "intertenancy", group: "application", title: "Intertenancy & Corridor System",
    description: "Apartments, corridors, plasterboard-lined fire/acoustic walls.",
    note: "Use this for apartment, corridor or plasterboard-lined fire/acoustic walls.",
    icon: Building },
  { id: "car-park", group: "application", title: "Car Park System",
    description: "Car park fire/security walls, blockwork alternative, impact areas.",
    note: "Use this for car park fire/security walls or impact areas.",
    icon: SquareParking },
  { id: "plant-room", group: "application", title: "Plant Room System",
    description: "Plant rooms, service rooms, walls with penetrations/apertures.",
    note: "Use this for plant/service rooms or walls needing penetrations.",
    icon: Wrench },
  { id: "facade", group: "application", title: "Façade System",
    description: "External façade/boundary wall applications with pre-finished panel face.",
    note: "Use this for pre-finished external façade or boundary applications.",
    icon: LayoutPanelLeft, system: "ext-horiz" },
  { id: "scissor-horiz", group: "application", title: "Scissor Stair System — Horizontal Orientation",
    description: "78mm horizontal panels fixed to stair stringers.",
    note: "Use this for horizontal scissor-stair installations.",
    icon: RectangleHorizontal, system: "int-horiz", wallSystem: "standard" },
  { id: "scissor-vert", group: "application", title: "Scissor Stair System — Vertical Orientation",
    description: "78mm vertical panels between landings.",
    note: "Use this for vertical scissor-stair installations between landings.",
    icon: RectangleVertical, system: "int-vert" },
];

export const WallSystemOptionCard = ({ option, selected }: { option: WallSystemOption; selected: boolean }) => {
  const Icon = option.icon;
  return (
    <div className={cx.card + " h-full flex flex-col gap-3"} style={selected ? { borderColor: BLUE, borderWidth: 2 } : undefined}>
      <div className="relative">
        <div className="h-20 rounded-lg grid place-items-center border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <Icon size={28} style={{ color: BLUE }} />
        </div>
        {selected && (
          <div className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full shadow-sm" style={{ background: BLUE }}>
            <Check size={14} color={WHITE} strokeWidth={3} />
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-bold" style={{ color: NAVY }}>{option.title}</div>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }}>{option.description}</p>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
        <p className={cx.footnote + " pt-0"}>{option.note}</p>
      </div>
      {/* mt-auto pins the CTA to the bottom regardless of how tall the title/
          description/note above it are -- keeps every card's button aligned
          on the same row once the grid stretches all cards to equal height. */}
      {selected ? (
        <div className="mt-auto flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
          <Check size={14} /> Selected
        </div>
      ) : (
        // Inert stub for this pass -- no onClick wired yet (see file-level note above).
        <button className="mt-auto w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ color: BLUE }}>
          Select System
        </button>
      )}
    </div>
  );
};

export const SystemSelector = ({ layoutMode, system, activeWallSystem }: {
  layoutMode: EffectiveLayout; system: string; activeWallSystem: WallSystemId;
}) => {
  const isSelected = (option: WallSystemOption) =>
    option.system !== undefined && system === option.system &&
    (option.wallSystem === undefined || activeWallSystem === option.wallSystem);

  const sidebarNode = (
    <>
      <div className={cx.card}>
        <div className={cx.cardTitle}><Layers size={13} style={{ color: BLUE }} />Choose Your Wall System</div>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          Select the wall type that matches how Speedpanel will be installed in your project.
          You'll enter measurements after you make your selection.
        </p>
        <div className={cx.infoNote}><span>This selector does not calculate or recommend automatically. You're in control.</span></div>
        <div className="mt-4 space-y-3">
          {[
            { n: 1, title: "Choose Orientation", sub: "Horizontal or Vertical", current: true },
            { n: 2, title: "Select Wall Type", sub: "Pick the system that fits your project", current: false },
            { n: 3, title: "Enter Measurements", sub: "Complete the form to calculate your estimate", current: false },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                style={step.current ? { background: BLUE, color: WHITE } : { color: MUTED, border: "1px solid #cbd5e1" }}>
                {step.n}
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: step.current ? BLUE : NAVY }}>{step.title}</div>
                <div className="text-xs" style={{ color: MUTED }}>{step.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={cx.card + " mt-3"}>
        <div className={cx.cardTitle}><HelpCircle size={13} style={{ color: BLUE }} />Need help choosing?</div>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>View our quick guide to understand each system type.</p>
        {/* Inert stub -- no destination wired yet, see file-level note above. */}
        <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ color: BLUE }}>
          View Guide <ChevronRight size={14} />
        </button>
        <p className="mt-3 text-center text-xs" style={{ color: MUTED }}>Or contact Speedpanel</p>
        <a href="tel:+61391156666" className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ background: BLUE, color: WHITE }}>
          <Phone size={14} /> +61 3 9115 6666
        </a>
      </div>
    </>
  );

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
      <div className="mt-5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between gap-6">
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
