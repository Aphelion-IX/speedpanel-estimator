import { useState, useEffect } from "react";
import { RotateCcw, AlertTriangle, Settings } from "lucide-react";
import { useLayoutMode } from "./useLayoutMode";
import { useThemeMode } from "./useThemeMode";
import { useWallStore } from "./wallStore";
import { NAVY, BLUE, GOLD } from "./styleTokens";
import { SectionLabel } from "./ui/primitives";
import { EducationHub } from "./education/EducationHub";
import { SystemSelector } from "./systemSelector/SystemSelector";
import { ExternalCalculator } from "./externalCalculator/ExternalCalculator";
import { InternalCalculator } from "./internalCalculator/InternalCalculator";
import { SYSTEMS } from "./appShell/systems";
import { loadSession, saveSession } from "./appShell/session";
import { TopNav, type TopNavTab } from "./appShell/topNav";
import { LayoutModeToggle, ThemeToggle } from "./appShell/headerToggles";
import { SystemRows } from "./appShell/systemRows";
import { useCornerShaftLinking } from "./appShell/useCornerShaftLinking";
import { useHashRoute } from "./appShell/useHashRoute";
import { ProjectsPage } from "./pages/ProjectsPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminProductsPage } from "./pages/admin/AdminProductsPage";
import { AdminSystemsPage } from "./pages/admin/AdminSystemsPage";
import { AdminDocumentsPage } from "./pages/admin/AdminDocumentsPage";
import { AdminRequestsPage } from "./pages/admin/AdminRequestsPage";

export type WallSystemId = "standard" | "corner" | "shaft";

// --- Main app -----------------------------------------------------------------
export default function SpeedpanelEstimator() {
  const savedSession = loadSession();
  const [system, setSystem] = useState(() => savedSession ? savedSession.system : "int-vert");
  const [mode, setMode]     = useState(() => savedSession ? savedSession.mode : "project");
  const [showWall, setShowWall]               = useState(true);
  const [dimUnit, setDimUnit] = useState(() => savedSession ? savedSession.dimUnit : "m");
  const { route, navigate } = useHashRoute();
  const switchTab = (tab: TopNavTab) => tab === "admin" ? navigate({ tab: "admin", sub: "dashboard" }) : navigate({ tab });
  const { effective: layoutMode, toggleLayout } = useLayoutMode();
  const { effective: themeMode, toggleTheme } = useThemeMode();

  // Persist the current view on change.
  useEffect(() => {
    saveSession({ v: 1, system, mode, dimUnit });
  }, [system, mode, dimUnit]);

  const sys    = SYSTEMS.find(s => s.id === system) || SYSTEMS[0];
  const isExt  = sys.ext;

  // Single SHARED wall store (persisted); the Internal and External calculators
  // each independently destructure/compute what they need from it, so walls
  // survive switching in/out of External mode and between orientations.
  const store = useWallStore({ dimUnit, onWallAdded: () => setShowWall(true) });
  const { active, resetWalls, clearCustomLength } = store;
  // Orientation is per-wall (see Wall.orient) -- this is the ACTIVE wall's own
  // orientation, used only to drive which fields/selectors are shown for it.
  // It must never be applied to every wall (that was the combined-estimate bug).
  const orient = active.orient;

  const { linkCornerPartner, linkShaftPartner, switchOrient } = useCornerShaftLinking(store, setShowWall);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  // Deliberate "start over": reset the shared store + view. The persistence
  // effects immediately re-save the clean default, so a later reload stays clear.
  const resetAll     = () => { resetWalls(); setMode("project"); setSystem("int-vert"); setDimUnit("m"); };
  // Switching system no longer clears walls -- the shared store is preserved
  // across every orientation/wall-type change.
  const switchSystem = (id: string) => { setSystem(id); setShowWall(true); };
  const findSys = (orientVal: "vertical" | "horizontal", ext: boolean) =>
    SYSTEMS.find(s => s.orient === orientVal && s.ext === ext)!;

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950" style={{ color: NAVY }}>
      <div className={layoutMode === "web" ? "mx-auto w-full max-w-[1400px] px-6 pb-16 pt-6" : "mx-auto w-full max-w-md px-3 sm:px-4 pb-24 pt-5"}>

        {/* Top nav */}
        <TopNav
          activeTab={route.tab}
          onTabChange={switchTab}
          right={<>
            <ThemeToggle effective={themeMode} onToggle={toggleTheme} />
            <LayoutModeToggle effective={layoutMode} onToggle={toggleLayout} />
            <button onClick={resetAll} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all">
              <RotateCcw size={16} />
            </button>
          </>}
        />
        <div className="mt-4 h-[2px] w-full rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 55%, ${GOLD} 100%)` }} />

        {route.tab === "selector"  && <SystemSelector layoutMode={layoutMode} system={system} activeWallSystem={active.wallSystem} />}
        {route.tab === "education" && <EducationHub layoutMode={layoutMode} />}
        {route.tab === "projects"  && <ProjectsPage />}

        {route.tab === "admin" && (
          <div className="mt-6">
            {route.sub === "dashboard" && (
              <AdminDashboard onNavigate={sub => navigate({ tab: "admin", sub })} />
            )}
            {route.sub !== "dashboard" && (
              <>
                <button
                  onClick={() => navigate({ tab: "admin", sub: "dashboard" })}
                  className="text-sm font-semibold hover:underline"
                  style={{ color: BLUE }}
                >
                  &larr; Back to Admin
                </button>
                {route.sub === "products"  && <AdminProductsPage layoutMode={layoutMode} />}
                {route.sub === "systems"   && <AdminSystemsPage layoutMode={layoutMode} />}
                {route.sub === "documents" && <AdminDocumentsPage layoutMode={layoutMode} />}
                {route.sub === "requests"  && <AdminRequestsPage />}
              </>
            )}
          </div>
        )}

        {/* System configuration + calculator body */}
        {route.tab === "estimator" && (
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

        {route.tab === "estimator" && (
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
