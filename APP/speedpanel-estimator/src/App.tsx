import { useState, useEffect, lazy, Suspense } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { useLayoutMode } from "./useLayoutMode";
import { useThemeMode } from "./useThemeMode";
import { useAuth } from "./lib/useAuth";
import { useCompanyMemberships } from "./lib/useCompanyMemberships";
import { useWallStore } from "./wallStore";
import { NAVY, BLUE, GOLD } from "./styleTokens";
import { IconButton } from "./ui/primitives";
import { Button } from "./ui/button";
import { ConfirmDialog, ErrorDialog } from "./ui/confirmDialog";
import { LoadingState } from "./ui/states";
import { EducationHub } from "./education/EducationHub";
import { SystemSelector } from "./systemSelector/SystemSelector";
import { ExternalCalculator } from "./externalCalculator/ExternalCalculator";
import { InternalCalculator } from "./internalCalculator/InternalCalculator";
import { SYSTEMS } from "./appShell/systems";
import { loadSession, saveSession } from "./appShell/session";
import { TopNav, type TopNavTab } from "./appShell/topNav";
import { LayoutModeToggle, ThemeToggle, NotificationBell } from "./appShell/headerToggles";
import { AuthStatus } from "./appShell/AuthStatus";
import { CompanySwitcher } from "./appShell/CompanySwitcher";
import { useMyInternalRole } from "./pages/admin/useMyInternalRole";
import { SystemRows } from "./appShell/systemRows";
import { useCornerShaftLinking } from "./appShell/useCornerShaftLinking";
import { useHashRoute } from "./appShell/useHashRoute";
import { ProjectsRouter } from "./pages/projects/ProjectsRouter";
import { LandingPage } from "./pages/home/LandingPage";
import { OverviewDashboardPage } from "./pages/home/OverviewDashboardPage";
import { saveProjectSnapshot } from "./pages/projects/saveProjectSnapshot";
import { insertProject, seedSnapshotForSystem, useProjects } from "./pages/projects/projectsStore";
import { SaveDraftBanner } from "./pages/projects/SaveDraftBanner";
import type { ProjectRow, SavedProjectData } from "./pages/projects/projectTypes";
import { ProformaInvoicePage } from "./pages/projects/orders/ProformaInvoicePage";
import { CompanyRouter } from "./pages/company/CompanyRouter";
import { MyRequestsPage } from "./pages/projects/requests/MyRequestsPage";
import { useMyRequests, isOpenRequest } from "./pages/projects/requests/myRequestsStore";
import { PendingInvitationsBanner } from "./pages/company/PendingInvitationsBanner";
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
  const switchTab = (tab: TopNavTab) =>
    tab === "admin" ? navigate({ tab: "admin", sub: "dashboard" })
    : tab === "company" ? navigate({ tab: "company", sub: "team" })
    : navigate({ tab });
  const { effective: layoutMode, toggleLayout } = useLayoutMode();
  const { effective: themeMode, toggleTheme } = useThemeMode();
  const auth = useAuth();
  const company = useCompanyMemberships(auth);
  const { isInternalStaff, staffRole } = useMyInternalRole(auth.user?.id ?? null);

  // Header bell's badge count -- customer-only (staff have no personal
  // request history), so `user` is passed as null for a staff account,
  // which both hooks' own `if (!user) return;` guards already turn into a
  // zero-network-call no-op, same pattern NextActionsCallout relies on.
  // Runs on every route (the header renders everywhere), independent of
  // and in addition to OverviewDashboardPage's own NextActionsCallout
  // fetch on the Home tab -- an accepted, explicit double-fetch tradeoff,
  // this app has no query-caching layer to share results through.
  const { projects: myProjects } = useProjects(isInternalStaff ? null : auth.user, company.activeCompanyId);
  const { items: myRequestItems } = useMyRequests(isInternalStaff ? null : auth.user, myProjects);
  const openRequestsCount = isInternalStaff ? 0 : myRequestItems.filter(isOpenRequest).length;

  // Which saved (Supabase) project, if any, is currently open in the
  // Estimator tab -- see wallStore.ts's persistLocally/loadFrom/exportSnapshot.
  // While a project is open, the device-local session/wall autosave is
  // bypassed in favour of the explicit Save button below.
  const [openProject, setOpenProject] = useState<{ id: string; name: string } | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [saveProjectError, setSaveProjectError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingCreationError, setPendingCreationError] = useState<string | null>(null);

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
  const resetAll = () => {
    setConfirmReset(false);
    resetWalls(); setMode("project"); setSystem("int-vert"); setDimUnit("m"); setOpenProject(null);
  };
  // Switching system no longer clears walls -- the shared store is preserved
  // across every orientation/wall-type change.
  const switchSystem = (id: string) => { setSystem(id); setShowWall(true); };
  const findSys = (orientVal: "vertical" | "horizontal", ext: boolean) =>
    SYSTEMS.find(s => s.orient === orientVal && s.ext === ext)!;
  // Phone "External Wall" add-tile: add a wall to the shared store, then
  // switch the whole project over to the External calculator -- there's no
  // per-wall internal/external flag, External-ness is a project-level system
  // choice (see isExt above), so "add an external wall" means both at once.
  const addExternalWall = () => { store.addBlankWall(); switchSystem(findSys(orient, true).id); };

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

  // Two ways to create a saved project from a device-local state: System
  // Selector's "Select System" (seeds a fresh snapshot for the chosen system/
  // wallSystem) and the Estimator tab's "Save as Project" (saves whatever's
  // already in the shared wall store). Both redirect a signed-out visitor to
  // sign in first; pendingProjectCreation remembers which one they asked for
  // (plus its name) across that redirect so it auto-resumes the moment
  // they're signed in, rather than making them repeat the action afterwards.
  type PendingProjectCreation = { kind: "system"; option: WallSystemOption; name: string } | { kind: "draft"; name: string };
  const [pendingProjectCreation, setPendingProjectCreation] = useState<PendingProjectCreation | null>(null);

  const doCreateProjectFromSystem = async (option: WallSystemOption, name: string): Promise<string | null> => {
    const data = seedSnapshotForSystem(option.system!, option.wallSystem);
    const { project, error } = await insertProject(auth.user!.id, name, data, company.activeCompanyId);
    if (error || !project) return error;
    openProjectInEstimator(project);
    return null;
  };

  const createProjectFromSystem = async (option: WallSystemOption, name: string): Promise<string | null> => {
    if (!auth.session) { setPendingProjectCreation({ kind: "system", option, name }); navigate({ tab: "projects" }); return null; }
    return doCreateProjectFromSystem(option, name);
  };

  // Estimator tab's "Save as Project" -- same insertProject() call
  // saveOpenProject already builds a snapshot for on update, just routed
  // through a fresh insert instead.
  const doSaveDraftAsProject = async (name: string): Promise<string | null> => {
    const snapshot: SavedProjectData = { ...exportSnapshot(), system, mode, dimUnit };
    const { project, error } = await insertProject(auth.user!.id, name, snapshot, company.activeCompanyId);
    if (error || !project) return error;
    openProjectInEstimator(project);
    return null;
  };

  const saveDraftAsProject = async (name: string): Promise<string | null> => {
    if (!auth.session) { setPendingProjectCreation({ kind: "draft", name }); navigate({ tab: "projects" }); return null; }
    return doSaveDraftAsProject(name);
  };

  useEffect(() => {
    if (!auth.session || !pendingProjectCreation) return;
    const pending = pendingProjectCreation;
    setPendingProjectCreation(null);
    const run = pending.kind === "system" ? doCreateProjectFromSystem(pending.option, pending.name) : doSaveDraftAsProject(pending.name);
    run.then(err => { if (err) setPendingCreationError(err); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session]);

  // Standalone printable document -- no TopNav/app chrome at all, simpler
  // than fighting print CSS to hide it. Rendered as an alternate branch of
  // this same return (not an early return above) so every hook this
  // component calls still runs in the same order on every render.
  if (route.tab === "proforma") {
    return <ProformaInvoicePage orderId={route.orderId} onBack={() => navigate({ tab: "estimator" })} />;
  }

  // Signed-out front door -- also standalone/full-bleed, same reasoning as
  // proforma above (its own hero/background, no TopNav). The signed-in
  // case (OverviewDashboardPage) stays inside the normal shell below.
  if (route.tab === "home" && !auth.session) {
    return <LandingPage auth={auth} pendingNote={pendingProjectCreation ? `Sign in to create "${pendingProjectCreation.name}"` : undefined} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950" style={{ color: NAVY }}>
      <ConfirmDialog
        open={confirmReset}
        danger
        title="Reset the estimator"
        description="This can't be undone."
        confirmLabel="Reset"
        onConfirm={resetAll}
        onCancel={() => setConfirmReset(false)}
      />
      <ErrorDialog message={pendingCreationError} onDismiss={() => setPendingCreationError(null)} />
      {/* Full-width header bar -- pulled out of the padded content column
          below so it spans edge to edge, with the brand gradient line as
          its own bottom edge rather than a separate divider. */}
      <header className="bg-white/95 backdrop-blur dark:bg-slate-950/95">
        <div className={layoutMode === "web" ? "mx-auto w-full max-w-[1520px] px-6 py-3" : "mx-auto w-full max-w-md px-3 sm:px-4 py-3"}>
          <TopNav
            activeTab={route.tab}
            onTabChange={switchTab}
            right={<>
              <NotificationBell count={openRequestsCount} onClick={() => navigate({ tab: "myRequests" })} />
              <CompanySwitcher company={company} />
              <ThemeToggle effective={themeMode} onToggle={toggleTheme} />
              <LayoutModeToggle effective={layoutMode} onToggle={toggleLayout} />
              <IconButton onClick={() => setConfirmReset(true)}>
                <RotateCcw size={16} />
              </IconButton>
              <AuthStatus auth={auth} onSignInClick={() => navigate({ tab: "home" })}
                isInternalStaff={isInternalStaff} staffRole={staffRole} navigate={navigate} />
            </>}
          />
        </div>
        <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 55%, ${GOLD} 100%)` }} />
      </header>

      <div className={layoutMode === "web" ? "mx-auto w-full max-w-[1520px] px-6 pb-16 pt-6" : "mx-auto w-full max-w-md px-3 sm:px-4 pb-24 pt-5"}>

        {/* Renders nothing when there's no pending invitation -- safe to
            mount unconditionally on every tab, not just Projects, since it's
            about the account, not any one page. */}
        {auth.session && <PendingInvitationsBanner userEmail={auth.user?.email} onAccepted={company.reload} />}

        {route.tab === "home" && (
          <OverviewDashboardPage auth={auth} navigate={navigate}
            isInternalStaff={isInternalStaff} activeCompanyId={company.activeCompanyId} />
        )}

        {route.tab === "selector"  && (
          <SystemSelector layoutMode={layoutMode} system={system} activeWallSystem={active.wallSystem}
            onCreateProject={createProjectFromSystem} />
        )}
        {route.tab === "education" && <EducationHub layoutMode={layoutMode} />}
        {route.tab === "projects"  && (
          <ProjectsRouter
            route={route} navigate={navigate} auth={auth} company={company}
            onOpenEstimator={openProjectInEstimator}
            pendingNote={pendingProjectCreation ? `Sign in to create "${pendingProjectCreation.name}"` : undefined}
            layoutMode={layoutMode}
          />
        )}

        {route.tab === "company" && (
          <CompanyRouter route={route} navigate={navigate} userId={auth.user?.id ?? null} company={company} />
        )}

        {route.tab === "myRequests" && (
          <MyRequestsPage auth={auth} navigate={navigate} activeCompanyId={company.activeCompanyId} />
        )}

        {route.tab === "admin" && (
          <Suspense fallback={<LoadingState className="mt-6" />}>
            <AdminRoot route={route} navigate={navigate} layoutMode={layoutMode} auth={auth} />
          </Suspense>
        )}

        {/* Open-project banner + Save -- only shown while editing a saved project */}
        {route.tab === "estimator" && openProject && (
          <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 px-4 py-3`}>
            <span className="text-sm font-semibold" style={{ color: NAVY }}>Editing project: {openProject.name}</span>
            <div className="flex items-center gap-3">
              {saveProjectError && <span className="text-sm text-red-600 dark:text-red-400">{saveProjectError}</span>}
              <Button onClick={saveOpenProject} disabled={savingProject}>{savingProject ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        )}

        {/* Save-as-project banner -- only shown while there's no saved project open */}
        {route.tab === "estimator" && !openProject && (
          <SaveDraftBanner onSave={saveDraftAsProject} />
        )}

        {/* System configuration + calculator body */}
        {route.tab === "estimator" && (
          isExt ? (
            <ExternalCalculator store={store} orient={orient} dimUnit={dimUnit} setDimUnit={switchDimUnit}
              systemSelector={<SystemRows orient={orient} switchOrient={switchOrient} isExt={isExt} switchSystem={switchSystem} findSys={findSys} />}
              layoutMode={layoutMode}
              mode={mode} setMode={setMode}
            />
          ) : (
            <InternalCalculator
              store={store} orient={orient} dimUnit={dimUnit} setDimUnit={switchDimUnit}
              systemSelector={<SystemRows orient={orient} switchOrient={switchOrient} isExt={isExt} switchSystem={switchSystem} findSys={findSys} />}
              layoutMode={layoutMode}
              mode={mode} setMode={setMode}
              showWall={showWall} setShowWall={setShowWall}
              linkCornerPartner={linkCornerPartner} linkShaftPartner={linkShaftPartner}
              projectName={openProject?.name}
              onAddExternalWall={addExternalWall}
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
