// =============================================================================
// Internal Calculator
// =============================================================================
// The Internal calculator (P51/P64/P78, vertical or horizontal, Standard/
// Corner/Shaft wall systems). Shares the same wall store as the External
// calculator (passed down from the root component) so walls survive
// switching between Internal/External and orientation. mode stays lifted as
// a prop -- the root component persists it across sessions -- while
// showTrackFinish is local UI-only state, and results/aggregate/corner-
// shaft-pair/combined estimate are computed independently here, mirroring
// ExternalCalculator's own independent compute calls on the same shared
// `walls` array.
// =============================================================================
import { useState, useMemo } from "react";
import { Frame, Lock, Settings } from "lucide-react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { compute } from "../estimate/computeWall";
import { aggregate, collectProjectWarnings } from "../estimate/aggregate";
import { r1 } from "../estimate/mathUtils";
import { plural } from "../estimate/computeUtils";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { computeCornerPair, computeShaftPair } from "../estimate/cornerShaftKits";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, STOCK_LENGTHS, INT_CONFIG, TYPES } from "../data";
import type { ComputeOut, Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, WarningsList, EstimateModeSelector, UnitToggle, CalculatorShell,
  CollapsibleSection,
} from "../ui/primitives";
import {
  WorkspaceCard, SummaryTiles, MetricTile, ExpandableTile, WallRowCard, ExpandableOrderDetails,
} from "../ui/estimateWorkspace";
import { LockedDataInt, LockedDataFooter } from "../ui/lockedData";
import { EstimatorActionBar } from "../appShell/EstimatorActionBar";
import { PanelLengthSection } from "../ui/lengthExplorer";
import { WallsCard } from "../ui/wallsCard";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "../ui/wallConfig";
import type { FinishKey, CornersField } from "../ui/wallConfig";
import { PanelScheduleCard, PanelScheduleTable, ConnectionBreakdownCard } from "../ui/scheduleCards";
import { SingleWallEstimateContent, SystemBreakdownSection, EasyToOrderSection } from "./mainSections";
import { buildInternalReportData } from "../export/buildInternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

// --- Accessory row builders -----------------------------------------------
// Track/flashing (linear metres), screws (box counts) and sealant (box +
// sausage counts) are different units -- there's no honest single combined
// "accessories" number, so the summary tile shows a category count and
// expands into these per-category rows instead (see ui/estimateWorkspace's
// ExpandableTile). Only non-zero categories are included.
function buildAccessoryRowsSingle(out: ComputeOut): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (out.cLM) rows.push({ label: "C-track", value: `${out.cLM} m` });
  if (out.jLM) rows.push({ label: "J-track", value: `${out.jLM} m` });
  if (out.flashLM) rows.push({ label: "Head flashing", value: `${out.flashLM} m` });
  if (out.vertTrackLM) rows.push({ label: "Vertical track", value: `${out.vertTrackLM} m` });
  if (out.stripLM) rows.push({ label: "Protection strip", value: `${out.stripLM} m` });
  if (out.boxes30) rows.push({ label: "10g 30mm SDS", value: `${out.boxes30} box${plural(out.boxes30)}` });
  if (out.boxes16) rows.push({ label: "10g 16mm SDS", value: `${out.boxes16} box${plural(out.boxes16)}` });
  if (out.sealantBoxes) rows.push({ label: "Sealant", value: `${out.sealantBoxes} box${plural(out.sealantBoxes)} (${out.sausages ?? 0} sausages)` });
  return rows;
}
function buildAccessoryRowsProject(agg: ReturnType<typeof aggregate>, connectionLM: number): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const cLMTotal = agg.cTracks.reduce((a, c) => a + c.lm, 0);
  if (cLMTotal) rows.push({ label: "C-track", value: `${r1(cLMTotal)} m` });
  if (agg.jLM) rows.push({ label: "J-track", value: `${agg.jLM} m` });
  if (agg.flashLM) rows.push({ label: "Head flashing", value: `${agg.flashLM} m` });
  if (agg.vertTrackLM) rows.push({ label: "Vertical track", value: `${agg.vertTrackLM} m` });
  if (agg.stripLM) rows.push({ label: "Protection strip", value: `${agg.stripLM} m` });
  if (agg.cornerPostLM) rows.push({ label: "Corner post", value: `${agg.cornerPostLM} m` });
  if (agg.junctionLM) rows.push({ label: "Junction track", value: `${agg.junctionLM} m` });
  if (connectionLM) rows.push({ label: "Connection track", value: `${r1(connectionLM)} m` });
  if (agg.boxes30) rows.push({ label: "10g 30mm SDS", value: `${agg.boxes30} box${plural(agg.boxes30)}` });
  if (agg.boxes16) rows.push({ label: "10g 16mm SDS", value: `${agg.boxes16} box${plural(agg.boxes16)}` });
  if (agg.sealantBoxes) rows.push({ label: "Sealant", value: `${agg.sealantBoxes} box${plural(agg.sealantBoxes)} (${agg.sausages} sausages)` });
  return rows;
}

export function InternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode, mode, setMode, linkCornerPartner, linkShaftPartner }: {
  store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string;
  setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout;
  mode: string; setMode: (m: string) => void;
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
  const dim = (m: string) => (m ? `${toDisp(m)} ${dimUnit}` : "--");

  const sidebarNode = (
    <>
      <SectionLabel icon={<Settings size={13} />} step={1}>System configuration</SectionLabel>
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
      <CollapsibleSection icon={<Frame size={13} />} step={2} label="Wall geometry" defaultOpen>
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

      {/* Tracks and flashing */}
      <CollapsibleSection icon={<Lock size={13} />} step={3} label="Tracks and flashing" defaultOpen={false}>
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
      <EstimateModeSelector visible={!out.empty} mode={mode} setMode={setMode} />
    </>
  );

  const singleAccessoryRows = useMemo(() => buildAccessoryRowsSingle(out), [out]);
  const projectAccessoryRows = useMemo(
    () => buildAccessoryRowsProject(projChosenAgg, combinedEstimate.connectionLM),
    [projChosenAgg, combinedEstimate.connectionLM]
  );
  const projectWarnings = useMemo(() => collectProjectWarnings(results), [results]);

  const mainNode = (
    <>
      {/* Single wall estimate */}
      {!project && (
        <>
          <WorkspaceCard title="Calculator Workspace" badge={active.name}>
            <SingleWallEstimateContent
              active={active} out={out} orient={orient} layoutMode={layoutMode}
              ScheduleComp={ScheduleComp} walls={walls} cornerPair={cornerPair} shaftPair={shaftPair}
            />
          </WorkspaceCard>
          <SummaryTiles tiles={[
            <MetricTile key="panels" label="Panels" value={!out.empty && out.chosen && !out.chosen.invalid ? out.chosen.panels : "--"} />,
            <ExpandableTile key="accessories" label="Accessories" compactValue={singleAccessoryRows.length} rows={singleAccessoryRows} />,
            <ExpandableTile key="warnings" label="Warnings" tone="warn"
              compactValue={out.warnings?.length ?? 0}
              rows={(out.warnings ?? []).map(msg => ({ label: "Warning", value: msg }))} />,
          ]} />
        </>
      )}

      {/* Combined estimate: Project Workspace -> summary -> full order details */}
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
                  typeLabel={`${TYPES.find(t => t.id === w.type)?.depth ?? `P${w.type}`} · ${w.orient === "vertical" ? "Vertical" : "Horizontal"}`}
                  dimLabel={`${dim(w.width)} × ${dim(w.height)}`}
                  panelsLabel={!o.empty && o.chosen && !o.chosen.invalid ? `${o.chosen.panels} panels` : "-- panels"}
                  onEdit={() => setActiveId(w.id)}
                  onDuplicate={() => duplicateWall(w.id)}
                  onDelete={() => deleteWall(w.id)}
                  deletable={walls.length > 1}
                />
              ))}
            </div>
          </WorkspaceCard>

          <SummaryTiles tiles={[
            <MetricTile key="panels" label="Total panels" value={projChosenAgg.totalPanels} />,
            <ExpandableTile key="accessories" label="Accessories" compactValue={projectAccessoryRows.length} rows={projectAccessoryRows} />,
            <ExpandableTile key="warnings" label="Warnings" tone="warn"
              compactValue={projectWarnings.length}
              rows={projectWarnings.map(w => ({ label: w.wallName, value: w.msg }))} />,
          ]} />

          <ExpandableOrderDetails>
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
          </ExpandableOrderDetails>
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

  return (
    <>
      {layoutMode === "phone"
        ? <>{sidebarNode}{mainNode}{footerNode}</>
        : <CalculatorShell sidebar={sidebarNode} main={mainNode} footer={footerNode} />}
      <EstimatorActionBar disabled={!hasExportData} onExport={handleExport} />
    </>
  );
}
