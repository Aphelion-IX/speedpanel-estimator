// =============================================================================
// Schedule / material cards
// =============================================================================
// Shared building blocks for panel schedules and track/fixing material
// display -- linear-metre line items, pack/stock badges, per-length schedule
// rows, the panel schedule card/table, fixing+sealant card, and the
// combined-estimate connection breakdown card. Used by both the Internal and
// External calculators (single-wall and project views).
// =============================================================================
import { Fragment } from "react";
import { AlertTriangle, Frame, Hammer, Layers } from "lucide-react";
import { cx, NAVY, BLUE } from "../styleTokens";
import { plural, stockStatus } from "../estimate/computeUtils";
import { r1 } from "../estimate/mathUtils";
import { PACK, typeFromPackSize } from "../data";
import type { CustomScheduleEntry, PanelGroup } from "../estimate/wall.types";
import type { ConnectionMaterial } from "../estimate/estimate.types";
import { Card, Row } from "./primitives";

/**
 * One linear-metre material line item, e.g. "C-track perimeter -- 55x82x50"
 * with a piece count on the right and an "X m total -- stocked @ Y m" subline.
 * Used by every track/flashing card (internal + external, single wall + project).
 */
export const LMLineItem = ({ label, pieces, lm, stockLabel, bordered = true }: {
  label: string; pieces: number; lm: number; stockLabel: string; bordered?: boolean;
}) => (
  <div className={bordered ? cx.rowBorder : undefined}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{pieces} length{plural(pieces)}</span>
    </div>
    <div className={cx.rowSub}>{lm} m total - {stockLabel}</div>
  </div>
);

// typeFromPackSize now lives in ./data.

/** "Head track flashing" card -- identical layout in all four track/flashing card variants. */
export const HeadFlashingCard = ({ dim, pieces, lm, stock }: { dim: string; pieces: number; lm: number; stock: number }) => (
  <Card title="Head track flashing" icon={<Layers size={14} />}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{dim}</span>
      <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{pieces} length{plural(pieces)}</span>
    </div>
    <div className={cx.rowSub}>{lm} m total - stocked @ {r1(stock)} m</div>
    <Row k="Fixing layout" v="2 rows @ 500, stag. 250" dim />
  </Card>
);

export const PackNote = ({ type, spare }: { type: number; spare?: number }) => {
  const msg = spare && spare > 3
    ? `${spare} spare panels -- part-pack options may be available. Contact Speedpanel.`
    : `Under a full pack (${PACK[type]}) -- contact Speedpanel for part-pack options.`;
  return (
    <p className={cx.packNote}>
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      {msg}
    </p>
  );
};

export const StockBadge = ({ status }: { status: ReturnType<typeof stockStatus> }) => {
  if (status.type === "stocked")
    return <span className={`${cx.badge} bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400`}>Stocked</span>;
  if (status.type === "near-stock")
    return <span className={`${cx.badge} bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400`}>^ {r1(status.length)} m</span>;
  return <span className={`${cx.badge} bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400`}>Custom</span>;
};

export const ScheduleRow = ({ mm, ordered, qty, packs, packSize, stocks, isLast, packNumber }: {
  mm: number; ordered: number; qty: number; packs: number; packSize: number; stocks: number[]; isLast: boolean; packNumber?: number;
}) => {
  const status = stockStatus(mm, stocks);
  return (
    <div className={`py-3.5 ${isLast ? "" : "border-b border-slate-100 dark:border-slate-800"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {packNumber != null && (
            <span className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: BLUE, color: "#fff" }}>
              {packs > 1 ? `Pack ${packNumber}-${packNumber + packs - 1}` : `Pack ${packNumber}`}
            </span>
          )}
          <span className="text-base font-bold tracking-tight" style={{ color: NAVY }}>{mm.toLocaleString()} mm</span>
          <StockBadge status={status} />
        </div>
        <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{ordered} panels</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between" style={{fontSize:"14px",color:"#94a3b8"}}>
        <span>{qty} req · {packs} pack{packs !== 1 ? "s" : ""} of {packSize}</span>
        <span>{ordered - qty} spare</span>
      </div>
    </div>
  );
};
/** Stock-group row used in both project order cards (internal AggPanelEntry / external ExtAggGroup). */
export const StockGroupRow = ({ stock, ordered, pieces, packs, packSize, spare, stocks, isLast, typeLabel, packNote }: {
  stock: number; ordered: number; pieces: number; packs: number; packSize: number; spare: number;
  stocks: number[]; isLast: boolean;
  typeLabel?: string; // e.g. "P78" prefix -- omit for external which has no type column
  packNote?: React.ReactNode;
}) => (
  <div className={`py-2 ${!isLast ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold" style={{ color: NAVY }}>
          {typeLabel ? `${typeLabel} - ` : ""}{r1(stock)} m
        </span>
        <StockBadge status={stockStatus(stock * 1000, stocks)} />
      </div>
      <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{ordered} panels</span>
    </div>
    <div className={cx.rowSub}>{pieces} req - {packs} pack{packs !== 1 ? "s" : ""} of {packSize} - {spare} spare</div>
    {packNote}
  </div>
);

// --- PanelScheduleCard --------------------------------------------------------
export const PanelScheduleCard = ({ title, icon, customSchedule, groups, packSize, stocks, wastePct, orient, showCustomNote = true }: {
  title: string; icon: React.ReactNode;
  customSchedule?: CustomScheduleEntry[] | null; groups?: PanelGroup[];
  packSize: number; stocks: number[]; wastePct?: number; orient?: string; showCustomNote?: boolean;
}) => (
  <Card title={title} icon={icon}>
    {customSchedule && customSchedule.length > 0 ? (
      <>
        {showCustomNote && (
          <p className={`mb-2 ${cx.footnote}`} style={{paddingTop:0}}>
            {orient === "horizontal" ? "Factory-cut row widths." : "Factory-cut panels (max 9000 mm)."} Pack of {packSize}. Confirm with Speedpanel.
          </p>
        )}
        {customSchedule.map((s, i) => (
          <ScheduleRow key={i} mm={s.mm} ordered={s.ordered} qty={s.qty} packs={s.packs} packSize={packSize} stocks={stocks} isLast={i === customSchedule.length - 1} packNumber={s.packNumber} />
        ))}
        <div className={cx.hr}>
          <Row k="Total required" v={`${customSchedule.reduce((a, s) => a + s.qty, 0)} panels`} />
          <Row k="Total to order" v={`${customSchedule.reduce((a, s) => a + s.ordered, 0)} panels`} hl />
          <Row k="Spare" v={`${customSchedule.reduce((a, s) => a + s.ordered, 0) - customSchedule.reduce((a, s) => a + s.qty, 0)} panels`} dim />
        </div>
      </>
    ) : (
      <>
        {(groups || []).map((g, i) => {
          const status = stockStatus(g.stock * 1000, stocks);
          return (
            <div key={i} className={`py-2 ${i < (groups!.length - 1) ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold" style={{ color: NAVY }}>{r1(g.stock)} m</span>
                  <StockBadge status={status} />
                </div>
                <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{g.ordered} panels</span>
              </div>
              <div className={cx.rowSub}>
                {g.pieces} req · {g.packs} pack{g.packs !== 1 ? "s" : ""} of {g.ps || packSize} · {g.spare} spare
              </div>
              {(g.underPack || g.spare > 3) && <PackNote type={typeFromPackSize(g.ps || packSize)} spare={g.spare} />}
            </div>
          );
        })}
        {(!groups || groups.length === 0) && <Row k="No panels yet" v="--" dim />}
        <div className={cx.hr}><Row k="Wastage (order)" v={`${r1(wastePct || 0)}%`} dim /></div>
      </>
    )}
  </Card>
);

// --- PanelScheduleTable ---------------------------------------------------------
// Web/tablet counterpart to PanelScheduleCard: same props, same underlying
// data (stockStatus/StockBadge/PackNote/typeFromPackSize), just rendered as a
// real <table> (matching SpanTable's TH/TD conventions) instead of stacked rows.
// Not built on the shared <Table> primitive -- some rows need an extra
// colSpan note row directly beneath them (the pack-note Fragment below),
// which doesn't fit Table's one-<tr>-per-datum render-prop model.
export const PanelScheduleTable = ({ title, icon, customSchedule, groups, packSize, stocks, wastePct, orient, showCustomNote = true }: {
  title: string; icon: React.ReactNode;
  customSchedule?: CustomScheduleEntry[] | null; groups?: PanelGroup[];
  packSize: number; stocks: number[]; wastePct?: number; orient?: string; showCustomNote?: boolean;
}) => {
  const TH = "py-2.5 px-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800";
  const TD = "py-2.5 px-2 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 last:border-0";
  const TDm = "py-2.5 px-2 text-sm font-semibold border-b border-slate-100 dark:border-slate-800 last:border-0";
  const hasCustom = customSchedule && customSchedule.length > 0;

  return (
    <div className={`mt-3 ${cx.card}`}>
      <div className={cx.cardTitle} style={{ color: NAVY }}>
        <span style={{ color: BLUE }}>{icon}</span>{title}
      </div>
      {hasCustom && showCustomNote && (
        <p className={`mb-2 ${cx.footnote}`} style={{ paddingTop: 0 }}>
          {orient === "horizontal" ? "Factory-cut row widths." : "Factory-cut panels (max 9000 mm)."} Pack of {packSize}. Confirm with Speedpanel.
        </p>
      )}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[400px]">
        <thead>
          <tr>
            <th className={TH}>{hasCustom ? "Length" : "Stock"}</th>
            <th className={TH}>Status</th>
            <th className={TH}>Req.</th>
            <th className={TH}>Packs</th>
            <th className={TH}>Ord.</th>
            <th className={TH}>Spare</th>
          </tr>
        </thead>
        <tbody>
          {hasCustom ? customSchedule!.map((s, i) => {
            const status = stockStatus(s.mm, stocks);
            return (
              <tr key={i}>
                <td className={TDm} style={{ color: NAVY }}>
                  {s.packNumber != null && (
                    <span className="mr-1.5 rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: BLUE, color: "#fff" }}>
                      {s.packs > 1 ? `Pack ${s.packNumber}-${s.packNumber + s.packs - 1}` : `Pack ${s.packNumber}`}
                    </span>
                  )}
                  {s.mm.toLocaleString()} mm
                </td>
                <td className={TD}><StockBadge status={status} /></td>
                <td className={TD}>{s.qty}</td>
                <td className={TD}>{s.packs} of {packSize}</td>
                <td className={TDm} style={{ color: BLUE }}>{s.ordered}</td>
                <td className={TD}>{s.ordered - s.qty}</td>
              </tr>
            );
          }) : (groups || []).map((g, i) => {
            const status = stockStatus(g.stock * 1000, stocks);
            const showNote = g.underPack || g.spare > 3;
            return (
              <Fragment key={i}>
                <tr>
                  <td className={TDm} style={{ color: NAVY }}>{r1(g.stock)} m</td>
                  <td className={TD}><StockBadge status={status} /></td>
                  <td className={TD}>{g.pieces}</td>
                  <td className={TD}>{g.packs} of {g.ps || packSize}</td>
                  <td className={TDm} style={{ color: BLUE }}>{g.ordered}</td>
                  <td className={showNote ? "py-2.5 px-2 text-sm text-slate-600 dark:text-slate-300" : TD}>{g.spare}</td>
                </tr>
                {showNote && (
                  <tr>
                    <td colSpan={6} className="pb-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <PackNote type={typeFromPackSize(g.ps || packSize)} spare={g.spare} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {!hasCustom && (!groups || groups.length === 0) && (
            <tr><td className={TD} colSpan={6}>No panels yet</td></tr>
          )}
        </tbody>
      </table>
      </div>
      <div className={cx.hr}>
        {hasCustom ? (
          <>
            <Row k="Total required" v={`${customSchedule!.reduce((a, s) => a + s.qty, 0)} panels`} />
            <Row k="Total to order" v={`${customSchedule!.reduce((a, s) => a + s.ordered, 0)} panels`} hl />
            <Row k="Spare" v={`${customSchedule!.reduce((a, s) => a + s.ordered, 0) - customSchedule!.reduce((a, s) => a + s.qty, 0)} panels`} dim />
          </>
        ) : (
          <Row k="Wastage (order)" v={`${r1(wastePct || 0)}%`} dim />
        )}
      </div>
    </div>
  );
};

// --- FixingSealantCard --------------------------------------------------------
export const FixingSealantCard = ({ title, boxes30, fix30, boxes16, fix16, sealantBoxes, sausages, area, sealantLabel, sealantRate, footnote, p2pNote, p2pEnhanced }: {
  title: string; boxes30: number; fix30: number; boxes16: number; fix16: number;
  sealantBoxes: number; sausages: number; area: number | string;
  sealantLabel: string; sealantRate: number; footnote?: string;
  p2pNote?: string; p2pEnhanced?: boolean;
}) => (
  <Card title={title} icon={<Hammer size={14} />}>
    <Row k="10g 30mm SDS" v={`${boxes30} box${plural(boxes30)}`} hl />
    <Row k="QTY req" v={`${fix30}`} dim />
    <Row k="10g 16mm SDS" v={`${boxes16} box${plural(boxes16)}`} hl />
    <Row k="QTY req" v={`${fix16}`} dim />
    <Row k="Structure fixings (base track)" v="By others / engineer" dim />
    <div className={cx.hr}>
      <Row k={sealantLabel} v={`${sealantBoxes} box${plural(sealantBoxes)} (${sausages} sausages)`} hl />
      <Row k={`area / ${sealantRate} m2/sausage`} v={`${area} m2`} dim />
    </div>
    {p2pEnhanced !== undefined ? (
      <div className="mt-1.5 border-t border-slate-100 dark:border-slate-800 pt-1.5 space-y-1">
        {p2pEnhanced ? (
          <>
            <p className="text-sm font-bold" style={{ color: NAVY }}>P78 vertical &gt; 5.0 m -- enhanced panel-to-panel pattern:</p>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">Joints 1-2 @500mm - 3-4 @750mm - rest @1000mm - one face.</p>
          </>
        ) : (
          <p className={cx.footnote} style={{paddingTop:0}}>Est. fixings -- 1000/box. {p2pNote}</p>
        )}
      </div>
    ) : (
      <p className={cx.footnote}>{footnote || "Est. fixings -- 1000/box."}</p>
    )}
  </Card>
);
// --- ConnectionBreakdownCard ---------------------------------------------------
// Shows WHY each junction material was added -- the source walls, the length/
// quantity, and the reason -- separate from the System Breakdown (which shows
// each wall's OWN materials) so the connection logic stays visible and easy
// to audit independently, per the combined-estimate flow.
export const ConnectionBreakdownCard = ({ connections }: { connections: ConnectionMaterial[] }) => (
  <Card title="Connection breakdown" icon={<Frame size={14} />}>
    {connections.length === 0 && (
      <Row k="No adjoining walls linked yet" v="--" dim />
    )}
    {connections.map(c => (
      <div key={c.id} className={cx.rowBorder}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold" style={{ color: NAVY }}>Extra C/J track</span>
          <span className={cx.rowVal} style={{ color: BLUE }}>{c.pieces} length{plural(c.pieces)}</span>
        </div>
        <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Between <span className="font-semibold">{c.wallAName}</span> ({c.wallAOrient}) and{" "}
          <span className="font-semibold">{c.wallBName}</span> ({c.wallBOrient})
        </div>
        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Length {r1(c.lengthM)} lm - qty {c.quantity} - stocked @ {r1(c.stock)} m - {c.reason}
        </div>
        {c.warnings.map((w, i) => (
          <div key={i} className="mt-1.5 flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" /><span>{w}</span>
          </div>
        ))}
      </div>
    ))}
  </Card>
);
