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
import { ChevronDown, Box, Frame, Layers, Lock } from "lucide-react";
import { cx, NAVY, BLUE, GOLD } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { computeExternal } from "../estimate/computeWall";
import { buildExtProjAgg } from "../estimate/aggregate";
import type { ExtAggGroup } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL, COLOUR_HEX, EXT_STOCKED_COLOURS, EXT_STOCK, EXT_PACK } from "../data";
import type { Wall, ComputeOut, PanelGroup } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import {
  SectionLabel, CardGrid, StatsRow, NotesList, WarningsList, EstimateModeSelector,
  Card, Row, ToggleSwitch, UnitToggle, ProjectLockNote, CalculatorShell,
} from "../ui/primitives";
import { LockedDataExt } from "../ui/lockedData";
import { LengthExplorer } from "../ui/lengthExplorer";
import { WallsCard, WallsSummaryTable } from "../ui/wallsCard";
import {
  CustomLengthSection, ProfileSection, DimensionInputs, SpanTable, EdgeRestraintSelector, ProjectSeparator,
} from "../ui/wallConfig";
import type { CornersField } from "../ui/wallConfig";
import {
  PanelScheduleCard, PanelScheduleTable, FixingSealantCard, StockGroupRow, ConnectionBreakdownCard,
} from "../ui/scheduleCards";
import { TrackFlashingCardExt, TrackFlashingCardExtProj } from "./trackFlashingCards";
import { SystemBreakdownWallCardExt } from "./systemBreakdownCard";

// --- ExternalCalculator -------------------------------------------------------
// orient is derived from sys.orient in the parent and passed as a prop. The
// wall list comes from the shared `store` (owned by SpeedpanelEstimator) so it
// survives switching in/out of External mode. orient stays in useWallResults'
// dependency array to prevent stale compute if this component is kept mounted
// across orientation switches.
export function ExternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode }: { store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string; setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout }) {
  const [extMode, setExtMode] = useState("project");
  const [showTakeoff, setShowTakeoff] = useState(true);
  const [showLocked, setShowLocked] = useState(false);

  const {
    walls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, toM, updDim,
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

      <SectionLabel icon={<Box size={13} />}>Panel configuration</SectionLabel>
      <div className={cx.section}>
        {/* P78 badge -- styled to match internal panel type buttons */}
        <div className={cx.cardHd}>Panel type</div>
        {(() => {
          const isCustom = active.colourType === "special";
          const stockedHex = !isCustom && active.colour ? COLOUR_HEX[active.colour] : null;
          const isLight = active.colour === "OW";
          const colourName = !isCustom && active.colour
            ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour)?.label ?? ""
            : "";
          const badgeBg = isCustom ? GOLD : stockedHex ?? BLUE;
          const textColour = isCustom ? NAVY : isLight ? NAVY : "#fff";

          return (
            <div className="w-full rounded-xl border-2 py-3.5 px-3 transition-all" style={{ borderColor: badgeBg, background: badgeBg, transition: "background 0.3s, border-color 0.3s" }}>
              <div className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: textColour }}>
                {isCustom ? "P78 - Custom" : `P78${colourName ? ` - ${colourName}` : ""}`}
              </div>
            </div>
          );
        })()}
        {/* Colour selection */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className={cx.cardHd}>Colour selection</div>
          <div className="grid grid-cols-3 gap-2 items-stretch">
            {[...EXT_STOCKED_COLOURS.map(c => {
              const hex = COLOUR_HEX[c.code];
              const selected = active.colour === c.code && active.colourType === "stocked";
              const isLight = c.code === "OW";
              const textColour = isLight ? NAVY : "#fff";
              return (
                <button key={c.code} onClick={() => update({ colour: c.code, colourType: "stocked" })}
                  className="w-full rounded-xl border-2 py-3 px-1.5 text-center transition-all active:scale-95"
                  style={{
                    background: hex,
                    borderColor: selected ? BLUE : "rgba(0,0,0,0.08)",
                    boxShadow: selected ? `0 0 0 2px ${BLUE}` : undefined,
                  }}>
                  <div className="text-[10px] font-bold uppercase leading-tight truncate"
                    style={{ color: textColour }}>{c.label}</div>
                </button>
              );
            }), (() => {
              const selected = active.colourType === "special";
              return (
                <button key="special" onClick={() => update({ colourType: "special", colour: "" })}
                  className={"w-full rounded-xl border-2 py-3 px-1.5 text-center active:scale-95 transition-all " + (selected ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
                  style={selected ? { borderColor: BLUE, background: BLUE } : undefined}>
                  <div className="text-[10px] font-bold uppercase leading-tight"
                    style={{ color: selected ? "#fff" : BLUE }}>Custom</div>
                </button>
              );
            })()]}
          </div>
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
            stocks={EXT_STOCK}
            packType={78}
            currentStock={customActive ? "" : (projectLock ? projectStock : (active.forcedStock || ""))}
            onSelect={val => {
              clearCustomLength();
              if (projectLock) { setProjectLength(val, true); }
              else { update({ forcedStock: val }); }
            }}
            isExt
          />

          {/* Custom length -- always visible below the dropdown */}
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
          <SpanTable orient={orient} type={78} />
        </div>
      </div>

      <SectionLabel icon={<Lock size={13} />}>TRACKS AND FLASHING</SectionLabel>
      <EdgeRestraintSelector
        edges={active.edges}
        onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
        options={edgeOptions}
        orient={orient}
        corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
      />

      <WarningsList warnings={!out.empty ? out.warnings : null} />
      <EstimateModeSelector visible={!out.empty} mode={extMode} setMode={setExtMode} />
    </>
  );

  const mainNode = (
    <>
      {!out.empty && !project && out.result && (
        <>
          <button onClick={() => setShowTakeoff(!showTakeoff)} className={cx.accordion}>
            <span>Material quantities</span>
            <ChevronDown size={15} className={`transition-transform ${showTakeoff ? "rotate-180" : ""}`} />
          </button>
          {showTakeoff && (() => {
            const colourEntry = active.colour ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour) : null;
            const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : active.colour;
            return (
            <div className="mt-3">
              <StatsRow area={`${out.area} m2`} panels={out.result!.panels} panelType="P78" />
              {active.colour && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5" style={{ borderColor: GOLD }}>
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Colour</span>
                    <span className="text-sm font-semibold" style={{ color: NAVY }}>{colourDisplay}</span>
                    {active.colourType === "special" && <span className="ml-auto text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Special order</span>}
                  </div>
              )}
              <CardGrid layoutMode={layoutMode} minWidth={380}>
                <ScheduleComp title="Panel order schedule -- P78 coloured" icon={<Box size={14} />}
                  customSchedule={out.customSchedule}
                  groups={out.result.groups.map((g: PanelGroup) => ({ ...g, ps: EXT_PACK }))}
                  packSize={EXT_PACK} stocks={EXT_STOCK} wastePct={out.result.wastePct} orient={orient} />
                <TrackFlashingCardExt out={out} orient={orient} headFlashActive={active.headFlash} />
                <FixingSealantCard title="Fixing and sealant quantities"
                  boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                  boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                  sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                  sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings -- 1000/box." />
              </CardGrid>
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </div>
            );
          })()}
        </>
      )}

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
              <SystemBreakdownWallCardExt key={w.id} wall={w} out={o} ScheduleComp={ScheduleComp} />
            ))}
          </CardGrid>

          {/* Connection Breakdown: shows WHY extra materials were added */}
          <SectionLabel icon={<Frame size={13} />}>Connection breakdown</SectionLabel>
          <ConnectionBreakdownCard connections={combinedEstimate.connections} />

          {/* Easy to Order: shows WHAT needs to be ordered -- one combined material list */}
          <SectionLabel icon={<Box size={13} />}>Easy to order -- combined material summary</SectionLabel>
          <StatsRow area={`${projAgg.totalArea} m2`} panels={projAgg.panels} panelType="P78" />
          <CardGrid layoutMode={layoutMode} minWidth={300}>
            <Card title="Project order estimate" icon={<Box size={14} />}>
              {projAgg.groups.map((g: ExtAggGroup, i: number) => (
                <StockGroupRow key={i}
                  stock={g.stock} ordered={g.ordered} pieces={g.pieces}
                  packs={g.packs} packSize={EXT_PACK} spare={g.spare}
                  stocks={EXT_STOCK} isLast={i === projAgg.groups.length - 1}
                />
              ))}
              {projAgg.groups.length === 0 && <Row k="No panels yet" v="--" dim />}
            </Card>
            <TrackFlashingCardExtProj agg={projAgg}
              connectionLM={combinedEstimate.connectionLM} connectionPieces={combinedEstimate.connectionPieces} />
            <FixingSealantCard title="Fixing and sealant -- whole project"
              boxes30={projAgg.boxes30} fix30={projAgg.fix30}
              boxes16={projAgg.boxes16} fix16={projAgg.fix16}
              sealantBoxes={projAgg.sealantBoxes} sausages={projAgg.sausages} area={projAgg.totalArea}
              sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings pooled - 1000/box." />
          </CardGrid>
        </>
      )}
    </>
  );

  const footerNode = (
    <>
      <button onClick={() => setShowLocked(!showLocked)} className={cx.accordion}>
        <span className="flex items-center gap-2"><Lock size={13} className="text-slate-400 dark:text-slate-500" /> Locked external system data</span>
        <ChevronDown size={16} className={`text-blue-300 dark:text-blue-700 transition-transform ${showLocked ? "rotate-180" : ""}`} />
      </button>
      {showLocked && <LockedDataExt />}
      <button className={cx.exportBtn}>Export PDF</button>
    </>
  );

  if (layoutMode === "phone") {
    return <div>{sidebarNode}{mainNode}{footerNode}</div>;
  }
  return <CalculatorShell layoutMode={layoutMode} sidebar={sidebarNode} main={mainNode} footer={footerNode} />;
}
