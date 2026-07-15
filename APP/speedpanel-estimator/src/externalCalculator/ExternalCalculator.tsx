// =============================================================================
// External Calculator
// =============================================================================
// orient is derived from sys.orient in the parent and passed as a prop. The
// wall list comes from the shared `store` (owned by the root component) so
// it survives switching in/out of External mode. orient stays in
// useWallResults' dependency array to prevent stale compute if this
// component is kept mounted across orientation switches.
// =============================================================================
import { useState, useMemo } from "react";
import { Box, Frame, Lock } from "lucide-react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { computeExternal } from "../estimate/computeWall";
import { buildExtProjAgg } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, EXT_STOCK } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, WarningsList, EstimateModeSelector, UnitToggle, CalculatorShell,
  CollapsibleSection, SectionNav,
} from "../ui/primitives";
import { LockedDataExt, LockedDataFooter } from "../ui/lockedData";
import { PanelLengthSection } from "../ui/lengthExplorer";
import { WallsCard, WallsSummaryTable } from "../ui/wallsCard";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "../ui/wallConfig";
import type { CornersField } from "../ui/wallConfig";
import { PanelScheduleCard, PanelScheduleTable, ConnectionBreakdownCard } from "../ui/scheduleCards";
import { PanelColourSection } from "./panelColourSection";
import { SingleWallMaterialsSection, SystemBreakdownSection, EasyToOrderSectionExt } from "./mainSections";
import { buildExternalReportData } from "../export/buildExternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

// --- ExternalCalculator -------------------------------------------------------
// orient is derived from sys.orient in the parent and passed as a prop. The
// wall list comes from the shared `store` (owned by SpeedpanelEstimator) so it
// survives switching in/out of External mode. orient stays in useWallResults'
// dependency array to prevent stale compute if this component is kept mounted
// across orientation switches.
export function ExternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode }: { store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string; setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout }) {
  const [extMode, setExtMode] = useState("project");
  const [showTakeoff, setShowTakeoff] = useState(true);

  const {
    walls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, updDim,
    setProjectLength, addBlankWall, duplicateWall, deleteWall,
    commitCustomLength, toggleCustom, clearCustomLength,
    linkJunctionPartner,
  } = store;
  const { results, out, warnById } = useWallResults(walls, activeId, computeExternal);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  const project  = extMode === "project";
  const projAgg  = useMemo(() => buildExtProjAgg(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);

  const edgeOptions = [
    { key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) },
  ];

  const ScheduleComp = layoutMode === "web" ? PanelScheduleTable : PanelScheduleCard;

  const sidebarNode = (
    <>
      <WallsCard
        walls={walls} results={results} activeId={activeId} setActiveId={setActiveId}
        active={active} update={update} addBlankWall={addBlankWall}
        duplicateWall={duplicateWall} deleteWall={deleteWall} warnById={warnById} showTypes={false}
        systemSelector={systemSelector} orient={orient}
        onJunctionLink={linkJunctionPartner}
      />

      <CollapsibleSection icon={<Box size={13} />} label="Panel configuration" defaultOpen>
        <div className={cx.section}>
          <PanelColourSection active={active} update={update} />

          <PanelLengthSection
            dimUnit={dimUnit} out={out} active={active} walls={walls}
            projectLock={projectLock} projectStock={projectStock}
            customLengthInput={customLengthInput} customActive={customActive}
            stocks={EXT_STOCK} packType={78}
            update={update} setProjectLength={setProjectLength}
            commitCustomLength={commitCustomLength} toggleCustom={toggleCustom} clearCustomLength={clearCustomLength}
          />
        </div>
      </CollapsibleSection>

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
            <SpanTable orient={orient} type={78} />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon={<Lock size={13} />} label="Tracks and flashing" defaultOpen={false}>
        <EdgeRestraintSelector
          edges={active.edges}
          onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
          options={edgeOptions}
          orient={orient}
          corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
        />
      </CollapsibleSection>

      <WarningsList warnings={!out.empty ? out.warnings : null} />
      <EstimateModeSelector visible={!out.empty} mode={extMode} setMode={setExtMode} />
    </>
  );

  const mainNode = (
    <>
      {!project && (
        <SingleWallMaterialsSection
          active={active} out={out} orient={orient} layoutMode={layoutMode}
          showTakeoff={showTakeoff} setShowTakeoff={setShowTakeoff} ScheduleComp={ScheduleComp}
        />
      )}

      {project && (
        <>
          <ProjectSeparator />
          <SectionNav sections={[
            ...(layoutMode === "web" ? [{ id: "wall-list", label: "Wall list" }] : []),
            { id: "system-breakdown", label: "System breakdown" },
            { id: "connection-breakdown", label: "Connection breakdown" },
            { id: "easy-to-order", label: "Easy to order" },
          ]} />

          {layoutMode === "web" && (
            <div id="wall-list">
              <SectionLabel icon={<Frame size={13} />}>Wall list</SectionLabel>
              <WallsSummaryTable results={results} activeId={activeId} setActiveId={setActiveId} warnById={warnById} toDisp={toDisp} dimUnit={dimUnit} />
            </div>
          )}

          {/* System Breakdown: shows HOW the estimate was built, wall by wall */}
          <div id="system-breakdown">
            <SystemBreakdownSection layoutMode={layoutMode} results={results} ScheduleComp={ScheduleComp} />
          </div>

          {/* Connection Breakdown: shows WHY extra materials were added */}
          <div id="connection-breakdown">
            <SectionLabel icon={<Frame size={13} />}>Connection breakdown</SectionLabel>
            <ConnectionBreakdownCard connections={combinedEstimate.connections} />
          </div>

          {/* Easy to Order: shows WHAT needs to be ordered -- one combined material list */}
          <div id="easy-to-order">
            <EasyToOrderSectionExt layoutMode={layoutMode} projAgg={projAgg} combinedEstimate={combinedEstimate} />
          </div>
        </>
      )}
    </>
  );

  const hasExportData = project
    ? projAgg.panels > 0
    : !(out.empty || !out.result);
  const handleExport = () => exportEstimateToExcel(buildExternalReportData({
    extMode, orient, dimUnit, toDisp, walls, results, warnById, active, out,
    projAgg, combinedEstimate,
  }));
  const footerNode = (
    <LockedDataFooter title="Locked external system data" table={<LockedDataExt />} onExport={handleExport} disabled={!hasExportData} />
  );

  if (layoutMode === "phone") {
    return <div>{sidebarNode}{mainNode}{footerNode}</div>;
  }
  return <CalculatorShell sidebar={sidebarNode} main={mainNode} footer={footerNode} />;
}
