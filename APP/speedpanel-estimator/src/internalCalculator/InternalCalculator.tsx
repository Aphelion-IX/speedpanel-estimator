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
import { useState, useMemo } from "react";
import { Frame, Lock, Settings } from "lucide-react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { compute } from "../estimate/computeWall";
import { aggregate } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { computeCornerPair, computeShaftPair } from "../estimate/cornerShaftKits";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, STOCK_LENGTHS, INT_CONFIG } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, WarningsList, EstimateModeSelector, UnitToggle, CalculatorShell,
} from "../ui/primitives";
import { LockedDataInt, LockedDataFooter } from "../ui/lockedData";
import { PanelLengthSection } from "../ui/lengthExplorer";
import { WallsCard, WallsSummaryTable } from "../ui/wallsCard";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "../ui/wallConfig";
import type { FinishKey, CornersField } from "../ui/wallConfig";
import { PanelScheduleCard, PanelScheduleTable, ConnectionBreakdownCard } from "../ui/scheduleCards";
import { SingleWallEstimateSection, SystemBreakdownSection, EasyToOrderSection } from "./mainSections";
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

  const {
    walls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, updDim,
    setProjectLength, addBlankWall, duplicateWall, deleteWall,
    commitCustomLength, toggleCustom, clearCustomLength,
    linkJunctionPartner,
  } = store;
  const { results, out, warnById } = useWallResults(walls, activeId, compute);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  const project = mode === "project";
  const projChosenAgg = useMemo(() => aggregate(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);

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

  const sidebarNode = (
    <>
      <SectionLabel icon={<Settings size={13} />}>System configuration</SectionLabel>
      <WallsCard
        walls={walls} results={results} activeId={activeId} setActiveId={setActiveId}
        active={active} update={update} addBlankWall={addBlankWall}
        duplicateWall={duplicateWall} deleteWall={deleteWall} warnById={warnById}
        showTypes={true} systemSelector={systemSelector} orient={orient}
        onCornerLink={linkCornerPartner}
        onShaftLink={linkShaftPartner}
        onJunctionLink={linkJunctionPartner}
      />

      {/* Profile and dimensions */}
      <SectionLabel icon={<Frame size={13} />}>Wall geometry</SectionLabel>
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

      {/* Tracks and flashing */}
      <SectionLabel icon={<Lock size={13} />}>TRACKS AND FLASHING</SectionLabel>
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

      <WarningsList warnings={!out.empty ? out.warnings : null} />
      <EstimateModeSelector visible={!out.empty} mode={mode} setMode={setMode} />
    </>
  );

  const mainNode = (
    <>
      {/* Single wall estimate */}
      {!project && (
        <SingleWallEstimateSection
          active={active} out={out} orient={orient} layoutMode={layoutMode}
          showWall={showWall} setShowWall={setShowWall} ScheduleComp={ScheduleComp}
          walls={walls} cornerPair={cornerPair} shaftPair={shaftPair}
        />
      )}

      {/* Combined estimate: System Breakdown -> Connection Breakdown -> Easy to Order */}
      {project && (
        <>
          <ProjectSeparator />

          {layoutMode === "web" && (
            <>
              <SectionLabel icon={<Frame size={13} />}>Wall list</SectionLabel>
              <WallsSummaryTable results={results} activeId={activeId} setActiveId={setActiveId} warnById={warnById} toDisp={toDisp} dimUnit={dimUnit} />
            </>
          )}

          {/* System Breakdown: shows HOW the estimate was built, wall by wall */}
          <SystemBreakdownSection layoutMode={layoutMode} results={results} walls={walls} ScheduleComp={ScheduleComp} />

          {/* Connection Breakdown: shows WHY extra materials were added */}
          <SectionLabel icon={<Frame size={13} />}>Connection breakdown</SectionLabel>
          <ConnectionBreakdownCard connections={combinedEstimate.connections} />

          {/* Easy to Order: shows WHAT needs to be ordered -- one combined material list */}
          <EasyToOrderSection
            layoutMode={layoutMode} projChosenAgg={projChosenAgg} panelType={active.type}
            combinedEstimate={combinedEstimate} results={results}
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

  if (layoutMode === "phone") return <>{sidebarNode}{mainNode}{footerNode}</>;
  return <CalculatorShell sidebar={sidebarNode} main={mainNode} footer={footerNode} />;
}
