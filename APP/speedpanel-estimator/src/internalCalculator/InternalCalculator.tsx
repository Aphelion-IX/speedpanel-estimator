// =============================================================================
// Internal Calculator
// =============================================================================
// The Internal calculator (P51/P64/P78, vertical or horizontal, Standard/
// Corner/Shaft wall systems). Shares the same wall store as the External
// calculator (passed down from the root component) so walls survive
// switching between Internal/External and orientation. mode and showWall
// stay lifted as props -- the root component persists mode across sessions
// and force-opens showWall on several of its own call sites (add wall,
// switch orientation, switch system) -- while showTrackFinish/showData are
// local UI-only state, and results/aggregate/corner-shaft-pair/combined
// estimate are computed independently here, mirroring ExternalCalculator's
// own independent compute calls on the same shared `walls` array.
// =============================================================================
import { useState, useEffect, useMemo } from "react";
import { Frame, Gauge, Lock, Settings } from "lucide-react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { compute } from "../estimate/computeWall";
import { aggregate } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { computeCornerPair, computeShaftPair } from "../estimate/cornerShaftKits";
import { synthesizeKits, kitLabel } from "../estimate/synthesizeKits";
import { r1 } from "../estimate/mathUtils";
import type { SelectedNavItem } from "../estimate/navSelection";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, STOCK_LENGTHS, INT_CONFIG } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, WarningsList, EstimateModeSelector, UnitToggle, CalculatorShell,
  CollapsibleSection, StatsGrid,
} from "../ui/primitives";
import { LockedDataInt, LockedDataFooter } from "../ui/lockedData";
import { PanelLengthSection } from "../ui/lengthExplorer";
import { WallsCard } from "../ui/wallsCard";
import { EstimateStructureNav } from "./estimateStructureNav";
import { KitWorkspace } from "./kitWorkspace";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "../ui/wallConfig";
import type { FinishKey, CornersField } from "../ui/wallConfig";
import { PanelScheduleCard, PanelScheduleTable } from "../ui/scheduleCards";
import { SingleWallEstimateSection } from "./mainSections";
import { EstimateResultsCard } from "./estimateResultsCard";
import { OrderReviewDrawer } from "./orderReviewDrawer";
import { StickyBar } from "../ui/stickyBar";
import { buildInternalReportData } from "../export/buildInternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

export function InternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode, mode, setMode, showWall, setShowWall, linkCornerPartner, linkShaftPartner }: {
  store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string;
  setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout;
  mode: string; setMode: (m: string) => void;
  showWall: boolean; setShowWall: (v: boolean) => void;
  linkCornerPartner: (targetId: number | null) => void;
  linkShaftPartner: (targetId: number | null) => void;
}) {
  const [showTrackFinish, setShowTrackFinish] = useState(false);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);

  const {
    walls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, updDim,
    setProjectLength, addBlankWall, addCornerWall, addShaftWall, duplicateWall, deleteWall,
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
  const project = mode === "project";
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
      ];

  const sidebarNode = (
    <EstimateStructureNav
      walls={walls} results={results} kits={kits}
      selected={selectedNavItem} onSelect={handleSelectNavItem}
      warnById={warnById}
      addBlankWall={addBlankWall} addCornerWall={addCornerWall} addShaftWall={addShaftWall}
    />
  );

  const workspaceNode = (
    <>
      <EstimateModeSelector visible={!out.empty} mode={mode} setMode={setMode} />

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

          {/* Profile and dimensions */}
          <CollapsibleSection icon={<Frame size={13} />} label="Wall geometry" defaultOpen>
            <div className={cx.section}>
              <ProfileSection profile={active.profile} onChange={id => update({ profile: id })} />
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className={cx.cardHd} style={{marginBottom:0}}>Dimensions</span>
                  <div className="flex items-center gap-2">
                    <UnitToggle unit={dimUnit} setUnit={switchDimUnit} />
                  </div>
                </div>
                <DimensionInputs active={active} toDisp={toDisp} updDim={updDim} out={out} orient={orient} />
                <SpanTable orient={orient} type={active.type} wallSystem={active.wallSystem} />
              </div>
              <PanelLengthSection
                dimUnit={dimUnit} out={out} active={active} walls={walls}
                projectLock={projectLock} projectStock={projectStock}
                customLengthInput={customLengthInput} customActive={customActive}
                stocks={STOCK_LENGTHS} packType={active.type}
                update={update} setProjectLength={setProjectLength}
                commitCustomLength={commitCustomLength} toggleCustom={toggleCustom} clearCustomLength={clearCustomLength}
              />
            </div>
          </CollapsibleSection>

          {/* Tracks and flashing -- defaults open now that this lives in the
              wider main-column workspace, not the space-constrained sidebar
              (see Phase B's CollapsibleSection doc comment for that original
              rationale, which no longer applies here). */}
          <CollapsibleSection icon={<Lock size={13} />} label="Tracks and flashing" defaultOpen>
            <EdgeRestraintSelector
              edges={active.edges}
              onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
              options={[{ key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) }]}
              orient={orient}
              locked={orient === "horizontal" && active.wallSystem === "standard"}
              showTrackFinish={showTrackFinish}
              setShowTrackFinish={setShowTrackFinish}
              activeFinishes={{ headFinish: active.headFinish, bottomFinish: active.bottomFinish, leftFinish: active.leftFinish, rightFinish: active.rightFinish }}
              onFinishChange={(field, val) => update({ [field]: val } as Pick<Wall, FinishKey>)}
              corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
            />
          </CollapsibleSection>

          <WarningsList warnings={!out.empty ? out.warnings : null} />
        </>
      )}
    </>
  );

  const mainNode = (
    <>
      {workspaceNode}

      {/* Single wall estimate */}
      {!project && (
        <SingleWallEstimateSection
          active={active} out={out} orient={orient} layoutMode={layoutMode}
          showWall={showWall} setShowWall={setShowWall} ScheduleComp={ScheduleComp}
          walls={walls} cornerPair={cornerPair} shaftPair={shaftPair}
        />
      )}

      {/* Estimate Results: Overview / Selected Wall / Connections / Order tabs */}
      {project && (
        <>
          <ProjectSeparator />
          <EstimateResultsCard
            layoutMode={layoutMode} results={results} walls={walls} kits={kits}
            activeId={activeId} onSelectWall={wallId => handleSelectNavItem({ type: "wall", wallId })}
            warnById={warnById} toDisp={toDisp} dimUnit={dimUnit}
            projChosenAgg={projChosenAgg} combinedEstimate={combinedEstimate}
            active={active} out={out} orient={orient} cornerPair={cornerPair} shaftPair={shaftPair}
            ScheduleComp={ScheduleComp}
            onReviewOrder={() => setOrderDrawerOpen(true)} orderLineItemCount={orderLineItemCount}
          />
        </>
      )}
    </>
  );

  const hasExportData = project
    ? !!(projChosenAgg && projChosenAgg.totalPanels > 0)
    : !(out.empty || !out.chosen || out.chosen.invalid);
  const handleExport = () => exportEstimateToExcel(buildInternalReportData({
    mode, orient, dimUnit, toDisp, walls, results, warnById, active, out,
    projChosenAgg, combinedEstimate, cornerPair, shaftPair,
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
  // Mobile-only sticky summary bar -- project mode only, since Review Order
  // opens the project-wide order the drawer above shows; single-wall mode's
  // existing footer Export button is untouched.
  const stickyBarNode = project && layoutMode === "phone" && (
    <StickyBar
      view="project" wallStats={[]} projectStats={stickyProjectStats}
      onReviewOrder={() => setOrderDrawerOpen(true)} lineItemCount={orderLineItemCount}
    />
  );

  if (layoutMode === "phone") return <>{sidebarNode}{mainNode}{footerNode}{stickyBarNode}{orderDrawerNode}</>;
  return (
    <>
      <CalculatorShell sidebar={sidebarNode} main={mainNode} footer={footerNode} sidebarWidth={320} />
      {orderDrawerNode}
    </>
  );
}
