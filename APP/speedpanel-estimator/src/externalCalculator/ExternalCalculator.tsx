// =============================================================================
// External Calculator
// =============================================================================
// orient is derived from sys.orient in the parent and passed as a prop. The
// wall list comes from the shared `store` (owned by the root component) so
// it survives switching in/out of External mode. orient stays in
// useWallResults' dependency array to prevent stale compute if this
// component is kept mounted across orientation switches.
//
// mode/setMode are lifted from App.tsx's shared state (same variable
// InternalCalculator uses) -- previously this component owned its own local
// `extMode` state that silently reset on reload/project-save, unlike
// Internal's. Sharing one mode variable also means switching between
// Internal/External mid-project keeps whatever Single Wall/Project Estimate
// view you were in, consistent with how walls/dimUnit are already shared.
// =============================================================================
import { useState, useMemo } from "react";
import { Box, Frame, Gauge, Lock, Settings } from "lucide-react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { computeExternal } from "../estimate/computeWall";
import { buildExtProjAgg } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, EXT_STOCK, EXT_STOCKED_COLOURS } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, WarningsList, EstimateModeSelector, UnitToggle, CalculatorShell,
  CollapsibleSection, StatsGrid,
} from "../ui/primitives";
import { LockedDataExt, LockedDataFooter } from "../ui/lockedData";
import { PanelLengthSection } from "../ui/lengthExplorer";
import { WallsCard } from "../ui/wallsCard";
import { StickyBar } from "../ui/stickyBar";
import { EstimateStructureNav } from "./estimateStructureNav";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "../ui/wallConfig";
import type { CornersField } from "../ui/wallConfig";
import { WallPreviewSection } from "../ui/wallPreview";
import { PanelScheduleCard, PanelScheduleTable } from "../ui/scheduleCards";
import { PanelColourSection } from "./panelColourSection";
import { SingleWallMaterialsSection } from "./mainSections";
import { EstimateResultsCard } from "./estimateResultsCard";
import { OrderReviewDrawer } from "./orderReviewDrawer";
import { buildExternalReportData } from "../export/buildExternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

export function ExternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode, mode, setMode }: {
  store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string;
  setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout;
  mode: string; setMode: (m: string) => void;
}) {
  const [showTakeoff, setShowTakeoff] = useState(true);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);

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
  const project  = mode === "project";
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
  ];
  const stickyProjectStats = [
    { value: `${projAgg.totalArea} m2`, label: "Project area" },
    { value: projAgg.panels, label: "Panels" },
    { value: results.length, label: "Walls" },
  ];

  const sidebarNode = (
    <EstimateStructureNav
      walls={walls} results={results} activeId={activeId} onSelectWall={setActiveId}
      warnById={warnById} addBlankWall={addBlankWall}
    />
  );

  const workspaceNode = (
    <>
      <EstimateModeSelector visible={!out.empty} mode={mode} setMode={setMode} />

      <SectionLabel icon={<Gauge size={13} />}>Selected item metrics</SectionLabel>
      <StatsGrid stats={selectedItemStats} />

      <SectionLabel icon={<Settings size={13} />}>{`Calculator workspace — ${workspaceTitle}`}</SectionLabel>
      <WallsCard
        walls={walls}
        active={active} update={update}
        duplicateWall={duplicateWall} deleteWall={deleteWall} showTypes={false}
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
            <WallPreviewSection active={active} walls={walls} out={out} />
            <SpanTable orient={orient} type={78} />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon={<Lock size={13} />} label="Tracks and flashing" defaultOpen>
        <EdgeRestraintSelector
          edges={active.edges}
          onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
          options={edgeOptions}
          orient={orient}
          corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
        />
      </CollapsibleSection>

      <WarningsList warnings={!out.empty ? out.warnings : null} />
    </>
  );

  const mainNode = (
    <>
      {workspaceNode}

      {!project && (
        <SingleWallMaterialsSection
          active={active} out={out} orient={orient} layoutMode={layoutMode}
          showTakeoff={showTakeoff} setShowTakeoff={setShowTakeoff} ScheduleComp={ScheduleComp}
        />
      )}

      {project && (
        <>
          <ProjectSeparator />
          <EstimateResultsCard
            layoutMode={layoutMode} results={results}
            activeId={activeId} onSelectWall={setActiveId}
            warnById={warnById} toDisp={toDisp} dimUnit={dimUnit}
            projAgg={projAgg} combinedEstimate={combinedEstimate}
            active={active} out={out} orient={orient} ScheduleComp={ScheduleComp}
            onReviewOrder={() => setOrderDrawerOpen(true)} orderLineItemCount={orderLineItemCount}
          />
        </>
      )}
    </>
  );

  const hasExportData = project
    ? projAgg.panels > 0
    : !(out.empty || !out.result);
  const handleExport = () => exportEstimateToExcel(buildExternalReportData({
    extMode: mode, orient, dimUnit, toDisp, walls, results, warnById, active, out,
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
  // Mobile-only sticky summary bar -- project mode only, mirrors Internal's.
  const stickyBarNode = project && layoutMode === "phone" && (
    <StickyBar
      view="project" wallStats={[]} projectStats={stickyProjectStats}
      onReviewOrder={() => setOrderDrawerOpen(true)} lineItemCount={orderLineItemCount}
    />
  );

  if (layoutMode === "phone") {
    return <div>{sidebarNode}{mainNode}{footerNode}{stickyBarNode}{orderDrawerNode}</div>;
  }
  return (
    <>
      <CalculatorShell sidebar={sidebarNode} main={mainNode} footer={footerNode} sidebarWidth={320} />
      {orderDrawerNode}
    </>
  );
}
