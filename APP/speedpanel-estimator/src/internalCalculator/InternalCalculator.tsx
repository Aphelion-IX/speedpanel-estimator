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
//
// Phone layout (mockup-matched, see phoneShell.tsx/wallCanvasPhone.tsx/
// advancedSetupSheet.tsx/wallTabsPhone.tsx) diverges structurally from web
// below mode/kit-selection: web keeps the original WallsCard + Wall geometry
// + Tracks-and-flashing accordion stack, phone replaces it with the
// mockup's command card / rail / canvas / advanced-setup sheet / live
// result / 4-tab composition. EstimateModeSelector (single-wall vs project)
// is web-only now -- the phone layout's per-wall tabs and sticky project
// totals no longer change with `mode`, so showing the toggle on phone would
// promise behaviour it no longer has.
// =============================================================================
import { useState, useEffect, useMemo } from "react";
import { Frame, Gauge, Lock, Settings } from "lucide-react";
import { cx, NAVY } from "../styleTokens";
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
  SectionLabel, WarningsList, EstimateModeSelector, UnitToggle, CalculatorShell,
  CollapsibleSection, StatsGrid,
} from "../ui/primitives";
import { LockedDataInt, LockedDataFooter } from "../ui/lockedData";
import { PanelLengthSection, type PanelLengthSectionProps } from "../ui/lengthExplorer";
import { WallsCard } from "../ui/wallsCard";
import { EstimateStructureNav } from "./estimateStructureNav";
import { KitWorkspace } from "./kitWorkspace";
import { KitWorkspacePhone } from "./kitWorkspacePhone";
import {
  CommandCardPhone, SheetHeaderPhone, StickyBarPhone, LiveWallResultPhone,
  deriveWallStatus, countActionsNeeded,
} from "./phoneShell";
import { WallCanvasPhone } from "./wallCanvasPhone";
import { AdvancedSetupSheetPhone } from "./advancedSetupSheet";
import { WallTabsPhone } from "./wallTabsPhone";
import {
  ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
  type EdgeRestraintProps, type FinishKey, type CornersField,
} from "../ui/wallConfig";
import { WallPreviewSection } from "../ui/wallPreview";
import { PanelScheduleCard, PanelScheduleTable } from "../ui/scheduleCards";
import { SingleWallEstimateSection } from "./mainSections";
import { EstimateResultsCard } from "./estimateResultsCard";
import { OrderReviewDrawer } from "./orderReviewDrawer";
import { buildInternalReportData } from "../export/buildInternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";

export function InternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode, mode, setMode, showWall, setShowWall, linkCornerPartner, linkShaftPartner, projectName, onSwitchToExternal }: {
  store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string;
  setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout;
  mode: string; setMode: (m: string) => void;
  showWall: boolean; setShowWall: (v: boolean) => void;
  linkCornerPartner: (targetId: number | null) => void;
  linkShaftPartner: (targetId: number | null) => void;
  projectName?: string;
  onSwitchToExternal?: () => void;
}) {
  const [showTrackFinish, setShowTrackFinish] = useState(false);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
  // Phone-only sheet header: same underlying data as workspaceTitle above,
  // just split into a title/crumb/status shape for SheetHeaderPhone.
  const sheetTitle = selectedKit ? kitLabel(selectedKit, kits) : active.name;
  const sheetCrumb = selectedKit
    ? `${selectedKit.wallAName} ↔ ${selectedKit.wallBName}`
    : `${active.orient === "vertical" ? "Vertical" : "Horizontal"} · P${active.type}`;
  const sheetStatus = selectedKit ? "linked" as const : deriveWallStatus(active, out);
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
  // Phone-only 4-stat row (matches the mockup exactly: area/panels/length/
  // waste) -- kept separate from the 6-stat web version above rather than
  // trimming it, since web's extra Panel type/Config stats stay useful there.
  const phoneWallStats = out.empty
    ? [{ value: "--", label: "m2" }, { value: "--", label: "Panels" }, { value: "--", label: "Length" }, { value: "--", label: "Waste" }]
    : [
        { value: `${out.area} m2`, label: "m2" },
        { value: out.chosen?.panels ?? out.result?.panels ?? "--", label: "Panels" },
        { value: stockLengthLabel(out.chosen?.groups), label: "Length" },
        { value: `${r1(out.chosen?.wastePct ?? 0)}%`, label: "Waste" },
      ];

  // Shared prop objects for the panel-length and edge-restraint blocks --
  // built once so web's inline sections and phone's Advanced setup sheet
  // render the exact same live-wired controls, not two copies that could
  // drift apart.
  const onEdgeToggle = (k: keyof Wall["edges"]) => update({ edges: { ...active.edges, [k]: !active.edges[k] } });
  const edgeRestraintProps: EdgeRestraintProps = {
    edges: active.edges,
    onEdgeToggle,
    options: [{ key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) }],
    orient,
    locked: orient === "horizontal" && active.wallSystem === "standard",
    showTrackFinish, setShowTrackFinish,
    activeFinishes: { headFinish: active.headFinish, bottomFinish: active.bottomFinish, leftFinish: active.leftFinish, rightFinish: active.rightFinish },
    onFinishChange: (field, val) => update({ [field]: val } as Pick<Wall, FinishKey>),
    corners: { intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) },
  };
  const panelLengthSectionProps: PanelLengthSectionProps = {
    dimUnit, out, active, walls,
    projectLock, projectStock, customLengthInput, customActive,
    stocks: STOCK_LENGTHS, packType: active.type,
    update, setProjectLength, commitCustomLength, toggleCustom, clearCustomLength,
  };

  const sidebarNode = (
    <EstimateStructureNav
      walls={walls} results={results} kits={kits}
      selected={selectedNavItem} onSelect={handleSelectNavItem}
      warnById={warnById}
      addBlankWall={addBlankWall} addCornerWall={addCornerWall} addShaftWall={addShaftWall}
      layoutMode={layoutMode}
    />
  );

  const workspaceNode = (
    <>
      {layoutMode !== "phone" && <EstimateModeSelector visible={!out.empty} mode={mode} setMode={setMode} />}

      {layoutMode === "phone" ? (
        <SheetHeaderPhone title={sheetTitle} crumb={sheetCrumb} status={sheetStatus}
          stats={selectedKit ? selectedItemStats : phoneWallStats} statsColumns={4} />
      ) : (
        <>
          <SectionLabel icon={<Gauge size={13} />}>Selected item metrics</SectionLabel>
          <StatsGrid stats={selectedItemStats} />
          <SectionLabel icon={<Settings size={13} />}>{`Calculator workspace — ${workspaceTitle}`}</SectionLabel>
        </>
      )}

      {selectedKit ? (
        layoutMode === "phone"
          ? <KitWorkspacePhone kit={selectedKit} onSelect={handleSelectNavItem} />
          : <KitWorkspace kit={selectedKit} onSelect={handleSelectNavItem} />
      ) : layoutMode === "phone" ? (
        <>
          <WallCanvasPhone
            active={active} out={out} dimUnit={dimUnit} switchDimUnit={switchDimUnit}
            toDisp={toDisp} updDim={updDim}
            onProfileChange={id => update({ profile: id })}
            onEdgeToggle={onEdgeToggle}
          />

          <div className="mt-3">
            <WallsCard
              walls={walls}
              active={active} update={update}
              duplicateWall={duplicateWall} deleteWall={deleteWall}
              showTypes={true} systemSelector={systemSelector} orient={orient}
              onCornerLink={linkCornerPartner}
              onShaftLink={linkShaftPartner}
              onJunctionLink={linkJunctionPartner}
            />
          </div>

          <button onClick={() => setAdvancedOpen(true)}
            className="mt-3 flex w-full min-h-[52px] items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-left active:scale-[0.99] transition-all">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-white"><Settings size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold" style={{ color: NAVY }}>Advanced setup</span>
              <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">Optimisation, finishes, fixings and project rules</span>
            </span>
            <span className="shrink-0 text-lg text-slate-400 dark:text-slate-500">›</span>
          </button>

          <LiveWallResultPhone out={out} />

          <WallTabsPhone active={active} out={out} orient={orient} walls={walls} ScheduleComp={ScheduleComp} />
        </>
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
                {project && <WallPreviewSection active={active} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} />}
                <SpanTable orient={orient} type={active.type} wallSystem={active.wallSystem} />
              </div>
              <PanelLengthSection {...panelLengthSectionProps} />
            </div>
          </CollapsibleSection>

          {/* Tracks and flashing */}
          <CollapsibleSection icon={<Lock size={13} />} label="Tracks and flashing" defaultOpen>
            <EdgeRestraintSelector {...edgeRestraintProps} />
          </CollapsibleSection>

          <WarningsList warnings={!out.empty ? out.warnings : null} />
        </>
      )}
    </>
  );

  const mainNode = (
    <>
      {workspaceNode}

      {/* Single wall estimate -- web-only; phone's WallTabsPhone Schedule tab covers this. */}
      {!project && layoutMode !== "phone" && (
        <SingleWallEstimateSection
          active={active} out={out} orient={orient} layoutMode={layoutMode}
          showWall={showWall} setShowWall={setShowWall} ScheduleComp={ScheduleComp}
          walls={walls} cornerPair={cornerPair} shaftPair={shaftPair}
        />
      )}

      {/* Estimate Results: Overview / Selected Wall / Connections / Order tabs --
          web-only; on phone this is superseded by the sticky bar's project
          totals, the Review Order sheet, and WallTabsPhone's per-wall tabs. */}
      {project && layoutMode !== "phone" && (
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
  const advancedSheetNode = layoutMode === "phone" && (
    <AdvancedSetupSheetPhone
      open={advancedOpen} onClose={() => setAdvancedOpen(false)} layoutMode={layoutMode}
      active={active} orient={orient}
      panelLength={panelLengthSectionProps} edgeRestraint={edgeRestraintProps}
    />
  );
  // Mobile-only sticky summary bar -- shown regardless of single-wall/project
  // mode (projChosenAgg is already computed unconditionally, so this
  // degrades correctly to that one wall's own totals outside project mode).
  const stickyBarNode = layoutMode === "phone" && (
    <StickyBarPhone
      areaLabel={`${projChosenAgg.totalArea} m2`} panelsLabel={`${projChosenAgg.totalPanels} panels`}
      materialLines={orderLineItemCount} actionsCount={countActionsNeeded(results)}
      onReviewOrder={() => setOrderDrawerOpen(true)}
    />
  );
  const commandCardNode = layoutMode === "phone" && (
    <CommandCardPhone
      projectName={projectName} results={results} kits={kits}
      addBlankWall={addBlankWall}
      onSwitchToExternal={onSwitchToExternal ?? (() => {})}
    />
  );

  if (layoutMode === "phone") return <>{commandCardNode}{sidebarNode}{mainNode}{stickyBarNode}{orderDrawerNode}{advancedSheetNode}</>;
  return (
    <>
      <CalculatorShell sidebar={sidebarNode} main={mainNode} footer={footerNode} sidebarWidth={320} />
      {orderDrawerNode}
    </>
  );
}
