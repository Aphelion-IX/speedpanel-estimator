// =============================================================================
// External Calculator
// =============================================================================
// orient is derived from sys.orient in the parent and passed as a prop. The
// wall list comes from the shared `store` (owned by the root component) so
// it survives switching in/out of External mode. orient stays in
// useWallResults' dependency array to prevent stale compute if this
// component is kept mounted across orientation switches.
//
// Always renders the combined project view (single-wall-only mode was
// retired -- previously this toggled via a shared `mode` variable lifted
// from App.tsx; see git history for the old EstimateModeSelector toggle).
//
// Phone and web are fully separate JSX trees below (phoneWorkspaceNode vs
// webWorkspaceNode), mirroring internalCalculator/InternalCalculator.tsx --
// phone gets its own forked visual language (SegPhone segmented controls,
// EdgeGridPhone tinted edge toggles, one continuous SheetCardPhone instead
// of separate CollapsibleSection accordions, a ProjectCardPhone + pill-strip
// nav), web is untouched.
// =============================================================================
import { useState, useMemo, useRef } from "react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { buildExtProjAgg } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, EXT_STOCK, EXT_STOCKED_COLOURS } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { WarningsList, UnitToggle, CalculatorShell } from "../ui/primitives";
import { LockedDataExt, LockedDataFooter } from "../ui/lockedData";
import { PanelLengthSection } from "./lengthExplorer";
import { WallsCard } from "../calculator/wallsCard";
import { EstimateStructureNav } from "./estimateStructureNav";
import { EstimateSummarySidebar } from "./estimateSummarySidebar";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "../calculator/wallConfig";
import type { CornersField } from "../calculator/wallConfig";
import { WallPreviewSection } from "../ui/wallPreview";
import { PanelScheduleCard, PanelScheduleTable } from "../ui/scheduleCards";
import { PanelColourSection } from "../calculator/panelColourSection";
import { EstimateResultsCard } from "./estimateResultsCard";
import { ProjectOrderSheet } from "./projectOrderSheet";
import { OrderReviewDrawer } from "./orderReviewDrawer";
import { StickyBarTilesPhone } from "./phoneShell";
import { EstimateTopCard } from "./EstimateTopCard";
import type { OpenProjectInfo } from "./EstimateTopCard";
import { FirstWallSetup } from "./firstWallSetup";
import { isNoEstimate } from "../estimate/estimatorSession";
import { ConfirmDialog, ErrorDialog } from "../ui/confirmDialog";
import { ReadOnlyBanner } from "../ui/readOnlyGate";
import "../ui/estimatorTheme.css";
import {
  SheetCardPhone, SheetSectionPhone, SystemConfigSectionPhone, GeometrySectionPhone,
  PanelLengthSectionPhone, TracksFlashingSectionPhone, WarningsListPhone,
} from "./phoneSections";
import { buildExternalReportData } from "../export/buildExternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

export function ExternalCalculator({
  store, orient, dimUnit, setDimUnit, systemSelector, layoutMode,
  switchOrient, switchToInternal,
  openProject, draftLabel, onSetDraftLabel, lastEditedAt,
  onSaveDraftAsProject, onSaveOpenProject, onSaveOpenProjectAsNew,
  savingProject, saveProjectError, saveProjectNotFound, projectDirty, onGoToProjects,
  readOnlyProject = false, offline = false,
}: {
  store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string;
  setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout;
  // Phone-only SystemConfigSectionPhone's Orientation/Wall type segments --
  // same store/App.tsx wiring web's SystemRows uses, just threaded straight
  // through instead of via the opaque systemSelector render-prop, so the
  // phone-only restyle doesn't need to branch inside the shared SystemRows
  // component (see internalCalculator/phoneSections.tsx's header comment --
  // same reasoning applies here).
  switchOrient: (o: "vertical" | "horizontal") => void;
  switchToInternal: () => void;
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
  // Spec §13 "Read-only access" -- see App.tsx's own readOnlyProject
  // comment and internalCalculator/InternalCalculator.tsx's mirror of this
  // same prop.
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
    setProjectLength, addBlankWall: rawAddBlankWall, duplicateWall,
    duplicateWallById: rawDuplicateWallById, deleteWallById, resetWalls,
    commitCustomLength, toggleCustom, clearCustomLength,
    linkJunctionPartner: rawLinkJunctionPartner,
  } = store;
  const { results, out, warnById } = useWallResults(walls, activeId);

  // Spec §13 read-only access: "may not change wall data, links, or save" --
  // a no-op wrapper for every mutating store action, applied once here
  // rather than threading a `disabled` prop through each individual leaf
  // input (see InternalCalculator.tsx's identical pattern and ui/
  // readOnlyGate.tsx).
  function guard<A extends unknown[]>(fn: (...a: A) => void): (...a: A) => void {
    return readOnlyProject ? () => {} : fn;
  }
  const addBlankWall = guard(rawAddBlankWall);
  const duplicateWallById = guard(rawDuplicateWallById);
  const linkJunctionPartner = guard(rawLinkJunctionPartner);
  // External has no wallSystem/Corner/Shaft concept, so unlike Internal's
  // update() this never needs a wouldLoseData incompatible-change check --
  // just the read-only guard.
  const update = guard(rawUpdate);

  const [confirmClearLastWall, setConfirmClearLastWall] = useState(false);
  const handleDeleteWall = guard((id: number) => {
    if (walls.length === 1) { setConfirmClearLastWall(true); return; }
    deleteWallById(id);
  });
  const handleDeleteActiveWall = () => handleDeleteWall(activeId);

  // Spec §11 "Offline": Save is a network call, so it's gated the same way
  // while offline -- everything else (wall editing) stays live, since that's
  // local-only regardless of connectivity.
  const saveBlocked = readOnlyProject || offline;
  const guardedSaveDraftAsProject = saveBlocked ? async () => null : onSaveDraftAsProject;
  const guardedSaveOpenProject = saveBlocked ? async () => {} : onSaveOpenProject;

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  const projAgg  = useMemo(() => buildExtProjAgg(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);
  const orderLineItemCount = projAgg.groups.length;

  const edgeOptions = [
    { key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) },
  ];

  const ScheduleComp = layoutMode === "web" ? PanelScheduleTable : PanelScheduleCard;

  const stickyProjectStats = [
    { value: `${projAgg.totalArea} m2`, label: "Project area" },
    { value: projAgg.panels, label: "Panels" },
    { value: results.length, label: "Walls" },
  ];

  // Renders as a full-width card carousel on web, a pill strip on phone (see
  // estimateStructureNav.tsx) -- directly under WallsCard in webWorkspaceNode,
  // and directly under SystemConfigSectionPhone in phoneWorkspaceNode below
  // (both "system configuration" for whichever layout is active).
  const wallNavNode = (
    <EstimateStructureNav
      walls={walls} results={results} activeId={activeId} onSelectWall={setActiveId}
      warnById={warnById} addBlankWall={addBlankWall}
      duplicateWallById={duplicateWallById} deleteWallById={handleDeleteWall}
      layoutMode={layoutMode}
      dimUnit={dimUnit} toDisp={toDisp}
    />
  );

  // Shared with web only -- phone builds its own separate components below
  // (see phoneWorkspaceNode), same split InternalCalculator.tsx uses.
  const geometryContent = (
    <>
      <ProfileSection profile={active.profile} onChange={id => update({ profile: id })} />
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className={cx.cardHd} style={{marginBottom:0}}>Dimensions</span>
          <div className="flex items-center gap-2">
            <UnitToggle unit={dimUnit} setUnit={switchDimUnit} />
          </div>
        </div>
        <DimensionInputs active={active} toDisp={toDisp} updDim={updDim} out={out} orient={orient} />
        {/* geometryContent only ever renders on web (see its own comment
            above) -- phone has its own separate GeometrySectionPhone
            (phoneSections.tsx), which now also always shows the preview
            inline below Dimensions, matching this. */}
        <WallPreviewSection active={active} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} />
        <SpanTable orient={orient} type={78} />
      </div>
    </>
  );
  const panelLengthContent = (
    <PanelLengthSection
      dimUnit={dimUnit} out={out} active={active} walls={walls}
      projectLock={projectLock} projectStock={projectStock}
      customLengthInput={customLengthInput} customActive={customActive}
      stocks={EXT_STOCK} packType={78}
      update={update} setProjectLength={setProjectLength}
      commitCustomLength={commitCustomLength} toggleCustom={toggleCustom} clearCustomLength={clearCustomLength}
    />
  );
  const tracksContent = (
    <EdgeRestraintSelector
      edges={active.edges}
      onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
      options={edgeOptions}
      orient={orient}
      corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
    />
  );
  // product-card header pill -- a status summary of the selected wall's
  // panel colour, echoing the "Estimate structure (N)" pattern already used
  // in the sidebar heading.
  const profileLabel = active.profile === "standard" ? "Standard" : active.profile === "rake" ? "Raked" : "Gable";
  const isCustomColour = active.colourType === "special";
  const colourName = !isCustomColour && active.colour ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour)?.label ?? "" : "";
  const panelBadge = isCustomColour ? "Custom" : colourName || "No colour";

  // Hoisted above both workspace nodes so both the Summary sidebar's Export
  // button AND the Project Order Sheet (spec's Final Order Review) build
  // from the exact same report snapshot.
  const reportData = useMemo(() => buildExternalReportData({
    orient, dimUnit, toDisp, walls, results, warnById, projAgg, combinedEstimate,
  }), [orient, dimUnit, toDisp, walls, results, warnById, projAgg, combinedEstimate]);
  const hasExportData = projAgg.panels > 0;
  // Spec §11 "Excel export failed" -- exportEstimateToExcel dynamically
  // imports the xlsx library and triggers a browser download; either step
  // can throw (network hiccup fetching the chunk, popup/download blocked,
  // etc.), and this had no error handling at all.
  const [exportError, setExportError] = useState<string | null>(null);
  const handleExport = async () => {
    try { await exportEstimateToExcel(reportData); }
    catch { setExportError("The Excel export couldn't be generated. Please try again."); }
  };

  const phoneWorkspaceNode = (
    <>
      <SystemConfigSectionPhone
        walls={walls} active={active} update={update}
        duplicateWall={duplicateWall} deleteWall={handleDeleteActiveWall} orient={orient}
        onJunctionLink={linkJunctionPartner}
        switchOrient={switchOrient} switchToInternal={switchToInternal}
      />
      {wallNavNode}
      <GeometrySectionPhone
        active={active} update={update} toDisp={toDisp} updDim={updDim} out={out} orient={orient}
        walls={walls} dimUnit={dimUnit} switchDimUnit={switchDimUnit}
      />
      <PanelLengthSectionPhone
        dimUnit={dimUnit} out={out} active={active} walls={walls}
        projectLock={projectLock} projectStock={projectStock}
        customLengthInput={customLengthInput} customActive={customActive}
        stocks={EXT_STOCK} packType={78}
        update={update} setProjectLength={setProjectLength}
        commitCustomLength={commitCustomLength} toggleCustom={toggleCustom} clearCustomLength={clearCustomLength}
      />
      <TracksFlashingSectionPhone active={active} update={update} />

      {/* Per-wall Schedule/Connections/Warnings live in EstimateResultsCard's
          own Selected Wall/Connections/Order tabs below (in mainNode) --
          this is just the project-level warnings list. */}
      <SheetCardPhone>
        <SheetSectionPhone label="Warnings" noDivider>
          <WarningsListPhone warnings={!out.empty ? out.warnings : null} />
        </SheetSectionPhone>
      </SheetCardPhone>
    </>
  );

  // Ported to the mockup's `.workspace` 3-column grid (ui/estimatorTheme.css)
  // -- structure nav | main-column (config/geometry/product cards for the
  // selected wall) | sticky summary sidebar. Mirrors InternalCalculator.tsx's
  // own restructure -- see its comment for why the old CollapsibleSection
  // accordion pairing is gone.
  const webWorkspaceNode = (
    <div className="workspace">
      {wallNavNode}
      <div className="main-column">
        <WallsCard
          walls={walls}
          active={active} update={update}
          duplicateWall={duplicateWall} deleteWall={handleDeleteActiveWall}
          systemSelector={systemSelector}
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
            <div className="section-title"><span className="dot" /><span>Panel colour &amp; materials</span></div>
            <span className="pill cyan">{panelBadge}</span>
          </div>
          <div className="product-body">
            <div className="stock-col">
              <PanelColourSection active={active} update={update} />
              {panelLengthContent}
            </div>
            <div className="materials-col">{tracksContent}</div>
          </div>
        </section>

        <WarningsList warnings={!out.empty ? out.warnings : null} />
      </div>
      <EstimateSummarySidebar
        results={results} out={out} projAgg={projAgg}
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

      <ProjectSeparator />
      <EstimateResultsCard
        layoutMode={layoutMode} results={results}
        projAgg={projAgg} combinedEstimate={combinedEstimate}
        active={active} out={out} orient={orient} ScheduleComp={ScheduleComp}
      />

      {/* Final Order Review / Project Order Sheet -- anchor target for
          EstimateTopCard's order-jump banner (onViewOrder) and the Order
          Review drawer/sticky bar's "Review order" actions alike. */}
      <div ref={orderSheetRef} className="scroll-mt-4">
        <ProjectOrderSheet
          layoutMode={layoutMode} projectName={openProject ? openProject.name : (draftLabel ?? "")}
          results={results} projAgg={projAgg} combinedEstimate={combinedEstimate}
          reportData={reportData} onExportExcel={handleExport} exportDisabled={!hasExportData}
        />
      </div>
    </div>
  );

  const footerNode = (
    <LockedDataFooter title="Locked external system data" table={<LockedDataExt />} onExport={handleExport} disabled={!hasExportData} />
  );

  const orderDrawerNode = (
    <OrderReviewDrawer
      open={orderDrawerOpen} onClose={() => setOrderDrawerOpen(false)} layoutMode={layoutMode}
      projAgg={projAgg} combinedEstimate={combinedEstimate} results={results}
      reportData={reportData} projectName={openProject ? openProject.name : (draftLabel ?? "")}
      onExport={handleExport} exportDisabled={!hasExportData}
    />
  );
  // Mobile-only sticky summary bar. Mirrors Internal's.
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
  const topCardNode = isNoEstimate(results, []) ? (
    <FirstWallSetup
      active={active} update={update}
      draftLabel={draftLabel} onSetDraftLabel={onSetDraftLabel}
      onDuplicateDraft={duplicateWall} onGoToProjects={onGoToProjects}
    />
  ) : (
    <EstimateTopCard
      results={results} projAgg={projAgg}
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
