import { useState, useEffect, lazy, Suspense } from "react";
import { RotateCcw, AlertTriangle, Settings } from "lucide-react";
import { useLayoutMode } from "./useLayoutMode";
import { useThemeMode } from "./useThemeMode";
import { useAuth } from "./lib/useAuth";
import { useWallStore } from "./wallStore";
import { NAVY, BLUE, GOLD, MUTED } from "./styleTokens";
import { SectionLabel } from "./ui/primitives";
import { EducationHub } from "./education/EducationHub";
import { SystemSelector } from "./systemSelector/SystemSelector";
import { ExternalCalculator } from "./externalCalculator/ExternalCalculator";
import { InternalCalculator } from "./internalCalculator/InternalCalculator";
import { SYSTEMS } from "./appShell/systems";
import { loadSession, saveSession } from "./appShell/session";
import { TopNav, type TopNavTab } from "./appShell/topNav";
import { LayoutModeToggle, ThemeToggle } from "./appShell/headerToggles";
import { AuthStatus } from "./appShell/AuthStatus";
import { SystemRows } from "./appShell/systemRows";
import { useCornerShaftLinking } from "./appShell/useCornerShaftLinking";
import { useHashRoute } from "./appShell/useHashRoute";
import { ProjectsRouter } from "./pages/projects/ProjectsRouter";
import { saveProjectSnapshot } from "./pages/projects/saveProjectSnapshot";
import { insertProject, seedSnapshotForSystem } from "./pages/projects/projectsStore";
import type { ProjectRow, SavedProjectData } from "./pages/projects/projectTypes";
import { ProformaInvoicePage } from "./pages/projects/orders/ProformaInvoicePage";
import type { WallSystemOption } from "./systemSelector/systemOptions";

// Not part of the initial bundle -- a typical customer never visits /admin,
// so the entire Admin section (ten sub-pages' worth of code) is only
// fetched once someone actually navigates there. See AdminRoot.tsx.
const AdminRoot = lazy(() => import("./pages/admin/AdminRoot").then(m => ({ default: m.AdminRoot })));

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
  const auth = useAuth();

  // Which saved (Supabase) project, if any, is currently open in the
  // Estimator tab -- see wallStore.ts's persistLocally/loadFrom/exportSnapshot.
  // While a project is open, the device-local session/wall autosave is
  // bypassed in favour of the explicit Save button below.
  const [openProject, setOpenProject] = useState<{ id: string; name: string } | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [saveProjectError, setSaveProjectError] = useState<string | null>(null);

  // Persist the current view on change (skipped while a saved project is open).
  useEffect(() => {
    if (openProject) return;
    saveSession({ v: 1, system, mode, dimUnit });
  }, [system, mode, dimUnit, openProject]);

  const sys    = SYSTEMS.find(s => s.id === system) || SYSTEMS[0];
  const isExt  = sys.ext;

  // Single SHARED wall store (persisted); the Internal and External calculators
  // each independently destructure/compute what they need from it, so walls
  // survive switching in/out of External mode and between orientations.
  const store = useWallStore({ dimUnit, onWallAdded: () => setShowWall(true), persistLocally: !openProject });
  const { active, resetWalls, clearCustomLength, loadFrom, exportSnapshot } = store;
  // Orientation is per-wall (see Wall.orient) -- this is the ACTIVE wall's own
  // orientation, used only to drive which fields/selectors are shown for it.
  // It must never be applied to every wall (that was the combined-estimate bug).
  const orient = active.orient;

  const { linkCornerPartner, linkShaftPartner, switchOrient } = useCornerShaftLinking(store, setShowWall);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  // Deliberate "start over": reset the shared store + view, and close any
  // open saved project (a fresh device-local scratch project, not that
  // project, is what "start over" should mean). The persistence effects
  // immediately re-save the clean default, so a later reload stays clear.
  const resetAll     = () => { resetWalls(); setMode("project"); setSystem("int-vert"); setDimUnit("m"); setOpenProject(null); };
  // Switching system no longer clears walls -- the shared store is preserved
  // across every orientation/wall-type change.
  const switchSystem = (id: string) => { setSystem(id); setShowWall(true); };
  const findSys = (orientVal: "vertical" | "horizontal", ext: boolean) =>
    SYSTEMS.find(s => s.orient === orientVal && s.ext === ext)!;

  // Opening a saved project from Projects loads its snapshot into the shared
  // wall store/view state and switches to the Estimator tab -- the builder UI
  // itself is the existing InternalCalculator/ExternalCalculator, not a
  // separate copy (see wallStore.ts's loadFrom).
  const openProjectInEstimator = (project: ProjectRow) => {
    loadFrom(project.data);
    setSystem(project.data.system);
    setMode(project.data.mode);
    setDimUnit(project.data.dimUnit);
    setOpenProject({ id: project.id, name: project.name });
    setSaveProjectError(null);
    navigate({ tab: "estimator" });
  };

  const saveOpenProject = async () => {
    if (!openProject) return;
    setSavingProject(true);
    setSaveProjectError(null);
    const snapshot: SavedProjectData = { ...exportSnapshot(), system, mode, dimUnit };
    const err = await saveProjectSnapshot(openProject.id, snapshot);
    setSavingProject(false);
    if (err) setSaveProjectError(err);
  };

  // System Selector's "Select System" -- creates a new saved project pre-set
  // to the chosen system/wallSystem (see projectsStore.ts's
  // seedSnapshotForSystem) and opens it in the Estimator, same as opening any
  // other existing project. Signed-out visitors get redirected to sign in
  // first; pendingSystemSelection remembers their choice (name + system)
  // across that redirect so it auto-resumes the moment they're signed in,
  // rather than making them re-pick the system afterwards.
  const [pendingSystemSelection, setPendingSystemSelection] = useState<{ option: WallSystemOption; name: string } | null>(null);

  const doCreateProjectFromSystem = async (option: WallSystemOption, name: string): Promise<string | null> => {
    const data = seedSnapshotForSystem(option.system!, option.wallSystem);
    const { project, error } = await insertProject(auth.user!.id, name, data);
    if (error || !project) return error;
    openProjectInEstimator(project);
    return null;
  };

  const createProjectFromSystem = async (option: WallSystemOption, name: string): Promise<string | null> => {
    if (!auth.session) { setPendingSystemSelection({ option, name }); navigate({ tab: "projects" }); return null; }
    return doCreateProjectFromSystem(option, name);
  };

  useEffect(() => {
    if (!auth.session || !pendingSystemSelection) return;
    const { option, name } = pendingSystemSelection;
    setPendingSystemSelection(null);
    doCreateProjectFromSystem(option, name).then(err => { if (err) window.alert(err); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session]);

  // Standalone printable document -- no TopNav/app chrome at all, simpler
  // than fighting print CSS to hide it. Rendered as an alternate branch of
  // this same return (not an early return above) so every hook this
  // component calls still runs in the same order on every render.
  if (route.tab === "proforma") {
    return <ProformaInvoicePage orderId={route.orderId} onBack={() => navigate({ tab: "estimator" })} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950" style={{ color: NAVY }}>
      <div className={layoutMode === "web" ? "mx-auto w-full max-w-[1400px] px-6 pb-16 pt-6" : "mx-auto w-full max-w-md px-3 sm:px-4 pb-24 pt-5"}>

        {/* Top nav */}
        <TopNav
          activeTab={route.tab}
          onTabChange={switchTab}
          right={<>
            <AuthStatus auth={auth} onSignInClick={() => navigate({ tab: "projects" })} />
            <ThemeToggle effective={themeMode} onToggle={toggleTheme} />
            <LayoutModeToggle effective={layoutMode} onToggle={toggleLayout} />
            <button onClick={resetAll} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all">
              <RotateCcw size={16} />
            </button>
          </>}
        />
        <div className="mt-4 h-[2px] w-full rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 55%, ${GOLD} 100%)` }} />

        {route.tab === "selector"  && (
          <SystemSelector layoutMode={layoutMode} system={system} activeWallSystem={active.wallSystem}
            onCreateProject={createProjectFromSystem} />
        )}
        {route.tab === "education" && <EducationHub layoutMode={layoutMode} />}
        {route.tab === "projects"  && (
          <ProjectsRouter
            route={route} navigate={navigate} auth={auth}
            onOpenEstimator={openProjectInEstimator}
            pendingNote={pendingSystemSelection ? `Sign in to create "${pendingSystemSelection.name}"` : undefined}
            layoutMode={layoutMode}
          />
        )}

        {route.tab === "admin" && (
          <Suspense fallback={<div className="mt-6 text-sm" style={{ color: MUTED }}>Loading...</div>}>
            <AdminRoot route={route} navigate={navigate} layoutMode={layoutMode} auth={auth} />
          </Suspense>
        )}

        {/* Open-project banner + Save -- only shown while editing a saved project */}
        {route.tab === "estimator" && openProject && (
          <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 px-4 py-3`}>
            <span className="text-sm font-semibold" style={{ color: NAVY }}>Editing project: {openProject.name}</span>
            <div className="flex items-center gap-3">
              {saveProjectError && <span className="text-sm text-red-600 dark:text-red-400">{saveProjectError}</span>}
              <button onClick={saveOpenProject} disabled={savingProject}
                className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: "#fff" }}>
                {savingProject ? "Saving..." : "Save"}
              </button>
            </div>
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
