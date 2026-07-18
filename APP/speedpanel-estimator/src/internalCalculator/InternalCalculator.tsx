// =============================================================================
// Internal Calculator
// =============================================================================
// The Internal calculator (P51/P64/P78, vertical or horizontal, Standard/
// Corner/Shaft wall systems). Shares the same wall store as the External
// calculator (passed down from the root component) so walls survive
// switching between Internal/External and orientation. Always renders the
// combined project view (single-wall-only mode was retired -- see git
// history for the old EstimateModeSelector toggle) -- showTrackFinish/
// showData are local UI-only state, and results/aggregate/corner-shaft-pair/
// combined estimate are computed independently here, mirroring
// ExternalCalculator's own independent compute calls on the same shared
// `walls` array.
// =============================================================================
import { useState, useEffect, useMemo, useRef } from "react";
import { Frame, Gauge, Link2, Lock, Settings } from "lucide-react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { compute } from "../estimate/computeWall";
import { aggregate } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { computeCornerPair, computeShaftPair } from "../estimate/cornerShaftKits";
import { synthesizeKits, kitLabel } from "../estimate/synthesizeKits";
import { r1 } from "../estimate/mathUtils";
import { stockLengthLabel } from "../estimate/computeUtils";
import type { SelectedNavItem } from "../estimate/navSelection";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, STOCK_LENGTHS, INT_CONFIG } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, WarningsList, UnitToggle, CalculatorShell,
  CollapsibleSection, StatsGrid,
} from "../ui/primitives";
import { LockedDataInt, LockedDataFooter } from "../ui/lockedData";
import { PanelLengthSection } from "./lengthExplorer";
import { WallsCard } from "./wallsCard";
import { EstimateStructureNav } from "./estimateStructureNav";
import { KitWorkspace } from "./kitWorkspace";
import { KitWorkspacePhone } from "./kitWorkspacePhone";
import { StickyBarTilesPhone } from "./phoneShell";
import { EstimateTopCard } from "./EstimateTopCard";
import type { OpenProjectInfo } from "./EstimateTopCard";
import type { ProjectRow } from "../pages/projects/projectTypes";
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
import { AllWallsPage } from "./allWallsPage";
import { OrderReviewDrawer } from "./orderReviewDrawer";
import { buildInternalReportData } from "../export/buildInternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

export function InternalCalculator({
  store, orient, dimUnit, setDimUnit, systemSelector, layoutMode,
  linkCornerPartner, linkShaftPartner,
  onAddExternalWall, switchOrient, switchToExternal,
  openProject, draftLabel, onSetDraftLabel, lastEditedAt,
  onSaveDraftAsProject, onSaveOpenProject, savingProject, saveProjectError, projectDirty, onGoToProjects,
  recentProjects, signedIn,
}: {
  store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string;
  setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout;
  linkCornerPartner: (targetId: number | null) => void;
  linkShaftPartner: (targetId: number | null) => void;
  // "External Wall" add-tile (EstimateTopCard) -- adds a wall then switches
  // the whole project to the External calculator, see App.tsx's
  // addExternalWall.
  onAddExternalWall: () => void;
  // Phone-only SystemConfigSectionPhone's Orientation/Wall type segments --
  // same store/App.tsx wiring web's SystemRows uses, just threaded straight
  // through instead of via the opaque systemSelector render-prop, so the
  // phone-only restyle doesn't need to branch inside the shared SystemRows
  // component (see phoneSections.tsx's header comment).
  switchOrient: (o: "vertical" | "horizontal") => void;
  switchToExternal: () => void;
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
  // "Work on an existing project" card in EstimateTopCard's empty state --
  // reuses App.tsx's existing header-bell useProjects() call rather than
  // fetching a second time.
  recentProjects: ProjectRow[];
  signedIn: boolean;
}) {
  const [showTrackFinish, setShowTrackFinish] = useState(false);
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
    setProjectLength, addBlankWall, addCornerWall, addShaftWall, duplicateWall, deleteWall,
    duplicateWallById, deleteWallById,
    commitCustomLength, toggleCustom, clearCustomLength,
    linkJunctionPartner,
  } = store;
  const { results, out, warnById } = useWallResults(walls, activeId, compute);
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
  const projChosenAgg = useMemo(() => aggregate(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);
  // Rough "line item" count for the Review Order trigger/sticky bar -- stock
  // panel groups + custom-length groups, not every card's every row.
  const orderLineItemCount = projChosenAgg.panels.length + projChosenAgg.customPanels.length;
  const stickyProjectStats = [
    { value: `${projChosenAgg.totalArea} m2`, label: "Project area" },
    { value: projChosenAgg.totalPanels, label: "Panels" },
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
  // here since both the workspace title and StatsGrid below need it.
  const selectedKit = selectedNavItem.type === "kit"
    ? kits.find(k => k.wallAId === selectedNavItem.wallAId && k.wallBId === selectedNavItem.wallBId) ?? null
    : null;
  const workspaceTitle = selectedKit
    ? kitLabel(selectedKit, kits)
    : `${active.name} — ${active.orient === "vertical" ? "Vertical" : "Horizontal"} · P${active.type}`;
  const selectedItemStats = selectedKit
    ? [
        { value: selectedKit.kind === "corner" ? "Corner" : "Shaft", label: "Kit type" },
        { value: `${selectedKit.wallAName} + ${selectedKit.wallBName}`, label: "Linked walls" },
        { value: `${r1(selectedKit.result.H)} m`, label: "Height" },
        { value: selectedKit.result.warnings.length, label: "Warnings" },
      ]
    : [
        { value: out.empty ? "--" : `${out.area} m2`, label: "Total area" },
        { value: out.empty ? "--" : (out.chosen?.panels ?? out.result?.panels ?? "--"), label: "Panels" },
        { value: `P${active.type}`, label: "Panel type" },
        { value: active.orient === "vertical" ? "Vertical" : "Horizontal", label: "Config" },
        { value: out.empty ? "--" : stockLengthLabel(out.chosen?.groups), label: "Length" },
        { value: out.empty ? "--" : `${r1(out.chosen?.wastePct ?? 0)}%`, label: "Waste" },
      ];

  // Renders as a full-width card carousel on web (see estimateStructureNav.tsx),
  // no longer the sidebar's sole content -- kept as its own variable rather
  // than inlined so the phone/web branches below can each place it correctly.
  const wallNavNode = (
    <EstimateStructureNav
      walls={walls} results={results} kits={kits}
      selected={selectedNavItem} onSelect={handleSelectNavItem}
      warnById={warnById}
      addBlankWall={addBlankWall} addCornerWall={addCornerWall} addShaftWall={addShaftWall}
      layoutMode={layoutMode}
      dimUnit={dimUnit} toDisp={toDisp}
      onViewAll={() => setAllWallsOpen(true)}
    />
  );

  // Shared between the phone (flat sections) and web (CollapsibleSection
  // accordion) branches below, so the two layouts can't drift apart.
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
        <SpanTable orient={orient} type={active.type} wallSystem={active.wallSystem} />
      </div>
    </>
  );
  const panelLengthContent = (
    <PanelLengthSection
      dimUnit={dimUnit} out={out} active={active} walls={walls}
      projectLock={projectLock} projectStock={projectStock}
      customLengthInput={customLengthInput} customActive={customActive}
      stocks={STOCK_LENGTHS} packType={active.type}
      update={update} setProjectLength={setProjectLength}
      commitCustomLength={commitCustomLength} toggleCustom={toggleCustom} clearCustomLength={clearCustomLength}
    />
  );
  const edgesLocked = orient === "horizontal" && active.wallSystem === "standard";
  const tracksContent = (
    <EdgeRestraintSelector
      edges={active.edges}
      onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
      options={[{ key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) }]}
      orient={orient}
      locked={edgesLocked}
      showTrackFinish={showTrackFinish}
      setShowTrackFinish={setShowTrackFinish}
      activeFinishes={{ headFinish: active.headFinish, bottomFinish: active.bottomFinish, leftFinish: active.leftFinish, rightFinish: active.rightFinish }}
      onFinishChange={(field, val) => update({ [field]: val } as Pick<Wall, FinishKey>)}
      corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
    />
  );
  // CollapsibleSection header badges -- a status summary visible even while
  // collapsed, echoing the "Estimate structure (N)" pattern already used in
  // the sidebar heading.
  const profileLabel = active.profile === "standard" ? "Standard" : active.profile === "rake" ? "Raked" : "Gable";
  const edgeCount = edgesLocked ? 4 : Object.values(active.edges).filter(Boolean).length;
  const edgesBadge = `${edgeCount} edge${edgeCount === 1 ? "" : "s"}`;

  // Phone and web have genuinely different visual languages now (segmented
  // pill controls + one continuous "sheet" card on phone vs. the app's
  // generic button-grid cards on web, see phoneSections.tsx's header
  // comment), so the two are fully separate JSX trees below rather than one
  // shared tree with inline layoutMode checks -- easier to keep each correct
  // than a tangle of conditionals that differ in more than just wrapping.
  const phoneWorkspaceNode = (
    <>
      {selectedKit && (
        <SheetCardPhone>
          <SheetSectionPhone icon={<Link2 size={13} />} label="Connection workspace" noDivider>
            <KitWorkspacePhone kit={selectedKit} onSelect={handleSelectNavItem} />
          </SheetSectionPhone>
        </SheetCardPhone>
      )}
      {!selectedKit && (
        <>
          <SystemConfigSectionPhone
            walls={walls} active={active} update={update}
            duplicateWall={duplicateWall} deleteWall={deleteWall} orient={orient}
            onCornerLink={linkCornerPartner} onShaftLink={linkShaftPartner} onJunctionLink={linkJunctionPartner}
            switchOrient={switchOrient} switchToExternal={switchToExternal}
          />
          <GeometrySectionPhone
            active={active} update={update} toDisp={toDisp} updDim={updDim} out={out} orient={orient}
            walls={walls} dimUnit={dimUnit} switchDimUnit={switchDimUnit}
          />
          <PanelLengthSectionPhone
            dimUnit={dimUnit} out={out} active={active} walls={walls}
            projectLock={projectLock} projectStock={projectStock}
            customLengthInput={customLengthInput} customActive={customActive}
            stocks={STOCK_LENGTHS} packType={active.type}
            update={update} setProjectLength={setProjectLength}
            commitCustomLength={commitCustomLength} toggleCustom={toggleCustom} clearCustomLength={clearCustomLength}
          />
          <TracksFlashingSectionPhone active={active} update={update} orient={orient} />

          {/* Per-wall Schedule/Connections/Warnings live in EstimateResultsCard's
              own Selected Wall/Connections/Order tabs below (in mainNode) --
              this is just the project-level warnings list. */}
          <SheetCardPhone>
            <SheetSectionPhone label="Warnings" noDivider>
              <WarningsListPhone warnings={!out.empty ? out.warnings : null} />
            </SheetSectionPhone>
          </SheetCardPhone>
        </>
      )}
    </>
  );

  const webWorkspaceNode = (
    <>
      <SectionLabel icon={<Gauge size={13} />}>Selected item metrics</SectionLabel>
      <StatsGrid stats={selectedItemStats} />
      <SectionLabel icon={<Settings size={13} />}>{`Calculator workspace — ${workspaceTitle}`}</SectionLabel>
      {selectedKit ? (
        <KitWorkspace kit={selectedKit} onSelect={handleSelectNavItem} />
      ) : (
        <>
          <WallsCard
            walls={walls}
            active={active} update={update}
            duplicateWall={duplicateWall} deleteWall={deleteWall}
            showTypes={true} systemSelector={systemSelector} orient={orient}
            onCornerLink={linkCornerPartner}
            onShaftLink={linkShaftPartner}
            onJunctionLink={linkJunctionPartner}
          />

          <CollapsibleSection icon={<Frame size={13} />} label="Wall geometry" badge={profileLabel} defaultOpen>
            {geometryContent}
            {panelLengthContent}
          </CollapsibleSection>

          {/* Tracks and flashing -- defaults open now that this lives in the
              wider main-column workspace, not the space-constrained sidebar
              (see Phase B's CollapsibleSection doc comment for that original
              rationale, which no longer applies here). */}
          <CollapsibleSection icon={<Lock size={13} />} label="Tracks and flashing" badge={edgesBadge} defaultOpen>
            {tracksContent}
          </CollapsibleSection>

          <WarningsList warnings={!out.empty ? out.warnings : null} />
        </>
      )}
    </>
  );

  const workspaceNode = layoutMode === "phone" ? phoneWorkspaceNode : webWorkspaceNode;

  const mainNode = (
    <div ref={resultsRef}>
      {workspaceNode}

      {/* Estimate Results: Overview / Selected Wall / Connections / Order tabs */}
      <ProjectSeparator />
      <EstimateResultsCard
        layoutMode={layoutMode} results={results} walls={walls} kits={kits}
        projChosenAgg={projChosenAgg} combinedEstimate={combinedEstimate}
        active={active} out={out} orient={orient} cornerPair={cornerPair} shaftPair={shaftPair}
        ScheduleComp={ScheduleComp}
        onReviewOrder={() => setOrderDrawerOpen(true)} orderLineItemCount={orderLineItemCount}
      />
    </div>
  );

  const hasExportData = !!(projChosenAgg && projChosenAgg.totalPanels > 0);
  const handleExport = () => exportEstimateToExcel(buildInternalReportData({
    orient, dimUnit, toDisp, walls, results, warnById,
    projChosenAgg, combinedEstimate,
  }));
  const footerNode = (
    <LockedDataFooter title="Locked system data" table={<LockedDataInt />} onExport={handleExport} disabled={!hasExportData} />
  );

  const orderDrawerNode = (
    <OrderReviewDrawer
      open={orderDrawerOpen} onClose={() => setOrderDrawerOpen(false)} layoutMode={layoutMode}
      projChosenAgg={projChosenAgg} combinedEstimate={combinedEstimate} results={results}
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
  // banners.
  const topCardNode = (
    <EstimateTopCard
      results={results} kits={kits} projAgg={projChosenAgg}
      addBlankWall={addBlankWall} onAddExternalWall={onAddExternalWall}
      openProject={openProject} draftLabel={draftLabel} onSetDraftLabel={onSetDraftLabel}
      onDuplicateDraft={duplicateWall}
      lastEditedAt={lastEditedAt}
      onSaveDraftAsProject={onSaveDraftAsProject} onSaveOpenProject={onSaveOpenProject}
      savingProject={savingProject} saveProjectError={saveProjectError} projectDirty={projectDirty}
      onGoToProjects={onGoToProjects} onViewDetails={scrollToResults}
      recentProjects={recentProjects} signedIn={signedIn}
    />
  );

  if (allWallsOpen) {
    return (
      <AllWallsPage
        walls={walls} results={results} warnById={warnById} toDisp={toDisp} dimUnit={dimUnit}
        onSelectWall={id => { handleSelectNavItem({ type: "wall", wallId: id }); setAllWallsOpen(false); }}
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
