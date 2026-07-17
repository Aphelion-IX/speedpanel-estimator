// =============================================================================
// Kit workspace (phone)
// =============================================================================
// Phone-only restyle of kitWorkspace.tsx's read-only kit view, matching the
// phone mockup's field-shaped "Connection workspace" layout (Connection
// type / Wall A / Wall B / Connection height, stacked fields). A SEPARATE
// component from KitWorkspace (not a layoutMode branch inside it) so a phone
// style can't leak into web's rendering of the same data -- KitWorkspace
// itself is untouched and still used as-is on web. No data or behavior
// change: still read-only, still jump-to-wall for re-linking (see
// kitWorkspace.tsx's header comment for why re-linking lives on the wall's
// own workspace, not here).
// =============================================================================
import { AlertTriangle, ChevronRight } from "lucide-react";
import { cx, tone, NAVY, BLUE, MUTED } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import type { KitEntry } from "../estimate/synthesizeKits";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import type { SelectedNavItem } from "../estimate/navSelection";
import { CornerKitCard, ShaftJunctionCard } from "./kitCards";

const FieldRow = ({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) => {
  const content = (
    <>
      <div className={cx.infoBoxHd}>{label}</div>
      <div className={cx.infoBoxVal} style={{ color: NAVY }}>{value}</div>
    </>
  );
  if (!onClick) return <div className={cx.infoBox}>{content}</div>;
  return (
    <button onClick={onClick} className={`${cx.infoBox} flex w-full items-center justify-between gap-2 text-left active:scale-[0.99] transition-all`}>
      <div>{content}</div>
      <ChevronRight size={16} className="shrink-0" style={{ color: BLUE }} />
    </button>
  );
};

// No longer self-wraps in its own cx.section card -- it's now nested flush
// inside SheetCardPhone (see phoneSections.tsx / InternalCalculator.tsx),
// matching the mockup's single continuous "sheet" instead of a separate
// floating card, same treatment as SheetHeaderPhone got.
export const KitWorkspacePhone = ({ kit, onSelect }: {
  kit: KitEntry;
  onSelect: (item: SelectedNavItem) => void;
}) => (
  <div className="space-y-2.5">
    <FieldRow label="Connection type" value={kit.kind === "corner" ? "Corner kit" : "Shaft kit"} />
    <FieldRow label="Wall A" value={kit.wallAName} onClick={() => onSelect({ type: "wall", wallId: kit.wallAId })} />
    <FieldRow label="Wall B" value={kit.wallBName} onClick={() => onSelect({ type: "wall", wallId: kit.wallBId })} />
    <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
      Jump to either wall's own workspace to re-link or unlink this pair.
    </p>

    <FieldRow label="Connection height" value={`${r1(kit.result.H)} m`} />
    {kit.result.heightMismatch && (
      <p className={`flex gap-1.5 rounded-xl border border-red-200 dark:border-red-700/80 p-3 text-sm leading-relaxed ${tone("danger")}`}>
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        Linked runs have different heights -- sized to {kit.wallAName}'s height. Confirm on site.
      </p>
    )}

    <FieldRow label="Angle and flashing" value={`90° (fixed) — ${kit.kind === "corner" ? "corner post" : "back-to-back junction"} kit`} />

    <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
      <div className={cx.cardHd}>Required connection materials</div>
      {kit.kind === "corner"
        ? <CornerKitCard kit={kit.result as CornerPairResult} partnerName={kit.wallBName} />
        : <ShaftJunctionCard kit={kit.result as ShaftPairResult} partnerName={kit.wallBName} />}
    </div>
  </div>
);
