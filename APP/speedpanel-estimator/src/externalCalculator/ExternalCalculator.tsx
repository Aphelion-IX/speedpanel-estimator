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
import { Box, Frame, Lock, Settings } from "lucide-react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { computeExternal } from "../estimate/computeWall";
import { buildExtProjAgg, collectProjectWarnings } from "../estimate/aggregate";
import { plural } from "../estimate/computeUtils";
import { r1 } from "../estimate/mathUtils";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, EXT_STOCK } from "../data";
import type { ComputeOut, Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, WarningsList, EstimateModeSelector, UnitToggle, CalculatorShell,
  CollapsibleSection,
} from "../ui/primitives";
import {
  WorkspaceCard, SummaryTiles, MetricTile, ExpandableTile, WallRowCard, ExpandableOrderDetails,
} from "../ui/estimateWorkspace";
import { LockedDataExt, LockedDataFooter } from "../ui/lockedData";
import { EstimatorActionBar } from "../appShell/EstimatorActionBar";
import { PanelLengthSection } from "../ui/lengthExplorer";
import { WallsCard } from "../ui/wallsCard";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "../ui/wallConfig";
import type { CornersField } from "../ui/wallConfig";
import { PanelScheduleCard, PanelScheduleTable, ConnectionBreakdownCard } from "../ui/scheduleCards";
import { PanelColourSection } from "./panelColourSection";
import { SingleWallMaterialsContent, SystemBreakdownSection, EasyToOrderSectionExt } from "./mainSections";
import { buildExternalReportData } from "../export/buildExternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

// --- Accessory row builders -----------------------------------------------
// Track/flashing (linear metres), screws (box counts) and sealant (box +
// sausage counts) are different units -- there's no honest single combined
// "accessories" number, so the summary tile shows a category count and
// expands into these per-category rows instead (see ui/estimateWorkspace's
// ExpandableTile). Only non-zero categories are included.
function buildAccessoryRowsExtSingle(out: ComputeOut): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (out.cLM) rows.push({ label: "C-track", value: `${out.cLM} m` });
  if (out.jLM) rows.push({ label: "J-track", value: `${out.jLM} m` });
  if (out.zLM) rows.push({ label: "Z-flashing", value: `${out.zLM} m` });
  if (out.flashLM) rows.push({ label: "Head flashing", value: `${out.flashLM} m` });
  if (out.boxes30) rows.push({ label: "10g 30mm SDS", value: `${out.boxes30} box${plural(out.boxes30)}` });
  if (out.boxes16) rows.push({ label: "10g 16mm SDS", value: `${out.boxes16} box${plural(out.boxes16)}` });
  if (out.sealantBoxes) rows.push({ label: "Sealant", value: `${out.sealantBoxes} box${plural(out.sealantBoxes)} (${out.sausages ?? 0} sausages)` });
  return rows;
}
function buildAccessoryRowsExtProject(agg: ReturnType<typeof buildExtProjAgg>, connectionLM: number): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (agg.cLM) rows.push({ label: "C-track", value: `${agg.cLM} m` });
  if (agg.jLM) rows.push({ label: "J-track", value: `${agg.jLM} m` });
  if (agg.zLM) rows.push({ label: "Z-flashing", value: `${agg.zLM} m` });
  if (agg.flashLM) rows.push({ label: "Head flashing", value: `${agg.flashLM} m` });
  if (connectionLM) rows.push({ label: "Connection track", value: `${r1(connectionLM)} m` });
  if (agg.boxes30) rows.push({ label: "10g 30mm SDS", value: `${agg.boxes30} box${plural(agg.boxes30)}` });
  if (agg.boxes16) rows.push({ label: "10g 16mm SDS", value: `${agg.boxes16} box${plural(agg.boxes16)}` });
  if (agg.sealantBoxes) rows.push({ label: "Sealant", value: `${agg.sealantBoxes} box${plural(agg.sealantBoxes)} (${agg.sausages} sausages)` });
  return rows;
}

// --- ExternalCalculator -------------------------------------------------------
// orient is derived from sys.orient in the parent and passed as a prop. The
// wall list comes from the shared `store` (owned by SpeedpanelEstimator) so it
// survives switching in/out of External mode. orient stays in useWallResults'
// dependency array to prevent stale compute if this component is kept mounted
// across orientation switches.
export function ExternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode }: { store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string; setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout }) {
  const [extMode, setExtMode] = useState("project");

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
  const dim = (m: string) => (m ? `${toDisp(m)} ${dimUnit}` : "--");

  const sidebarNode = (
    <>
      <SectionLabel icon={<Settings size={13} />} step={1}>System configuration</SectionLabel>
      <WallsCard
        walls={walls} results={results} activeId={activeId} setActiveId={setActiveId}
        active={active} update={update} addBlankWall={addBlankWall}
        duplicateWall={duplicateWall} deleteWall={deleteWall} warnById={warnById} showTypes={false}
        systemSelector={systemSelector} orient={orient}
        onJunctionLink={linkJunctionPartner}
      />

      <CollapsibleSection icon={<Box size={13} />} step={2} label="Panel configuration" defaultOpen>
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

      <CollapsibleSection icon={<Frame size={13} />} step={3} label="Wall geometry" defaultOpen>
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

      <CollapsibleSection icon={<Lock size={13} />} step={4} label="Tracks and flashing" defaultOpen={false}>
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

  const singleAccessoryRows = useMemo(() => buildAccessoryRowsExtSingle(out), [out]);
  const projectAccessoryRows = useMemo(
    () => buildAccessoryRowsExtProject(projAgg, combinedEstimate.connectionLM),
    [projAgg, combinedEstimate.connectionLM]
  );
  const projectWarnings = useMemo(() => collectProjectWarnings(results), [results]);

  const mainNode = (
    <>
      {!project && (
        <>
          <WorkspaceCard title="Calculator Workspace" badge={active.name}>
            <SingleWallMaterialsContent
              active={active} out={out} orient={orient} layoutMode={layoutMode} ScheduleComp={ScheduleComp}
            />
          </WorkspaceCard>
          <SummaryTiles tiles={[
            <MetricTile key="panels" label="Panels" value={!out.empty && out.result ? out.result.panels : "--"} />,
            <ExpandableTile key="accessories" label="Accessories" compactValue={singleAccessoryRows.length} rows={singleAccessoryRows} />,
            <ExpandableTile key="warnings" label="Warnings" tone="warn"
              compactValue={out.warnings?.length ?? 0}
              rows={(out.warnings ?? []).map(msg => ({ label: "Warning", value: msg }))} />,
          ]} />
        </>
      )}

      {project && (
        <>
          <ProjectSeparator />

          <WorkspaceCard title="Project Workspace" badge={`${walls.length} wall${walls.length !== 1 ? "s" : ""}`}>
            <button onClick={addBlankWall}
              className="w-full rounded-xl border border-dashed py-3 text-sm font-bold active:scale-[0.99] transition-all bg-white dark:bg-slate-800"
              style={{ borderColor: "var(--blue)", color: "var(--blue)" }}>
              + Add wall
            </button>
            <div className="space-y-2">
              {results.map(({ wall: w, out: o }) => (
                <WallRowCard key={w.id} wall={w} active={w.id === activeId} warn={warnById[w.id]}
                  typeLabel={`P78 · ${w.orient === "vertical" ? "Vertical" : "Horizontal"}`}
                  dimLabel={`${dim(w.width)} × ${dim(w.height)}`}
                  panelsLabel={!o.empty && o.result ? `${o.result.panels} panels` : "-- panels"}
                  onEdit={() => setActiveId(w.id)}
                  onDuplicate={() => duplicateWall(w.id)}
                  onDelete={() => deleteWall(w.id)}
                  deletable={walls.length > 1}
                />
              ))}
            </div>
          </WorkspaceCard>

          <SummaryTiles tiles={[
            <MetricTile key="panels" label="Total panels" value={projAgg.panels} />,
            <ExpandableTile key="accessories" label="Accessories" compactValue={projectAccessoryRows.length} rows={projectAccessoryRows} />,
            <ExpandableTile key="warnings" label="Warnings" tone="warn"
              compactValue={projectWarnings.length}
              rows={projectWarnings.map(w => ({ label: w.wallName, value: w.msg }))} />,
          ]} />

          <ExpandableOrderDetails>
            {/* System Breakdown: shows HOW the estimate was built, wall by wall */}
            <SystemBreakdownSection layoutMode={layoutMode} results={results} ScheduleComp={ScheduleComp} />

            {/* Connection Breakdown: shows WHY extra materials were added */}
            <SectionLabel icon={<Frame size={13} />}>Connection breakdown</SectionLabel>
            <ConnectionBreakdownCard connections={combinedEstimate.connections} />

            {/* Easy to Order: shows WHAT needs to be ordered -- one combined material list */}
            <EasyToOrderSectionExt layoutMode={layoutMode} projAgg={projAgg} combinedEstimate={combinedEstimate} />
          </ExpandableOrderDetails>
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

  return (
    <>
      {layoutMode === "phone"
        ? <div>{sidebarNode}{mainNode}{footerNode}</div>
        : <CalculatorShell sidebar={sidebarNode} main={mainNode} footer={footerNode} />}
      <EstimatorActionBar disabled={!hasExportData} onExport={handleExport} />
    </>
  );
}
