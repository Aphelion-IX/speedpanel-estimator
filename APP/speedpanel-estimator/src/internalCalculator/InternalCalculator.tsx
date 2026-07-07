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
import { ChevronDown, Box, Frame, Layers, Lock, Settings, Hammer } from "lucide-react";
import { cx } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { compute } from "../estimate/computeWall";
import { aggregate } from "../estimate/aggregate";
import type { AggPanelEntry, AggCustomEntry } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { computeCornerPair, computeShaftPair } from "../estimate/cornerShaftKits";
import { r1 } from "../estimate/mathUtils";
import { plural } from "../estimate/computeUtils";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, PACK, STOCK_LENGTHS, INT_CONFIG } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, CardGrid, StatsRow, NotesList, WarningsList, EstimateModeSelector,
  Card, Row, ToggleSwitch, UnitToggle, ProjectLockNote, CalculatorShell,
} from "../ui/primitives";
import { LockedDataInt } from "../ui/lockedData";
import { LengthExplorer } from "../ui/lengthExplorer";
import { WallsCard, WallsSummaryTable } from "../ui/wallsCard";
import {
  CustomLengthSection, ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "../ui/wallConfig";
import type { FinishKey, CornersField } from "../ui/wallConfig";
import {
  PanelScheduleCard, PanelScheduleTable, FixingSealantCard, StockGroupRow, ConnectionBreakdownCard,
  PackNote, ScheduleRow,
} from "../ui/scheduleCards";
import { CornerKitCard, ShaftVerticalCard, ShaftSlabCard, ShaftJunctionCard } from "./kitCards";
import { TrackFlashingCardInt, TrackFlashingCardIntProj } from "./trackFlashingCards";
import { SystemBreakdownWallCard } from "./systemBreakdownCard";

export function InternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode, mode, setMode, showWall, setShowWall, linkCornerPartner, linkShaftPartner }: {
  store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string;
  setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout;
  mode: string; setMode: (m: string) => void;
  showWall: boolean; setShowWall: (v: boolean) => void;
  linkCornerPartner: (targetId: number | null) => void;
  linkShaftPartner: (targetId: number | null) => void;
}) {
  const [showTrackFinish, setShowTrackFinish] = useState(false);
  const [showData, setShowData] = useState(false);

  const {
    walls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, toM, updDim,
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
          <DimensionInputs active={active} toDisp={toDisp} toM={toM} updDim={updDim} onUpdate={update} out={out} orient={orient} />
          <SpanTable orient={orient} type={active.type} wallSystem={active.wallSystem} />
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Panel length</span>
            <ToggleSwitch
              active={projectLock}
              label={projectLock ? "Project locked" : "Lock to project"}
              onToggle={() => {
                const currentStock = projectLock ? projectStock : (active.forcedStock || "");
                setProjectLength(customActive ? "" : currentStock, !projectLock);
                if (projectLock) { clearCustomLength(); }
              }}
            />
          </div>
          <LengthExplorer
            pieces={"pieces" in out && out.pieces ? out.pieces : []}
            stocks={STOCK_LENGTHS}
            packType={active.type}
            currentStock={customActive ? "" : (projectLock ? projectStock : (active.forcedStock || ""))}
            onSelect={val => {
              clearCustomLength();
              if (projectLock) { setProjectLength(val, true); }
              else { update({ forcedStock: val }); }
            }}
          />

          {/* Custom length -- same visual treatment as the panel length selector above */}
          <CustomLengthSection
            dimUnit={dimUnit} customLengthInput={customLengthInput} customActive={customActive}
            projectLock={projectLock} projectStock={projectStock} wallCount={walls.length}
            commitCustomLength={commitCustomLength} toggleCustom={toggleCustom}
          />

          {/* Project lock confirmation for stocked lengths */}
          {projectLock && !customActive && projectStock && (
            <ProjectLockNote wallCount={walls.length} stock={projectStock} dimUnit={dimUnit} />
          )}
        </div>
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
      {!out.empty && !project && out.chosen && !out.chosen.invalid && (
        <>
          <button onClick={() => setShowWall(!showWall)} className={cx.accordion}>
            <span>Wall estimate -- {active.name}</span>
            <ChevronDown size={15} className={`transition-transform ${showWall ? "rotate-180" : ""}`} />
          </button>
          {showWall && (
            <div className="mt-3">
              <StatsRow area={`${out.area} m2`} panels={out.chosen.panels} panelType={`P${active.type}`} />
              <CardGrid layoutMode={layoutMode} minWidth={420}>
                <ScheduleComp title={`Panel schedule -- P${active.type}`} icon={<Box size={14} />}
                  customSchedule={out.customSchedule}
                  groups={out.chosen.groups}
                  packSize={PACK[active.type]} stocks={STOCK_LENGTHS}
                  wastePct={out.chosen.wastePct} orient={orient} />
                <TrackFlashingCardInt out={out} headFlashActive={active.headFlash} wall={active} />
                {active.wallSystem === "shaft" && <ShaftVerticalCard out={out} />}
                {cornerPair && (() => {
                  const partner = walls.find(w => w.id === active.cornerPartnerId);
                  return <CornerKitCard kit={cornerPair} partnerName={partner ? partner.name : "linked run"} />;
                })()}
                {shaftPair && (() => {
                  const partner = walls.find(w => w.id === active.shaftPartnerId);
                  return <ShaftJunctionCard kit={shaftPair} partnerName={partner ? partner.name : "linked wall"} />;
                })()}
                {active.wallSystem === "shaft" && <ShaftSlabCard out={out} />}
                <FixingSealantCard title="Fixing and sealant quantities"
                  boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                  boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                  sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                  sealantLabel="Hilti CP606 sealant" sealantRate={4}
                  p2pNote={out.p2pNote} p2pEnhanced={out.p2pEnhanced} />
              </CardGrid>
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </div>
          )}
        </>
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
          <SectionLabel icon={<Layers size={13} />}>System breakdown</SectionLabel>
          <CardGrid layoutMode={layoutMode} minWidth={420}>
            {results.map(({ wall: w, out: o }) => (
              <SystemBreakdownWallCard key={w.id} wall={w} out={o} walls={walls} ScheduleComp={ScheduleComp} />
            ))}
          </CardGrid>

          {/* Connection Breakdown: shows WHY extra materials were added */}
          <SectionLabel icon={<Frame size={13} />}>Connection breakdown</SectionLabel>
          <ConnectionBreakdownCard connections={combinedEstimate.connections} />

          {/* Easy to Order: shows WHAT needs to be ordered -- one combined material list */}
          <SectionLabel icon={<Box size={13} />}>Easy to order -- combined material summary</SectionLabel>
          <StatsRow
            area={projChosenAgg ? `${projChosenAgg.totalArea} m2` : "--"}
            panels={projChosenAgg ? projChosenAgg.totalPanels : "--"}
            panelType={`P${active.type}`}
          />
          <CardGrid layoutMode={layoutMode} minWidth={300}>
            <Card title="Project order estimate" icon={<Box size={14} />}>
              {projChosenAgg && (
                <>
                  {projChosenAgg.panels.map((p: AggPanelEntry, i: number) => (
                    <StockGroupRow key={i}
                      stock={p.stock} ordered={p.ordered} pieces={p.pieces}
                      packs={p.packs} packSize={p.ps ?? PACK[p.type]} spare={p.spare}
                      stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.panels.length - 1 && projChosenAgg.customPanels.length === 0}
                      typeLabel={`P${p.type}`}
                      packNote={(p.underPack || p.spare > 3) ? <PackNote type={p.type} spare={p.spare} /> : undefined}
                    />
                  ))}
                  {projChosenAgg.customPanels.length > 0 && (
                    <>
                      {projChosenAgg.panels.length > 0 && <p className={cx.cardHd + " pt-2 pb-1"}>Custom lengths</p>}
                      {projChosenAgg.customPanels.map((s: AggCustomEntry, i: number) => (
                        <div key={i}>
                          <ScheduleRow mm={s.mm} ordered={s.ordered} qty={s.qty} packs={s.packs} packSize={s.packSize} stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.customPanels.length - 1} />
                          {(s.qty < s.packSize || s.spare > 3) && <PackNote type={s.type} spare={s.spare} />}
                        </div>
                      ))}
                    </>
                  )}
                  {projChosenAgg.panels.length === 0 && projChosenAgg.customPanels.length === 0 && <Row k="No panels yet" v="--" dim />}
                  <div className={cx.hr}><Row k="Wastage (order)" v={`${r1(projChosenAgg.wastePct)}%`} dim /></div>
                </>
              )}
              {!projChosenAgg && <Row k="No panels yet" v="--" dim />}
            </Card>
            <TrackFlashingCardIntProj agg={projChosenAgg}
              connectionLM={combinedEstimate.connectionLM} connectionPieces={combinedEstimate.connectionPieces} />
            <Card title="Fixing and sealant -- whole project" icon={<Hammer size={14} />}>
              {projChosenAgg && (
                <>
                  <Row k="10g 30mm SDS" v={`${projChosenAgg.boxes30} box${plural(projChosenAgg.boxes30)}`} hl />
                  <Row k="QTY req" v={`${projChosenAgg.fix30}`} dim />
                  <Row k="10g 16mm SDS" v={`${projChosenAgg.boxes16} box${plural(projChosenAgg.boxes16)}`} hl />
                  <Row k="QTY req" v={`${projChosenAgg.fix16}`} dim />
                  <Row k="Structure fixings (base track)" v="By others / engineer" dim />
                  <div className={cx.hr}>
                    <Row k="Hilti CP606 sealant" v={`${projChosenAgg.sealantBoxes} box${plural(projChosenAgg.sealantBoxes)} (${projChosenAgg.sausages} sausages)`} hl />
                    <Row k="total area / 4 m2/sausage" v={`${projChosenAgg.totalArea} m2`} dim />
                  </div>
                  {projChosenAgg.slabPassSausages > 0 && (
                    <div className={cx.hr}>
                      <Row k="Slab-pass sealant" v={`${projChosenAgg.slabPassSealantBoxes} box${plural(projChosenAgg.slabPassSealantBoxes)} (${projChosenAgg.slabPassSausages} sausages)`} hl />
                    </div>
                  )}
                  {projChosenAgg.slabAnchors > 0 && (
                    <Row k="Slab-edge anchors - by others, not a Speedpanel part" v={`~${projChosenAgg.slabAnchors}`} dim />
                  )}
                  <p className={cx.footnote}>Est. fixings pooled - 1000/box.</p>
                  {results.some(r => r.out.p2pEnhanced) && (
                    <p className="pt-1 text-sm leading-relaxed text-amber-700 dark:text-amber-400">One or more P78 vertical walls &gt; 5.0 m: enhanced panel-to-panel pattern applied.</p>
                  )}
                </>
              )}
            </Card>
          </CardGrid>
        </>
      )}
    </>
  );

  const footerNode = (
    <>
      <button onClick={() => setShowData(!showData)} className={cx.accordion}>
        <span className="flex items-center gap-2"><Lock size={13} className="text-slate-400 dark:text-slate-500" /> Locked system data</span>
        <ChevronDown size={16} className={`text-blue-300 dark:text-blue-700 transition-transform ${showData ? "rotate-180" : ""}`} />
      </button>
      {showData && <LockedDataInt />}
      <button className={cx.exportBtn}>Export PDF</button>
    </>
  );

  if (layoutMode === "phone") return <>{sidebarNode}{mainNode}{footerNode}</>;
  return <CalculatorShell layoutMode={layoutMode} sidebar={sidebarNode} main={mainNode} footer={footerNode} />;
}
