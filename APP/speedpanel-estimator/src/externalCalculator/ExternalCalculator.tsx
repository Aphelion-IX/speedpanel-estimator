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
import { Box, Frame, Gauge, Lock, Settings } from "lucide-react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { computeExternal } from "../estimate/computeWall";
import { buildExtProjAgg } from "../estimate/aggregate";
import { r1 } from "../estimate/mathUtils";
import { stockLengthLabel } from "../estimate/computeUtils";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, EXT_STOCK, EXT_STOCKED_COLOURS } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, WarningsList, UnitToggle, CalculatorShell,
  CollapsibleSection, StatsGrid,
} from "../ui/primitives";
import { LockedDataExt, LockedDataFooter } from "../ui/lockedData";
import { PanelLengthSection } from "./lengthExplorer";
import { WallsCard } from "./wallsCard";
import { EstimateStructureNav } from "./estimateStructureNav";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "./wallConfig";
import type { CornersField } from "./wallConfig";
import { WallPreviewSection } from "../ui/wallPreview";
import { PanelScheduleCard, PanelScheduleTable } from "../ui/scheduleCards";
import { PanelColourSection } from "./panelColourSection";
import { EstimateResultsCard } from "./estimateResultsCard";
import { AllWallsPage } from "./allWallsPage";
import { OrderReviewDrawer } from "./orderReviewDrawer";
import { StickyBarTilesPhone } from "./phoneShell";
import { EstimateTopCard } from "./EstimateTopCard";
import type { OpenProjectInfo } from "./EstimateTopCard";
import {
  SheetCardPhone, SheetSectionPhone, SystemConfigSectionPhone, GeometrySectionPhone,
  PanelLengthSectionPhone, TracksFlashingSectionPhone, WarningsListPhone,
} from "./phoneSections";
import { buildExternalReportData } from "../export/buildExternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

export function ExternalCalculator({
  store, orient, dimUnit, setDimUnit, systemSelector, layoutMode,
  onAddInternalWall, switchOrient, switchToInternal,
  openProject, draftLabel, onSetDraftLabel, lastEditedAt,
  onSaveDraftAsProject, onSaveOpenProject, savingProject, saveProjectError, projectDirty, onGoToProjects,
  onResetDraft,
}: {
  store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string;
  setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout;
  // "Internal Wall" add-tile (EstimateTopCard) -- adds a wall then switches
  // the whole project to the Internal calculator, see App.tsx's
  // addInternalWall.
  onAddInternalWall: () => void;
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
  savingProject: boolean;
  saveProjectError: string | null;
  // Whether the open saved project has edits since it was opened/last saved
  // -- see App.tsx's projectDirty. Only meaningful (and only shown) once
  // openProject is set; harmless/ignored otherwise.
  projectDirty: boolean;
  onGoToProjects: () => void;
  // "No project active" empty state's Delete-project icon -- reopens
  // App.tsx's existing "Reset the estimator" confirm dialog, same one the
  // header's reset button triggers, since there's no saved project yet to
  // delete, only the current local draft.
  onResetDraft: () => void;
}) {
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [allWallsOpen, setAllWallsOpen] = useState(false);
  // EstimateTopCard's "View estimate details" link scrolls here rather than
  // navigating anywhere new -- no separate estimate-detail route exists.
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const {
    walls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, updDim,
    setProjectLength, addBlankWall, duplicateWall, deleteWall,
    duplicateWallById, deleteWallById,
    commitCustomLength, toggleCustom, clearCustomLength,
    linkJunctionPartner,
  } = store;
  const { results, out, warnById } = useWallResults(walls, activeId, computeExternal);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  const projAgg  = useMemo(() => buildExtProjAgg(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);
  const orderLineItemCount = projAgg.groups.length;

  const edgeOptions = [
    { key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) },
  ];

  const ScheduleComp = layoutMode === "web" ? PanelScheduleTable : PanelScheduleCard;

  const workspaceTitle = `${active.name} — ${active.orient === "vertical" ? "Vertical" : "Horizontal"} · P78`;
  const colourEntry = active.colour ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour) : null;
  const colourLabel = active.colourType === "special" ? "Custom" : (colourEntry?.label ?? "--");
  const selectedItemStats = [
    { value: out.empty ? "--" : `${out.area} m2`, label: "Total area" },
    { value: out.empty ? "--" : (out.result?.panels ?? "--"), label: "Panels" },
    { value: colourLabel, label: "Colour" },
    { value: active.orient === "vertical" ? "Vertical" : "Horizontal", label: "Config" },
    { value: out.empty ? "--" : stockLengthLabel(out.result?.groups), label: "Length" },
    { value: out.empty ? "--" : `${r1(out.result?.wastePct ?? 0)}%`, label: "Waste" },
  ];
  const stickyProjectStats = [
    { value: `${projAgg.totalArea} m2`, label: "Project area" },
    { value: projAgg.panels, label: "Panels" },
    { value: results.length, label: "Walls" },
  ];

  // Renders as a full-width card carousel on web (see estimateStructureNav.tsx),
  // no longer the sidebar's sole content -- kept as its own variable rather
  // than inlined so the phone/web branches below can each place it correctly.
  const wallNavNode = (
    <EstimateStructureNav
      walls={walls} results={results} activeId={activeId} onSelectWall={setActiveId}
      warnById={warnById} addBlankWall={addBlankWall}
      layoutMode={layoutMode}
      dimUnit={dimUnit} toDisp={toDisp}
      onViewAll={() => setAllWallsOpen(true)}
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
      corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
    />
  );
  // CollapsibleSection header badges -- a status summary visible even while
  // collapsed, echoing the "Estimate structure (N)" pattern already used in
  // the sidebar heading.
  const profileLabel = active.profile === "standard" ? "Standard" : active.profile === "rake" ? "Raked" : "Gable";
  const isCustomColour = active.colourType === "special";
  const colourName = !isCustomColour && active.colour ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour)?.label ?? "" : "";
  const panelBadge = isCustomColour ? "Custom" : colourName || "No colour";
  const edgeCount = Object.values(active.edges).filter(Boolean).length;
  const edgesBadge = `${edgeCount} edge${edgeCount === 1 ? "" : "s"}`;

  const phoneWorkspaceNode = (
    <>
      <SystemConfigSectionPhone
        walls={walls} active={active} update={update}
        duplicateWall={duplicateWall} deleteWall={deleteWall} orient={orient}
        onJunctionLink={linkJunctionPartner}
        switchOrient={switchOrient} switchToInternal={switchToInternal}
      />
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

  const webWorkspaceNode = (
    <>
      <SectionLabel icon={<Gauge size={13} />}>Selected item metrics</SectionLabel>
      <StatsGrid stats={selectedItemStats} />

      <SectionLabel icon={<Settings size={13} />}>{`Calculator workspace — ${workspaceTitle}`}</SectionLabel>
      <WallsCard
        walls={walls}
        active={active} update={update}
        duplicateWall={duplicateWall} deleteWall={deleteWall}
        systemSelector={systemSelector}
        onJunctionLink={linkJunctionPartner}
      />

      <CollapsibleSection icon={<Box size={13} />} label="Panel configuration" badge={panelBadge} defaultOpen>
        <PanelColourSection active={active} update={update} />
        {panelLengthContent}
      </CollapsibleSection>

      <CollapsibleSection icon={<Frame size={13} />} label="Wall geometry" badge={profileLabel} defaultOpen>
        {geometryContent}
      </CollapsibleSection>

      <CollapsibleSection icon={<Lock size={13} />} label="Tracks and flashing" badge={edgesBadge} defaultOpen>
        {tracksContent}
      </CollapsibleSection>

      <WarningsList warnings={!out.empty ? out.warnings : null} />
    </>
  );

  const workspaceNode = layoutMode === "phone" ? phoneWorkspaceNode : webWorkspaceNode;

  const mainNode = (
    <div ref={resultsRef}>
      {workspaceNode}

      <ProjectSeparator />
      <EstimateResultsCard
        layoutMode={layoutMode} results={results}
        projAgg={projAgg} combinedEstimate={combinedEstimate}
        active={active} out={out} orient={orient} ScheduleComp={ScheduleComp}
        onReviewOrder={() => setOrderDrawerOpen(true)} orderLineItemCount={orderLineItemCount}
      />
    </div>
  );

  const hasExportData = projAgg.panels > 0;
  const handleExport = () => exportEstimateToExcel(buildExternalReportData({
    orient, dimUnit, toDisp, walls, results, warnById,
    projAgg, combinedEstimate,
  }));
  const footerNode = (
    <LockedDataFooter title="Locked external system data" table={<LockedDataExt />} onExport={handleExport} disabled={!hasExportData} />
  );

  const orderDrawerNode = (
    <OrderReviewDrawer
      open={orderDrawerOpen} onClose={() => setOrderDrawerOpen(false)} layoutMode={layoutMode}
      projAgg={projAgg} combinedEstimate={combinedEstimate}
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
  // banners.
  const topCardNode = (
    <EstimateTopCard
      results={results} projAgg={projAgg}
      addBlankWall={addBlankWall} onAddInternalWall={onAddInternalWall}
      openProject={openProject} draftLabel={draftLabel} onSetDraftLabel={onSetDraftLabel}
      onDuplicateDraft={duplicateWall} onDeleteDraft={onResetDraft}
      lastEditedAt={lastEditedAt}
      onSaveDraftAsProject={onSaveDraftAsProject} onSaveOpenProject={onSaveOpenProject}
      savingProject={savingProject} saveProjectError={saveProjectError} projectDirty={projectDirty}
      onGoToProjects={onGoToProjects} onViewDetails={scrollToResults}
    />
  );

  if (allWallsOpen) {
    return (
      <AllWallsPage
        walls={walls} results={results} warnById={warnById} toDisp={toDisp} dimUnit={dimUnit}
        onSelectWall={id => { setActiveId(id); setAllWallsOpen(false); }}
        duplicateWallById={duplicateWallById} deleteWallById={deleteWallById}
        onBack={() => setAllWallsOpen(false)}
      />
    );
  }

  if (layoutMode === "phone") return <>{topCardNode}{wallNavNode}{mainNode}{footerNode}{stickyBarNode}{orderDrawerNode}</>;
  return (
    <>
      {topCardNode}
      {wallNavNode}
      <CalculatorShell main={mainNode} footer={footerNode} />
      {orderDrawerNode}
    </>
  );
}
