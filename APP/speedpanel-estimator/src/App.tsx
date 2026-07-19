import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { useLayoutMode } from "./useLayoutMode";
import { useThemeMode } from "./useThemeMode";
import { useAuth } from "./lib/useAuth";
import { useCompanyMemberships } from "./lib/useCompanyMemberships";
import { useWallStore } from "./wallStore";
import { NAVY } from "./styleTokens";
import { IconButton } from "./ui/primitives";
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
import { OrderEntryPage } from "./pages/order/OrderEntryPage";
import { saveProjectSnapshot } from "./pages/projects/saveProjectSnapshot";
import { insertProject, seedSnapshotForSystem, useProjects } from "./pages/projects/projectsStore";
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

// Comparable "have the wall-relevant fields changed" key for a saved
// project -- used to drive the top card's "Unsaved changes"/"All changes
// saved" indicator (see openProject/projectDirty below). Deliberately only
// the fields saveOpenProject() actually persists (matches its own snapshot
// shape exactly), not the wider SavedProjectData/ProjectRow shape, so
// unrelated fields (id, name, timestamps, optional metadata) can't cause a
// false "unsaved changes" reading.
function snapshotKey(d: {
  v: number; walls: unknown; activeId: number; nextId: number;
  projectStock: string; projectLock: boolean; customLengthInput: string; customActive: boolean;
  system: string; dimUnit: string;
}): string {
  return JSON.stringify([
    d.v, d.walls, d.activeId, d.nextId, d.projectStock, d.projectLock, d.customLengthInput, d.customActive,
    d.system, d.dimUnit,
  ]);
}

// --- Main app -----------------------------------------------------------------
export default function SpeedpanelEstimator() {
  const savedSession = loadSession();
  const [system, setSystem] = useState(() => savedSession ? savedSession.system : "int-vert");
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
  const [openProject, setOpenProject] = useState<{ id: string; name: string; updatedAt: string } | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [saveProjectError, setSaveProjectError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingCreationError, setPendingCreationError] = useState<string | null>(null);

  // Persist the current view on change (skipped while a saved project is open).
  useEffect(() => {
    if (openProject) return;
    saveSession({ v: 1, system, dimUnit });
  }, [system, dimUnit, openProject]);

  const sys    = SYSTEMS.find(s => s.id === system) || SYSTEMS[0];
  const isExt  = sys.ext;

  // Single SHARED wall store (persisted); the Internal and External calculators
  // each independently destructure/compute what they need from it, so walls
  // survive switching in/out of External mode and between orientations.
  const store = useWallStore({ dimUnit, persistLocally: !openProject });
  const { active, resetWalls, clearCustomLength, loadFrom, exportSnapshot } = store;
  // Orientation is per-wall (see Wall.orient) -- this is the ACTIVE wall's own
  // orientation, used only to drive which fields/selectors are shown for it.
  // It must never be applied to every wall (that was the combined-estimate bug).
  const orient = active.orient;

  // Whether the open saved project has edits since it was opened/last saved
  // -- autosave is off while a saved project is open (see persistLocally
  // above), so this drives the top card's "Unsaved changes"/"All changes
  // saved" indicator next to the explicit Save button. Meaningless (and
  // unused) while there's no open project.
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const [projectDirty, setProjectDirty] = useState(false);
  useEffect(() => {
    if (!openProject) { setProjectDirty(false); return; }
    const current = snapshotKey({ ...exportSnapshot(), system, dimUnit });
    setProjectDirty(current !== lastSavedSnapshotRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openProject, store.walls, store.activeId, store.nextId, store.projectStock, store.projectLock, store.customLengthInput, store.customActive, system, dimUnit]);

  const { linkCornerPartner, linkShaftPartner, switchOrient } = useCornerShaftLinking(store);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  // Deliberate "start over": reset the shared store + view, and close any
  // open saved project (a fresh device-local scratch project, not that
  // project, is what "start over" should mean). The persistence effects
  // immediately re-save the clean default, so a later reload stays clear.
  const resetAll = () => {
    setConfirmReset(false);
    resetWalls(); setSystem("int-vert"); setDimUnit("m"); setOpenProject(null);
  };
  // Switching system no longer clears walls -- the shared store is preserved
  // across every orientation/wall-type change.
  const switchSystem = (id: string) => { setSystem(id); };
  const findSys = (orientVal: "vertical" | "horizontal", ext: boolean) =>
    SYSTEMS.find(s => s.orient === orientVal && s.ext === ext)!;
  // Phone SystemConfigSectionPhone's "Wall type -> External" segment: mirrors
  // SystemRows' real "Wall type" toggle exactly (see systemRows.tsx), without
  // adding a wall -- there's no per-wall internal/external flag, External-
  // ness is a project-level system choice (see isExt above).
  const switchToExternal = () => switchSystem(findSys(orient, true).id);
  // Mirror image, for External's own phone System configuration
  // "Wall type -> Internal" segment.
  const switchToInternal = () => switchSystem(findSys(orient, false).id);

  // Opening a saved project from Projects loads its snapshot into the shared
  // wall store/view state and switches to the Estimator tab -- the builder UI
  // itself is the existing InternalCalculator/ExternalCalculator, not a
  // separate copy (see wallStore.ts's loadFrom).
  const openProjectInEstimator = (project: ProjectRow) => {
    loadFrom(project.data);
    setSystem(project.data.system);
    setDimUnit(project.data.dimUnit);
    setOpenProject({ id: project.id, name: project.name, updatedAt: project.updated_at });
    setSaveProjectError(null);
    lastSavedSnapshotRef.current = snapshotKey(project.data);
    setProjectDirty(false);
    navigate({ tab: "estimator" });
  };

  const saveOpenProject = async () => {
    if (!openProject) return;
    setSavingProject(true);
    setSaveProjectError(null);
    const snapshot: SavedProjectData = { ...exportSnapshot(), system, dimUnit };
    const err = await saveProjectSnapshot(openProject.id, snapshot);
    setSavingProject(false);
    if (err) setSaveProjectError(err);
    else {
      // saveProjectSnapshot doesn't return the updated row -- optimistically
      // stamp "now" for the top card's "Last edited" display; Supabase's own
      // updated_at is refreshed server-side regardless, and self-corrects next
      // time this project is (re)loaded.
      setOpenProject(p => p ? { ...p, updatedAt: new Date().toISOString() } : p);
      lastSavedSnapshotRef.current = snapshotKey(snapshot);
      setProjectDirty(false);
    }
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
    const snapshot: SavedProjectData = { ...exportSnapshot(), system, dimUnit };
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

  // Avoid flashing the sign-in screen at an already-signed-in visitor while
  // the session is still resolving on first load -- same auth.loading guard
  // ProjectsRouter.tsx already uses for its own sign-in gate.
  if (auth.loading) {
    return <LoadingState className="mt-16" />;
  }

  // Signed-out front door -- the whole portal requires a session (no tab is
  // usable anonymously, including the Estimator/System Selector/Education
  // Hub sandbox tools), so this now gates every tab, not just Home. Full-
  // bleed sign-in/sign-up screen, no TopNav/app chrome, same reasoning as
  // proforma below. The signed-in case (OverviewDashboardPage etc.) stays
  // inside the normal shell further down.
  if (!auth.session) {
    return <LandingPage auth={auth} pendingNote={pendingProjectCreation ? `Sign in to create "${pendingProjectCreation.name}"` : undefined} />;
  }

  // Standalone printable document -- no TopNav/app chrome at all, simpler
  // than fighting print CSS to hide it. Rendered as an alternate branch of
  // this same return (not an early return above) so every hook this
  // component calls still runs in the same order on every render.
  if (route.tab === "proforma") {
    return <ProformaInvoicePage orderId={route.orderId} onBack={() => navigate({ tab: "estimator" })} />;
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
          below so it spans edge to edge. Plain hairline bottom border,
          not the brand gradient line this used to have. */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 backdrop-blur dark:bg-slate-950/95">
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

        {route.tab === "order" && <OrderEntryPage />}

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

        {/* System configuration + calculator body -- EstimateTopCard (inside
            each Calculator) now renders the save-draft/editing-project
            controls that used to live here as standalone banners. */}
        {route.tab === "estimator" && (
          isExt ? (
            <ExternalCalculator store={store} orient={orient} dimUnit={dimUnit} setDimUnit={switchDimUnit}
              systemSelector={<SystemRows orient={orient} switchOrient={switchOrient} isExt={isExt} switchSystem={switchSystem} findSys={findSys} />}
              layoutMode={layoutMode}
              switchOrient={switchOrient} switchToInternal={switchToInternal}
              openProject={openProject} draftLabel={store.draftLabel} onSetDraftLabel={store.setDraftLabel}
              lastEditedAt={store.lastEditedAt}
              onSaveDraftAsProject={saveDraftAsProject} onSaveOpenProject={saveOpenProject}
              savingProject={savingProject} saveProjectError={saveProjectError} projectDirty={projectDirty}
              onGoToProjects={() => navigate({ tab: "projects" })}
            />
          ) : (
            <InternalCalculator
              store={store} orient={orient} dimUnit={dimUnit} setDimUnit={switchDimUnit}
              systemSelector={<SystemRows orient={orient} switchOrient={switchOrient} isExt={isExt} switchSystem={switchSystem} findSys={findSys} />}
              layoutMode={layoutMode}
              linkCornerPartner={linkCornerPartner} linkShaftPartner={linkShaftPartner}
              switchOrient={switchOrient} switchToExternal={switchToExternal}
              openProject={openProject} draftLabel={store.draftLabel} onSetDraftLabel={store.setDraftLabel}
              lastEditedAt={store.lastEditedAt}
              onSaveDraftAsProject={saveDraftAsProject} onSaveOpenProject={saveOpenProject}
              savingProject={savingProject} saveProjectError={saveProjectError} projectDirty={projectDirty}
              onGoToProjects={() => navigate({ tab: "projects" })}
            />
          )
        )}

        {route.tab === "estimator" && (
          <div className="mt-8 flex gap-3 rounded-xl border border-amber-200 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-900/50 px-4 py-3.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-300" />
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
              By using this calculator you acknowledge quantities are estimates only and you will not hold Speedpanel liable for over- or under-ordering. Does not confirm compliance, FRL, engineering, restraint, certification or approval.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
