// =============================================================================
// Kit workspace
// =============================================================================
// The Calculator Workspace's view for a selected Corner/Shaft kit (see
// ../estimate/synthesizeKits.ts). Read-only + jump-to-wall, not a live dual
// editor -- linkCornerPartner/linkShaftPartner (see ../appShell/useCornerShaftLinking.ts)
// are scoped to the wall store's *active* wall, not an explicit wall id, so
// re-linking/unlinking a pair is done by jumping to either wall's own
// Calculator Workspace view (where the existing CornerLinkSelector/
// ShaftLinkSelector already supports it), not in this view directly.
// =============================================================================
import { AlertTriangle } from "lucide-react";
import { cx, NAVY, BLUE, MUTED } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import type { KitEntry } from "../estimate/synthesizeKits";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import type { SelectedNavItem } from "../estimate/navSelection";
import { Row } from "../ui/primitives";
import { CornerKitCard, ShaftJunctionCard } from "./kitCards";

const WallJumpRow = ({ label, name, onClick }: { label: string; name: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-3 text-left active:scale-95 transition-all hover:border-[color:var(--blue)]">
    <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>{label}</div>
    <div className="mt-1 text-sm font-bold" style={{ color: NAVY }}>{name} <span style={{ color: BLUE }}>&rsaquo;</span></div>
  </button>
);

export const KitWorkspace = ({ kit, onSelect }: {
  kit: KitEntry;
  onSelect: (item: SelectedNavItem) => void;
}) => (
  <div className={cx.section}>
    <div className={cx.cardHd} style={{ marginTop: 0 }}>Connected walls</div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      <WallJumpRow label="Wall A" name={kit.wallAName} onClick={() => onSelect({ type: "wall", wallId: kit.wallAId })} />
      <WallJumpRow label="Wall B" name={kit.wallBName} onClick={() => onSelect({ type: "wall", wallId: kit.wallBId })} />
    </div>
    <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
      Jump to either wall's own workspace to re-link or unlink this pair.
    </p>

    <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
      <div className={cx.cardHd}>Height</div>
      <Row k="Resolved height" v={`${r1(kit.result.H)} m`} hl />
      {kit.result.heightMismatch && (
        <p className="mt-2 flex gap-1.5 text-sm leading-relaxed text-amber-700 dark:text-amber-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Linked runs have different heights -- sized to {kit.wallAName}'s height. Confirm on site.
        </p>
      )}
    </div>

    <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
      <div className={cx.cardHd}>Angle and flashing</div>
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-300">
        Angle: 90&deg; (fixed) &mdash; the {kit.kind === "corner" ? "corner post" : "back-to-back junction"} kit assumes a right-angle corner.
      </p>
    </div>

    <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
      <div className={cx.cardHd}>Required connection materials</div>
      {kit.kind === "corner"
        ? <CornerKitCard kit={kit.result as CornerPairResult} partnerName={kit.wallBName} />
        : <ShaftJunctionCard kit={kit.result as ShaftPairResult} partnerName={kit.wallBName} />}
    </div>
  </div>
);
