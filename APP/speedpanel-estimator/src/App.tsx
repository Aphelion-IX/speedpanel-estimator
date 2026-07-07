import { useState, useEffect } from "react";
import {
  RotateCcw, Smartphone, Monitor, Sun, Moon, Menu, X, Phone, AlertTriangle, Settings,
} from "lucide-react";
import { useLayoutMode, type EffectiveLayout } from "./useLayoutMode";
import { useThemeMode, type EffectiveTheme } from "./useThemeMode";
import { useWallStore } from "./wallStore";
import { NAVY, BLUE, GOLD, WHITE, cx } from "./styleTokens";
import { SectionLabel } from "./ui/primitives";
import { EducationHub } from "./education/EducationHub";
import { SystemSelector } from "./systemSelector/SystemSelector";
import { ExternalCalculator } from "./externalCalculator/ExternalCalculator";
import { InternalCalculator } from "./internalCalculator/InternalCalculator";

// --- Wall and system config ---------------------------------------------------
const SYSTEMS = [
  { id: "int-vert",  label: "Vertical",   sub: "Internal Wall", ext: false, orient: "vertical"   as const },
  { id: "int-horiz", label: "Horizontal", sub: "Internal Wall", ext: false, orient: "horizontal" as const },
  { id: "ext-vert",  label: "Vertical",   sub: "External Wall", ext: true,  orient: "vertical"   as const },
  { id: "ext-horiz", label: "Horizontal", sub: "External Wall", ext: true,  orient: "horizontal" as const },
];


export type WallSystemId = "standard" | "corner" | "shaft";


// --- LayoutModeToggle -----------------------------------------------------------
// Icon button showing whichever layout is currently in effect; click forces
// the other one. Placed in the header next to the reset button.
const LayoutModeToggle = ({ effective, onToggle }: { effective: EffectiveLayout; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    title={effective === "phone" ? "Layout: Phone (click for Web)" : "Layout: Web (click for Phone)"}
    className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all"
  >
    {effective === "phone" ? <Smartphone size={16} /> : <Monitor size={16} />}
  </button>
);

// --- ThemeToggle -----------------------------------------------------------
// Icon button showing whichever theme is currently in effect; click forces
// the other one -- same pattern as LayoutModeToggle, placed right next to it.
const ThemeToggle = ({ effective, onToggle }: { effective: EffectiveTheme; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    title={effective === "dark" ? "Theme: Dark (click for Light)" : "Theme: Light (click for Dark)"}
    className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all"
  >
    {effective === "dark" ? <Moon size={16} /> : <Sun size={16} />}
  </button>
);

// --- TopNav ------------------------------------------------------------------
// Replaces the old logo+title header. Left side: logo + the app's top-level
// feature tabs (only "System Estimator" is wired to real content today -- the
// others render a ComingSoonPanel, see SpeedpanelEstimator). Right side: the
// same ThemeToggle/LayoutModeToggle/reset controls as before, unchanged, plus
// a hamburger menu that only appears below the sm breakpoint. No notification
// bell / profile dropdown -- this app has no accounts to attach them to.
export type TopNavTab = "estimator" | "selector" | "education" | "projects";

const TOP_NAV_ITEMS: { key: TopNavTab; label: string }[] = [
  { key: "estimator", label: "System Estimator" },
  { key: "selector",  label: "System Selector" },
  { key: "education", label: "Education Hub" },
  { key: "projects",  label: "Projects" },
];

const TopNavTabButton = ({ label, active, onClick, className = "" }: { label: string; active: boolean; onClick: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`rounded-xl px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-all ${active ? "" : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"} ${className}`}
    style={active ? { background: BLUE, color: WHITE } : undefined}
  >
    {label}
  </button>
);

const TopNav = ({ activeTab, onTabChange, right }: { activeTab: TopNavTab; onTabChange: (t: TopNavTab) => void; right: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <img
            src="data:image/webp;base64,UklGRrQFAABXRUJQVlA4TKcFAAAvj8ETEMdAkG1Tifsnt7jfIQSWyej/k4Mg26ZYI77UZQwEQNGUWsJ0nnggC2T08OPg718UBr0GEIGEYEu23bCRpEeBoiiKFLrd7vZg/0sVAYJKK+ezIvo/AfLH/3/8///v3/Z/OrzG8TJ0HnmNMcY1lzZUa60l55z3Ws+xVp1b76zeplprLflaa53Raq1HvtbanLhaeaxV/bRx7TflrN49rup5r7/ML7kywTHbuBDMIR3aRhgNcT9tEc6xl+GtRMJwiLk5lIjhmJvDAes+FqEvtop+VDK8exVq/jEvuTIBIdpp5AgYz0qEazq/BpyXzCMZrrEOJRPNwP5gL7kyAaGJvdo4wfOYg1C+GxDyHYBtJJhwzgj8WC+5MgGhyYwIV54ElC8HULsDkq3Cvs/A9lQvuTIBocmMDa5RpuH4dgjHHZBN28A6BeczveTKBIQmMyp89xsE/nbAcQc0yzIAnrI+0kuuTEBoMmW1xJxzjsuljS251npkMmD/KmHLueacFltoDvmotebVshoaRssU1Ad6yZUJCE2mMPR4Sv/clyBjUfpH0JYh8TVk8dWiqC1ZQA7Sb6Th1HYlKWkO3aCK6096yZUJwJpzzuxXNRLzOUGahvMriTQyoLgJL1rRqEeHEuagPM1LrkzQid2yttusDpK040sJk2Hxk6JtCqOfWMExJ/CzvOTKBCvx9zi0/K2Eg4bDj7WoFKUIKZsT9ZAf5SVXrkYmgHgW3ad+PzkMyU/GVuWUTVmcioLzQV5yZYIxMQHEPkXDyr8HWbRwI/QXkUNB86lBSQ/SZYI5MQHELqcBofA9snZ8sV3D6XZoW+9Qkohom1NWUJ+FCQhZDUBiAog9hAxA2M4b8KK1kWpvY6naeVYzVLdV23tJKSKyKuTEQYmT9mr/eUxAaKK2ACQmgNijmgBQmZagBhkZjGOjdZYYsleB3npBYRHZFZw+khUcc0Z/HBMQmhhbABITQNxLFkkDQMhTzhV6+mo0iTP0RboNfRIRObXdiYOyPAcTEJqYWwASE0B8SQAOjWkEWKrHkms9coS1fbXolo9a8xpgLL1N2S5CSnSSrKA8BRMQmgy2ACQmoIpIAlDEyGkIyA6OSR5pfJE+KbWzKWAnDsryFASEJsMtAFvuJABF7HsYwjaP+FcQWu9EP0i3asVJsoLyEEBo4tgCYicBKDLKOYzgmEVNvlu4SajS35W1J0FZvTgoi7SHyOIaewlAEUfel4HAc1YWh2jfxpZob9Og1ynURI1KzP1FgZdkBVX8KNq/GQEo4txSsGCfsRxiNYivIYuvWzW0CUsWneF/ePGixAlVXL8SgCL+nC3RjbYm9u+0GcRrSYdYy4TkJUVB+w0Uub7/dRFpQcMI7TnnXKuMf6dFW4dKzjkflWVwnRDchJREz1fk+v54SXWL4v6VCvR9SJzDBDS3quD5ilzfHz8JvwBeDHyPAzM3N4mK+lxFru/PjOUXsEJPco80ZfE7fwGEmItc3x8T88CJx+MVxvMmiybGpqG5SXq8BETpvj+2PWzNwqTFp6oLjJvco0FdLRK03Y/DwyUApfP+DKwAlu1ol3NfoO/3y6N1JObB4tR2gpX4JlnbTUkjP8mTUh4sI0scLD8gAShyfX9GApwD3284jwzHEcQrBkOTm5DWTIeG04+XOcNxZDjfLwEocn1/Rhq8szyMZ2hykxPqImY2FD8pD5YAFLm+P0O7V5THoyZ32bVkk1VbJwg9VgJQ5Pr+jK1OkR9vY7nNqh0DuwaeUJ/Ds8j1/XEIPpsYHyqdMjiFofPAaSgTJD5Xkev741FXh3TKs9F+yvCUopGMkpZmtIeIjkWu//vP/u6JcElkCOt+in2L/c1vi96lU6L31lvjYotrPlg8S1Q99qiWoT2qa2eL/WaTHNVNKdF767ToXSb9zLN2WR661VpP+eP/P3kGAA=="
            alt="Speedpanel"
            className="h-10 w-auto object-contain shrink-0"
          />
          <div className="hidden md:flex items-center gap-1 overflow-x-auto">
            {TOP_NAV_ITEMS.map(item => (
              <TopNavTabButton key={item.key} label={item.label} active={activeTab === item.key} onClick={() => onTabChange(item.key)} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all md:hidden"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
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

// --- ComingSoonPanel -----------------------------------------------------------
// Placeholder body shown for top-nav tabs that don't have real content yet
// (Projects -- see SpeedpanelEstimator).
const ComingSoonPanel = ({ title }: { title: string }) => (
  <div className={cx.card + " mt-6 text-center"}>
    <p className="text-sm font-bold uppercase tracking-widest" style={{ color: BLUE }}>{title}</p>
    <p className={cx.footnote}>Coming soon.</p>
  </div>
);


// --- Session persistence ------------------------------------------------------
// The current view (which system/orientation, project-vs-single mode, and unit)
// is saved alongside the wall project so reopening the app restores the exact
// screen. Kept separate from the wall data (PROJECT_KEY) since it's parent-level.
const SESSION_KEY = "speedpanel:session";
interface PersistedSession { v: number; system: string; mode: string; dimUnit: string; }
function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !SYSTEMS.some(sys => sys.id === s.system)) return null;
    return s as PersistedSession;
  } catch {
    return null;
  }
}

// --- SystemRows -----------------------------------------------------------
// Two full-weight rows, each with its own small label, so Orientation and
// Wall type read as two distinct, equally important decisions -- not one
// primary control with a smaller secondary one attached to it. Instantiated
// once by the root component and passed down as `systemSelector` into
// whichever of ExternalCalculator/InternalCalculator renders.
const SystemRows = ({ orient, switchOrient, isExt, switchSystem, findSys }: {
  orient: "vertical" | "horizontal"; switchOrient: (o: "vertical" | "horizontal") => void;
  isExt: boolean; switchSystem: (id: string) => void;
  findSys: (orientVal: "vertical" | "horizontal", ext: boolean) => { id: string };
}) => {
  const isHoriz = orient === "horizontal";
  return (
    <div className="space-y-3">
      <div>
        <div className={cx.cardHd}>Orientation</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => switchOrient("vertical")}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (!isHoriz ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
            style={!isHoriz ? { borderColor: BLUE, background: BLUE } : undefined}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 1.5v10M6.5 1.5v10M10 1.5v10" stroke={!isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: !isHoriz ? WHITE : BLUE }}>Vertical</span>
          </button>
          <button onClick={() => switchOrient("horizontal")}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (isHoriz ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
            style={isHoriz ? { borderColor: BLUE, background: BLUE } : undefined}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1.5 3h10M1.5 6.5h10M1.5 10h10" stroke={isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isHoriz ? WHITE : BLUE }}>Horizontal</span>
          </button>
        </div>
      </div>
      <div>
        <div className={cx.cardHd}>Wall type</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => switchSystem(findSys(orient, false).id)}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all " + (!isExt ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
            style={!isExt ? { borderColor: BLUE, background: BLUE } : undefined}>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: !isExt ? WHITE : BLUE }}>Internal</span>
          </button>
          <button onClick={() => switchSystem(findSys(orient, true).id)}
            className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all " + (isExt ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
            style={isExt ? { borderColor: BLUE, background: BLUE } : undefined}>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isExt ? WHITE : BLUE }}>External</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main app -----------------------------------------------------------------
export default function SpeedpanelEstimator() {
  const savedSession = loadSession();
  const [system, setSystem] = useState(() => savedSession ? savedSession.system : "int-vert");
  const [mode, setMode]     = useState(() => savedSession ? savedSession.mode : "project");
  const [showWall, setShowWall]               = useState(true);
  const [dimUnit, setDimUnit] = useState(() => savedSession ? savedSession.dimUnit : "m");
  const [activeTab, setActiveTab] = useState<TopNavTab>("estimator");
  const { effective: layoutMode, toggleLayout } = useLayoutMode();
  const { effective: themeMode, toggleTheme } = useThemeMode();

  // Persist the current view on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(SESSION_KEY, JSON.stringify({ v: 1, system, mode, dimUnit })); } catch { /* ignore */ }
  }, [system, mode, dimUnit]);

  const sys    = SYSTEMS.find(s => s.id === system) || SYSTEMS[0];
  const isExt  = sys.ext;

  // Single SHARED wall store (persisted); the Internal and External calculators
  // each independently destructure/compute what they need from it, so walls
  // survive switching in/out of External mode and between orientations.
  const store = useWallStore({ dimUnit, onWallAdded: () => setShowWall(true) });
  const { setWalls, active, update, resetWalls, clearCustomLength } = store;
  // Orientation is per-wall (see Wall.orient) -- this is the ACTIVE wall's own
  // orientation, used only to drive which fields/selectors are shown for it.
  // It must never be applied to every wall (that was the combined-estimate bug).
  const orient = active.orient;

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  // Deliberate "start over": reset the shared store + view. The persistence
  // effects immediately re-save the clean default, so a later reload stays clear.
  const resetAll     = () => { resetWalls(); setMode("project"); setSystem("int-vert"); setDimUnit("m"); };
  // Switching system no longer clears walls -- the shared store is preserved
  // across every orientation/wall-type change.
  const switchSystem = (id: string) => { setSystem(id); setShowWall(true); };
  const findSys = (orientVal: "vertical" | "horizontal", ext: boolean) =>
    SYSTEMS.find(s => s.orient === orientVal && s.ext === ext)!;

  // Symmetric corner-wall linking: setting the active wall's partner to
  // targetId also points targetId back at the active wall, and un-links
  // whichever previous partners either wall had (a wall can only be linked to
  // one other wall at a time -- see estimate_free_corner_wall.md, "always 1
  // corner"). Passing targetId === null unlinks the active wall only.
  // cornerSide defaults are set to opposite sides on link so the pair starts
  // as a sensible right-angle corner rather than both runs claiming the same side.
  const linkCornerPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === active.id)?.cornerPartnerId ?? null;
      return ws.map(w => {
        if (w.id === active.id) return { ...w, cornerPartnerId: targetId, cornerSide: "right" as const };
        if (targetId !== null && w.id === targetId) return { ...w, cornerPartnerId: active.id, cornerSide: "left" as const };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, cornerPartnerId: null };
        // If the newly-chosen partner was itself linked to a third wall, break that old link too.
        if (targetId !== null && w.cornerPartnerId === targetId && w.id !== active.id) return { ...w, cornerPartnerId: null };
        return w;
      });
    });
  };

  // Symmetric shaft-wall linking (primary <-> secondary split), same pattern
  // as linkCornerPartner -- no side field to default here since Shaft wall
  // doesn't have a "which side" concept, just the shared junction.
  const linkShaftPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === active.id)?.shaftPartnerId ?? null;
      return ws.map(w => {
        if (w.id === active.id) return { ...w, shaftPartnerId: targetId };
        if (targetId !== null && w.id === targetId) return { ...w, shaftPartnerId: active.id };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, shaftPartnerId: null };
        if (targetId !== null && w.shaftPartnerId === targetId && w.id !== active.id) return { ...w, shaftPartnerId: null };
        return w;
      });
    });
  };

  // Switches the ACTIVE wall's own orientation (per-wall now -- see Wall.orient),
  // not a global setting, so other walls in a combined project are unaffected.
  // Corner/Shaft wall systems only make sense for horizontal walls, so switching
  // to vertical resets wallSystem back to "standard" and unlinks any partner
  // (mirroring deleteWall's dangling-partner cleanup) to avoid stale state.
  const switchOrient = (o: "vertical" | "horizontal") => {
    if (o === active.orient) return;
    if (o === "vertical") {
      if (active.wallSystem === "corner" && active.cornerPartnerId != null) linkCornerPartner(null);
      if (active.wallSystem === "shaft" && active.shaftPartnerId != null) linkShaftPartner(null);
      update({ orient: o, wallSystem: "standard" });
    } else {
      update({ orient: o });
    }
    setShowWall(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950" style={{ color: NAVY }}>
      <div className={layoutMode === "web" ? "mx-auto w-full max-w-[1400px] px-6 pb-16 pt-6" : "mx-auto w-full max-w-md px-3 sm:px-4 pb-24 pt-5"}>

        {/* Top nav */}
        <TopNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          right={<>
            <ThemeToggle effective={themeMode} onToggle={toggleTheme} />
            <LayoutModeToggle effective={layoutMode} onToggle={toggleLayout} />
            <button onClick={resetAll} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all">
              <RotateCcw size={16} />
            </button>
          </>}
        />
        <div className="mt-4 h-[2px] w-full rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 55%, ${GOLD} 100%)` }} />

        {activeTab === "selector"  && <SystemSelector layoutMode={layoutMode} system={system} activeWallSystem={active.wallSystem} />}
        {activeTab === "education" && <EducationHub layoutMode={layoutMode} />}
        {activeTab === "projects"  && <ComingSoonPanel title="Projects" />}

        {/* System configuration + calculator body */}
        {activeTab === "estimator" && (
          isExt ? (
            <>
              <SectionLabel icon={<Settings size={13} />}>System configuration</SectionLabel>
              <div className="mt-1">
                <ExternalCalculator store={store} orient={orient} dimUnit={dimUnit} setDimUnit={switchDimUnit}
                  systemSelector={<SystemRows orient={orient} switchOrient={switchOrient} isExt={isExt} switchSystem={switchSystem} findSys={findSys} />}
                  layoutMode={layoutMode} />
              </div>
            </>
          ) : (
            <InternalCalculator
              store={store} orient={orient} dimUnit={dimUnit} setDimUnit={switchDimUnit}
              systemSelector={<SystemRows orient={orient} switchOrient={switchOrient} isExt={isExt} switchSystem={switchSystem} findSys={findSys} />}
              layoutMode={layoutMode}
              mode={mode} setMode={setMode}
              showWall={showWall} setShowWall={setShowWall}
              linkCornerPartner={linkCornerPartner} linkShaftPartner={linkShaftPartner}
            />
          )
        )}

        {activeTab === "estimator" && (
          <div className="mt-8 flex gap-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" />
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
              By using this calculator you acknowledge quantities are estimates only and you will not hold Speedpanel liable for over- or under-ordering. Does not confirm compliance, FRL, engineering, restraint, certification or approval.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
