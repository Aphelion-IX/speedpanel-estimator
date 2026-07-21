// =============================================================================
// Calculator (shared -- src/calculator/)
// =============================================================================
// The unified estimator: every wall in the store picks its own Internal/
// External application (see wallDomain.ts's Wall.application), computed via
// compute()/computeExternal() dispatch (wallStore.ts's useWallResults) and
// combined via aggregateProject() into { internal, external, combined }
// (aggregateProject.ts). Shares the same wall store the whole app uses, so
// walls survive orientation changes and never get discarded switching
// between applications. Always renders the combined project view
// (single-wall-only mode was retired -- see git history for the old
// EstimateModeSelector toggle).
//
// Per-wall dispatch on `active.application` happens at several leaf call
// sites below (WallsCard's showTypes, the product card's colour section vs.
// panel-length stock table, SpanTable's fixed-vs-looked-up C-track section,
// EdgeRestraintSelector's Internal-only track-finish/locked-edges pieces) --
// each one is a single flag read, not a fork of this component, since
// wallsCard.tsx/wallConfig.tsx already carry both sides' pieces as a
// superset (see docs/unified-estimator-merge-plan.md's Phase 4 research).
// Corner/Shaft kit logic (synthesizeKits/computeCornerPair/computeShaftPair)
// needs no such dispatch -- kits are inherently Internal-only, since
// wallStore.ts's createCornerPair/createShaftPair/convertActiveTo* always
// set application: "internal" regardless of what triggered them.
//
// Formerly internalCalculator/InternalCalculator.tsx +
// externalCalculator/ExternalCalculator.tsx.
// =============================================================================
import { useState, useEffect, useMemo, useRef } from "react";
import { Link2 } from "lucide-react";
import { cx, tone } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { aggregateProject } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { computeCornerPair, computeShaftPair } from "../estimate/cornerShaftKits";
import { synthesizeKits } from "../estimate/synthesizeKits";
import type { SelectedNavItem } from "../estimate/navSelection";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, STOCK_LENGTHS, EXT_STOCK, INT_CONFIG } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { WarningsList, UnitToggle, CalculatorShell } from "../ui/primitives";
import { LockedDataInt, LockedDataExt, LockedDataFooter } from "../ui/lockedData";
import { PanelLengthSection } from "./lengthExplorer";
import { WallsCard } from "./wallsCard";
import { EstimateStructureNav } from "./estimateStructureNav";
import { EstimateSummarySidebar } from "./estimateSummarySidebar";
import { KitWorkspace } from "./kitWorkspace";
import { KitWorkspacePhone } from "./kitWorkspacePhone";
import { StickyBarTilesPhone } from "./phoneShell";
import { EstimateTopCard } from "./EstimateTopCard";
import type { OpenProjectInfo } from "./EstimateTopCard";
import { FirstWallSetup } from "./firstWallSetup";
import { isNoEstimate } from "../estimate/estimatorSession";
import { wouldLoseData } from "../estimate/validateWall";
import { ConfirmDialog, ErrorDialog } from "../ui/confirmDialog";
import { ReadOnlyBanner } from "../ui/readOnlyGate";
import "../ui/estimatorTheme.css";
import {
  SheetCardPhone, SheetSectionPhone, SystemConfigSectionPhone, GeometrySectionPhone,
  PanelLengthSectionPhone, TracksFlashingSectionPhone, WarningsListPhone,
} from "./phoneSections";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "./wallConfig";
import type { FinishKey, CornersField } from "./wallConfig";
import { WallPreviewSection } from "../ui/wallPreview";
import { PanelScheduleCard, PanelScheduleTable } from "../ui/scheduleCards";
import { EstimateResultsCard } from "./estimateResultsCard";
import { ProjectOrderSheet } from "./projectOrderSheet";
import { OrderReviewDrawer } from "./orderReviewDrawer";
import { buildReportData } from "../export/buildReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

export function Calculator({
  store, orient, dimUnit, setDimUnit, layoutMode,
  linkCornerPartner: rawLinkCornerPartner, linkShaftPartner: rawLinkShaftPartner,
  switchOrient,
  openProject, draftLabel, onSetDraftLabel, lastEditedAt,
  onSaveDraftAsProject, onSaveOpenProject, onSaveOpenProjectAsNew,
  savingProject, saveProjectError, saveProjectNotFound, projectDirty, onGoToProjects,
  readOnlyProject = false, offline = false,
}: {
  store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string;
  setDimUnit: (u: string) => void; layoutMode: EffectiveLayout;
  linkCornerPartner: (targetId: number | null) => void;
  linkShaftPartner: (targetId: number | null) => void;
  // App.tsx's guardedSwitchOrient -- threaded straight into both WallsCard's
  // (web) and SystemConfigSectionPhone's (phone) own Orientation segment, so
  // neither needs a shared standalone widget component for it.
  switchOrient: (o: "vertical" | "horizontal") => void;
  // EstimateTopCard's save-flow wiring -- lifted from App.tsx, which used to
  // render this as a standalone banner above the calculator (see
  // EstimateTopCard.tsx's header comment).
  openProject: OpenProjectInfo | null;
  draftLabel: string | null;
  onSetDraftLabel: (label: string | null) => void;
  lastEditedAt?: number;
  onSaveDraftAsProject: (name: string) => Promise<string | null>;
  onSaveOpenProject: () => Promise<void>;
  // Spec §11 "Project deleted while open" recovery action -- see App.tsx's
  // saveOpenProjectAsNew. Only ever offered once saveProjectNotFound is set.
  onSaveOpenProjectAsNew: () => Promise<void>;
  savingProject: boolean;
  saveProjectError: string | null;
  saveProjectNotFound: boolean;
  // Whether the open saved project has edits since it was opened/last saved
  // -- see App.tsx's projectDirty. Only meaningful (and only shown) once
  // openProject is set; harmless/ignored otherwise.
  projectDirty: boolean;
  onGoToProjects: () => void;
  // Spec §13 "Read-only access" -- see App.tsx's own readOnlyProject comment.
  // Gates the same mutation choke points Stage 3's incompatible-change guard
  // already funnels through (update, handleDeleteWall below), plus
  // add/duplicate/link/save, rather than threading a `disabled` prop through
  // every individual leaf input.
  readOnlyProject?: boolean;
  // Spec §11 "Offline or connection lost" -- see App.tsx's useOnlineStatus.
  // Gates the same save choke points as readOnlyProject (local wall edits
  // stay unaffected either way).
  offline?: boolean;
}) {
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  // EstimateTopCard's "View estimate details" link scrolls here rather than
  // navigating anywhere new -- no separate estimate-detail route exists.
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const {
    walls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update: rawUpdate, toDisp, updDim,
    setProjectLength, addBlankWall: rawAddBlankWall, addWallWithApplication: rawAddWallWithApplication, duplicateWall,
    duplicateWallById: rawDuplicateWallById, deleteWallById, resetWalls,
    commitCustomLength, toggleCustom, clearCustomLength,
    linkJunctionPartner: rawLinkJunctionPartner,
    convertActiveToCornerPair: rawConvertActiveToCornerPair, convertActiveToShaftPair: rawConvertActiveToShaftPair,
  } = store;

  const isInternal = active.application === "internal";

  // Spec §13 read-only access: "may not change wall data, links, or save" --
  // a no-op wrapper for every mutating store action, applied once here
  // rather than threading a `disabled` prop through each individual leaf
  // input (see Calculator's own readOnlyProject prop comment and
  // ui/readOnlyGate.tsx).
  function guard<A extends unknown[]>(fn: (...a: A) => void): (...a: A) => void {
    return readOnlyProject ? () => {} : fn;
  }
  const addBlankWall = guard(rawAddBlankWall);
  const addWallWithApplication = guard(rawAddWallWithApplication);
  const duplicateWallById = guard(rawDuplicateWallById);
  const linkJunctionPartner = guard(rawLinkJunctionPartner);
  const linkCornerPartner = guard(rawLinkCornerPartner);
  const linkShaftPartner = guard(rawLinkShaftPartner);
  const convertActiveToCornerPair = guard(rawConvertActiveToCornerPair);
  const convertActiveToShaftPair = guard(rawConvertActiveToShaftPair);

  // Spec §7.12/§7.14 changeWallApplication/changeWallSystem: "require
  // confirmation when data loss is possible" -- gated once here (rather than
  // at each of WallsCard's WallSystemSelector/SystemConfigSectionPhone's own
  // onChange handlers) since `update` is the single choke point every field
  // change in this component already flows through; wouldLoseData is a
  // no-op passthrough for any patch that doesn't touch orient/wallSystem, so
  // every OTHER existing update() call site (dimensions, name, panel type,
  // profile, etc.) is unaffected. Orientation's own vertical<->horizontal
  // toggle is gated separately, at the App.tsx level (see guardedSwitchOrient
  // there) -- it doesn't go through this update() at all for the web
  // SystemRows selector.
  const [pendingIncompatibleChange, setPendingIncompatibleChange] = useState<{ message: string; apply: () => void } | null>(null);
  const update = guard((patch: Partial<Wall>) => {
    if ("orient" in patch || "wallSystem" in patch || "application" in patch) {
      const message = wouldLoseData(active, patch);
      if (message) { setPendingIncompatibleChange({ message, apply: () => rawUpdate(patch) }); return; }
    }
    rawUpdate(patch);
  });

  // Same read-only guard as above, for the two save actions (spec §13:
  // "may not... save"), plus spec §11 "Offline": Save is a network call, so
  // it's gated the same way while offline -- everything else (wall editing)
  // stays live, since that's local-only regardless of connectivity.
  const saveBlocked = readOnlyProject || offline;
  const guardedSaveDraftAsProject = saveBlocked ? async () => null : onSaveDraftAsProject;
  const guardedSaveOpenProject = saveBlocked ? async () => {} : onSaveOpenProject;

  // Spec §7.10 deleteWall: "if it was the last wall, retain a Blank Draft
  // project" -- deleteWallById already no-ops on the last wall (a project
  // always keeps at least one wall, see wallStore.ts), so the UI-level
  // delete action for that case clears the wall back to blank (via the
  // existing whole-project resetWalls(), which is exactly "one blank wall"
  // when there's only ever been one) instead of silently doing nothing.
  const [confirmClearLastWall, setConfirmClearLastWall] = useState(false);
  const handleDeleteWall = guard((id: number) => {
    if (walls.length === 1) { setConfirmClearLastWall(true); return; }
    deleteWallById(id);
  });
  const handleDeleteActiveWall = () => handleDeleteWall(activeId);
  const { results, out, warnById } = useWallResults(walls, activeId);
  const kits = useMemo(() => synthesizeKits(walls, INT_CONFIG), [walls]);
  const [selectedNavItem, setSelectedNavItem] = useState<SelectedNavItem>({ type: "wall", wallId: activeId });
  useEffect(() => {
    setSelectedNavItem(prev =>
      prev.type === "kit" && kits.some(k => k.wallAId === prev.wallAId && k.wallBId === prev.wallBId)
        ? prev
        : { type: "wall", wallId: activeId }
    );
  }, [activeId, kits]);
  const handleSelectNavItem = (item: SelectedNavItem) => {
    setSelectedNavItem(item);
    if (item.type === "wall") setActiveId(item.wallId);
  };

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  const aggProject = useMemo(() => aggregateProject(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);
  // Rough "line item" count for the Review Order trigger/sticky bar -- stock
  // panel groups + custom-length groups, not every card's every row.
  const orderLineItemCount = aggProject.internal.panels.length + aggProject.internal.customPanels.length + aggProject.external.groups.length;
  const stickyProjectStats = [
    { value: `${aggProject.combined.totalArea} m2`, label: "Project area" },
    { value: aggProject.combined.totalPanels, label: "Panels" },
    { value: results.length, label: "Walls" },
  ];

  const cornerPair = useMemo(() => {
    if (orient !== "horizontal" || active.wallSystem !== "corner" || !active.cornerPartnerId) return null;
    const partner = walls.find(w => w.id === active.cornerPartnerId);
    if (!partner) return null;
    return computeCornerPair(active, partner, INT_CONFIG);
  }, [orient, active, walls]);

  const shaftPair = useMemo(() => {
    if (orient !== "horizontal" || active.wallSystem !== "shaft" || !active.shaftPartnerId) return null;
    const partner = walls.find(w => w.id === active.shaftPartnerId);
    if (!partner) return null;
    return computeShaftPair(active, partner, INT_CONFIG);
  }, [orient, active, walls]);

  const ScheduleComp = layoutMode === "web" ? PanelScheduleTable : PanelScheduleCard;

  // Corner/Shaft kit currently selected in the nav, if any -- resolved once
  // here since the KitWorkspace/WallsCard workspace branch below needs it.
  const selectedKit = selectedNavItem.type === "kit"
    ? kits.find(k => k.wallAId === selectedNavItem.wallAId && k.wallBId === selectedNavItem.wallBId) ?? null
    : null;

  // Renders as a full-width card carousel on web, a pill strip on phone (see
  // estimateStructureNav.tsx) -- directly under WallsCard/KitWorkspace in
  // webWorkspaceNode, and directly under SystemConfigSectionPhone/
  // KitWorkspacePhone in phoneWorkspaceNode below (both "system
  // configuration" for whichever layout is active).
  const wallNavNode = (
    <EstimateStructureNav
      walls={walls} results={results} kits={kits}
      selected={selectedNavItem} onSelect={handleSelectNavItem}
      warnById={warnById}
      addBlankWall={addBlankWall}
      addWallWithApplication={addWallWithApplication}
      duplicateWallById={duplicateWallById} deleteWallById={handleDeleteWall}
      layoutMode={layoutMode}
      dimUnit={dimUnit} toDisp={toDisp}
    />
  );

  // Rendered straight into .geometry-body's 2-column grid (see the section
  // comment by webWorkspaceNode below), so it needs exactly two top-level
  // children -- one per column: Profile/Dimensions/Span table stacked on
  // the left, Preview alone filling the full right column. ProfileSection
  // returns a bare fragment (its own label + ProfileSelector as separate
  // nodes, no wrapper) and WallPreviewSection returns a single div, so only
  // the left column needs its own wrapper div -- without it CSS Grid's
  // auto-placement would split ProfileSection's two nodes across row 1's
  // two columns on its own instead of treating them as one grid item.
  // firstWallSetup.tsx already wraps its own <ProfileSection> the same way.
  const geometryContent = (
    <>
      <div>
        <ProfileSection profile={active.profile} onChange={id => update({ profile: id })} />
        <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className={cx.cardHd} style={{marginBottom:0}}>Dimensions</span>
            <div className="flex items-center gap-2">
              <UnitToggle unit={dimUnit} setUnit={switchDimUnit} />
            </div>
          </div>
          <DimensionInputs active={active} toDisp={toDisp} updDim={updDim} out={out} orient={orient} walls={walls} />
          {/* External's C-track requirement is looked up from the generic
              span table (varies by width/height) -- Internal Standard/Corner
              walls use one fixed section regardless of size instead (see
              SpanTable's own branch in wallConfig.tsx). Passing wallSystem
              only for Internal walls is what selects between the two. */}
          <SpanTable orient={orient} type={active.type} wallSystem={isInternal ? active.wallSystem : undefined} />
        </div>
      </div>
      {/* geometryContent only ever renders on web (see its own comment
          above) -- phone has its own separate GeometrySectionPhone
          (phoneSections.tsx), which keeps the preview inline below
          Dimensions instead of splitting it into its own column. */}
      <WallPreviewSection active={active} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} />
    </>
  );
  const panelLengthContent = (
    <PanelLengthSection
      dimUnit={dimUnit} out={out} active={active} walls={walls}
      projectLock={projectLock} projectStock={projectStock}
      customLengthInput={customLengthInput} customActive={customActive}
      stocks={isInternal ? STOCK_LENGTHS : EXT_STOCK} packType={isInternal ? active.type : 78}
      update={update} setProjectLength={setProjectLength}
      commitCustomLength={commitCustomLength} toggleCustom={toggleCustom} clearCustomLength={clearCustomLength}
    />
  );
  // Standard-wall edges are locked by spec only for Internal (Corner/Shaft
  // are Internal-only concepts too, both horizontal-only) -- External always
  // leaves every edge freely toggleable, exactly as its own original
  // EdgeRestraintSelector call did.
  const edgesLocked = isInternal && orient === "horizontal" && active.wallSystem === "standard";
  const tracksContent = isInternal ? (
    <EdgeRestraintSelector
      edges={active.edges}
      onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
      options={[{ key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) }]}
      orient={orient}
      locked={edgesLocked}
      activeFinishes={{ headFinish: active.headFinish, bottomFinish: active.bottomFinish, leftFinish: active.leftFinish, rightFinish: active.rightFinish }}
      onFinishChange={(field, val) => update({ [field]: val } as Pick<Wall, FinishKey>)}
      corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
    />
  ) : (
    <EdgeRestraintSelector
      edges={active.edges}
      onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
      options={[{ key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) }]}
      orient={orient}
      corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
    />
  );
  // CollapsibleSection header badges -- a status summary visible even while
  // collapsed, echoing the "Estimate structure (N)" pattern already used in
  // the sidebar heading.
  const profileLabel = active.profile === "standard" ? "Standard" : active.profile === "rake" ? "Raked" : "Gable";

  // Hoisted above both workspace nodes so both the Summary sidebar's Export
  // button AND the Project Order Sheet (spec's Final Order Review) build
  // from the exact same report snapshot -- previously only handleExport
  // (defined further down, near mainNode) computed this.
  const reportData = useMemo(() => buildReportData({
    orient, dimUnit, toDisp, walls, results, warnById,
    aggProject, combinedEstimate,
  }), [orient, dimUnit, toDisp, walls, results, warnById, aggProject, combinedEstimate]);
  const hasExportData = aggProject.combined.totalPanels > 0;
  // Spec §11 "Excel export failed" -- exportEstimateToExcel dynamically
  // imports the xlsx library and triggers a browser download; either step
  // can throw (network hiccup fetching the chunk, popup/download blocked,
  // etc.), and unlike the Save flow this had no error handling at all.
  const [exportError, setExportError] = useState<string | null>(null);
  const handleExport = async () => {
    try { await exportEstimateToExcel(reportData); }
    catch { setExportError("The Excel export couldn't be generated. Please try again."); }
  };

  // Phone and web have genuinely different visual languages now (segmented
  // pill controls + one continuous "sheet" card on phone vs. the app's
  // generic button-grid cards on web, see phoneSections.tsx's header
  // comment), so the two are fully separate JSX trees below rather than one
  // shared tree with inline layoutMode checks -- easier to keep each correct
  // than a tangle of conditionals that differ in more than just wrapping.
  const phoneWorkspaceNode = (
    <>
      {selectedKit && (
        <>
          <SheetCardPhone>
            <SheetSectionPhone icon={<Link2 size={13} />} label="Connection workspace" noDivider>
              <KitWorkspacePhone kit={selectedKit} onSelect={handleSelectNavItem} />
            </SheetSectionPhone>
          </SheetCardPhone>
          {wallNavNode}
        </>
      )}
      {!selectedKit && (
        <>
          <SystemConfigSectionPhone
            walls={walls} active={active} update={update}
            duplicateWall={duplicateWall} deleteWall={handleDeleteActiveWall} orient={orient}
            onCornerLink={linkCornerPartner} onShaftLink={linkShaftPartner} onJunctionLink={linkJunctionPartner}
            switchOrient={switchOrient}
          />
          {wallNavNode}
          <GeometrySectionPhone
            active={active} update={update} toDisp={toDisp} updDim={updDim} out={out} orient={orient}
            walls={walls} dimUnit={dimUnit} switchDimUnit={switchDimUnit}
          />
          {/* One continuous card for these three -- matches the mockup's
              single `.sheet` wrapping Panel length/Tracks & flashing/
              Warnings as divider-separated `.sheet-section`s
              (speedpanel-estimator-phone-v5.html), rather than each getting
              its own separate floating card. Per-wall Schedule/Connections
              live in EstimateResultsCard's own Selected Wall/Connections/
              Order tabs below (in mainNode) -- Warnings here is just the
              project-level warnings list. */}
          <SheetCardPhone>
            <PanelLengthSectionPhone
              dimUnit={dimUnit} out={out} active={active} walls={walls}
              projectLock={projectLock} projectStock={projectStock}
              customLengthInput={customLengthInput} customActive={customActive}
              stocks={isInternal ? STOCK_LENGTHS : EXT_STOCK} packType={isInternal ? active.type : 78}
              update={update} setProjectLength={setProjectLength}
              commitCustomLength={commitCustomLength} toggleCustom={toggleCustom} clearCustomLength={clearCustomLength}
            />
            <TracksFlashingSectionPhone active={active} update={update} orient={orient} />
            <SheetSectionPhone label="Warnings" noDivider
              badge={<span className={`${cx.badge} ${tone(out.empty || out.warnings.length === 0 ? "neutral" : "danger")}`}>{out.empty ? 0 : out.warnings.length}</span>}>
              <WarningsListPhone warnings={!out.empty ? out.warnings : null} />
            </SheetSectionPhone>
          </SheetCardPhone>
        </>
      )}
    </>
  );

  // Ported to the mockup's `.workspace` 3-column grid (ui/estimatorTheme.css)
  // -- structure nav | main-column (config/geometry/product cards for
  // whichever wall or kit is selected) | sticky summary sidebar. The old
  // CollapsibleSection accordion pairing (Wall geometry / Tracks and
  // flashing) is gone here -- the mockup's own main-column shows every card
  // always-expanded, not collapsed behind an accordion trigger.
  const webWorkspaceNode = (
    <div className="workspace">
      {wallNavNode}
      <div className="main-column">
        {selectedKit ? (
          <KitWorkspace kit={selectedKit} onSelect={handleSelectNavItem} />
        ) : (
          <>
            <WallsCard
              walls={walls}
              active={active} update={update}
              duplicateWall={duplicateWall} deleteWall={handleDeleteActiveWall}
              showTypes={isInternal} orient={orient} switchOrient={switchOrient}
              onCornerLink={linkCornerPartner}
              onShaftLink={linkShaftPartner}
              onJunctionLink={linkJunctionPartner}
            />

            <section className="card geometry-card">
              <div className="card-hd">
                <div className="section-title"><span className="dot" /><span>Wall geometry</span></div>
                <span className="pill blue">{profileLabel} profile</span>
              </div>
              <div className="geometry-body">
                {geometryContent}
              </div>
            </section>

            <section className="card product-card">
              <div className="card-hd">
                <div className="section-title"><span className="dot" /><span>Panel length &amp; materials</span></div>
                <span className="pill cyan">Project stock {projectLock ? "enabled" : "disabled"}</span>
              </div>
              <div className="product-body">
                <div className="stock-col">{panelLengthContent}</div>
                <div className="materials-col">{tracksContent}</div>
              </div>
            </section>

            <WarningsList warnings={!out.empty ? out.warnings : null} />
          </>
        )}
      </div>
      <EstimateSummarySidebar
        walls={walls} results={results} kits={kits} out={out}
        aggProject={aggProject}
        onReviewOrder={() => setOrderDrawerOpen(true)}
        onExport={handleExport} exportDisabled={!hasExportData}
      />
    </div>
  );

  const workspaceNode = layoutMode === "phone" ? phoneWorkspaceNode : webWorkspaceNode;

  const orderSheetRef = useRef<HTMLDivElement>(null);
  const scrollToOrderSheet = () => orderSheetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const mainNode = (
    <div ref={resultsRef}>
      {workspaceNode}

      {/* Estimate Results: Overview / Selected Wall / Connections / Order tabs */}
      <ProjectSeparator />
      <EstimateResultsCard
        layoutMode={layoutMode} results={results} walls={walls} kits={kits}
        aggProject={aggProject} combinedEstimate={combinedEstimate}
        active={active} out={out} orient={orient} cornerPair={cornerPair} shaftPair={shaftPair}
        ScheduleComp={ScheduleComp}
      />

      {/* Final Order Review / Project Order Sheet -- anchor target for
          EstimateTopCard's order-jump banner (onViewOrder) and the Order
          Review drawer/sticky bar's "Review order" actions alike. */}
      <div ref={orderSheetRef} className="scroll-mt-4">
        <ProjectOrderSheet
          layoutMode={layoutMode} projectName={openProject ? openProject.name : (draftLabel ?? "")}
          results={results} kits={kits} aggProject={aggProject} combinedEstimate={combinedEstimate}
          reportData={reportData} onExportExcel={handleExport} exportDisabled={!hasExportData}
        />
      </div>
    </div>
  );
  const footerNode = isInternal ? (
    <LockedDataFooter title="Locked system data" table={<LockedDataInt />} onExport={handleExport} disabled={!hasExportData} />
  ) : (
    <LockedDataFooter title="Locked external system data" table={<LockedDataExt />} onExport={handleExport} disabled={!hasExportData} />
  );

  const orderDrawerNode = (
    <OrderReviewDrawer
      open={orderDrawerOpen} onClose={() => setOrderDrawerOpen(false)} layoutMode={layoutMode}
      aggProject={aggProject} combinedEstimate={combinedEstimate} results={results} kits={kits}
      reportData={reportData} projectName={openProject ? openProject.name : (draftLabel ?? "")}
      onExport={handleExport} exportDisabled={!hasExportData}
    />
  );
  // Mobile-only sticky summary bar.
  const stickyBarNode = layoutMode === "phone" && (
    <StickyBarTilesPhone
      stats={stickyProjectStats}
      onReviewOrder={() => setOrderDrawerOpen(true)} lineItemCount={orderLineItemCount}
    />
  );
  // Unconditional now (used to be phone-only) -- see EstimateTopCard.tsx's
  // header comment for why it now also covers the web layout's top-of-page
  // slot, in place of App.tsx's old standalone save-draft/editing-project
  // banners. Renders FirstWallSetup instead while the store's single seeded
  // wall is still fully blank and no saved project is open (spec's "No
  // Project" state -- see estimatorSession.ts's isNoEstimate/design call).
  const topCardNode = isNoEstimate(results, kits) ? (
    <FirstWallSetup
      active={active} update={update}
      convertActiveToCornerPair={convertActiveToCornerPair} convertActiveToShaftPair={convertActiveToShaftPair}
      draftLabel={draftLabel} onSetDraftLabel={onSetDraftLabel}
      onDuplicateDraft={duplicateWall} onGoToProjects={onGoToProjects}
    />
  ) : (
    <EstimateTopCard
      results={results} kits={kits} aggProject={aggProject}
      openProject={openProject} draftLabel={draftLabel} onSetDraftLabel={onSetDraftLabel}
      lastEditedAt={lastEditedAt}
      onSaveDraftAsProject={guardedSaveDraftAsProject} onSaveOpenProject={guardedSaveOpenProject}
      onSaveOpenProjectAsNew={onSaveOpenProjectAsNew}
      savingProject={savingProject} saveProjectError={saveProjectError} saveProjectNotFound={saveProjectNotFound}
      offline={offline} projectDirty={projectDirty}
      onGoToProjects={onGoToProjects} onViewDetails={scrollToResults} onViewOrder={scrollToOrderSheet}
    />
  );

  const dialogsNode = (
    <>
      <ConfirmDialog
        open={pendingIncompatibleChange !== null}
        danger
        title="This change will remove a link"
        description={pendingIncompatibleChange?.message ?? ""}
        confirmLabel="Continue"
        onConfirm={() => { pendingIncompatibleChange?.apply(); setPendingIncompatibleChange(null); }}
        onCancel={() => setPendingIncompatibleChange(null)}
      />
      <ConfirmDialog
        open={confirmClearLastWall}
        danger
        title="Delete the last wall"
        description="A project always keeps at least one wall to configure, so this wall won't be removed entirely -- it will be cleared back to a blank draft instead."
        confirmLabel="Clear wall"
        onConfirm={() => { resetWalls(); setConfirmClearLastWall(false); }}
        onCancel={() => setConfirmClearLastWall(false)}
      />
      <ErrorDialog message={exportError} onDismiss={() => setExportError(null)} />
    </>
  );

  const readOnlyBannerNode = readOnlyProject && <div className="mt-3">{<ReadOnlyBanner />}</div>;

  if (layoutMode === "phone") return <div className="est-shell">{dialogsNode}{readOnlyBannerNode}{topCardNode}{mainNode}{footerNode}{stickyBarNode}{orderDrawerNode}</div>;
  return (
    <div className="est-shell">
      {dialogsNode}
      {readOnlyBannerNode}
      {topCardNode}
      <CalculatorShell main={mainNode} footer={footerNode} />
      {orderDrawerNode}
    </div>
  );
}
