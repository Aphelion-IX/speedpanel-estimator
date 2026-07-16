// =============================================================================
// Advanced setup sheet (phone)
// =============================================================================
// Bottom sheet matching the SpeedHub mockup's "Advanced wall setup" -- built
// entirely from EXISTING, already-wired sections (no new state, no inert
// controls): panel length/optimisation (../ui/lengthExplorer.tsx's
// PanelLengthSection -- project lock, stocked-length picker, custom factory
// length), tracks/finishes/fixings (../ui/wallConfig.tsx's
// EdgeRestraintSelector), and read-only reference data (LockedDataInt +
// SpanTable). Mockup rows with no backing field anywhere in the data model
// (order strategy, waste-warning threshold, project-wide "reuse finishes")
// are intentionally omitted rather than faked. No Apply/Reset footer either
// -- every control here recomputes live already, so a staged-edit pattern
// would be fake; the sheet is closed via Drawer's own header X.
// =============================================================================
import { Drawer } from "../ui/drawer";
import { BLUE, NAVY, MUTED } from "../styleTokens";
import { PanelLengthSection, type PanelLengthSectionProps } from "../ui/lengthExplorer";
import { EdgeRestraintSelector, SpanTable, type EdgeRestraintProps } from "../ui/wallConfig";
import { LockedDataInt } from "../ui/lockedData";
import type { EffectiveLayout } from "../useLayoutMode";
import type { Wall } from "../estimate/wall.types";

const SectionHeader = ({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) => (
  <div className="mb-2 flex items-center gap-2.5">
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold" style={{ background: `${BLUE}1a`, color: BLUE }}>{icon}</span>
    <div className="min-w-0">
      <div className="text-xs font-bold" style={{ color: NAVY }}>{title}</div>
      <div className="text-[11px]" style={{ color: MUTED }}>{subtitle}</div>
    </div>
  </div>
);

export interface AdvancedSetupSheetPhoneProps {
  open: boolean; onClose: () => void; layoutMode: EffectiveLayout;
  active: Wall; orient: "vertical" | "horizontal";
  panelLength: PanelLengthSectionProps;
  edgeRestraint: EdgeRestraintProps;
}

export const AdvancedSetupSheetPhone = ({ open, onClose, layoutMode, active, orient, panelLength, edgeRestraint }: AdvancedSetupSheetPhoneProps) => (
  <Drawer open={open} onClose={onClose} layoutMode={layoutMode} title="Advanced wall setup">
    <p className="mb-4 text-xs leading-relaxed" style={{ color: MUTED }}>
      These settings apply to <span className="font-semibold" style={{ color: NAVY }}>{active.name}</span>.
    </p>

    <div className="mb-5">
      <SectionHeader icon="↔" title="Panel length & optimisation" subtitle="Stock selection and custom factory lengths" />
      <PanelLengthSection {...panelLength} />
    </div>

    <div className="mb-5">
      <SectionHeader icon="▱" title="Tracks, finishes & fixings" subtitle="Edge finishes, head flashing and corner counts" />
      <EdgeRestraintSelector {...edgeRestraint} />
    </div>

    <div>
      <SectionHeader icon="i" title="Reference & locked data" subtitle="Read-only values used by the calculation engine" />
      <SpanTable orient={orient} type={active.type} wallSystem={active.wallSystem} />
      <div className="mt-3">
        <LockedDataInt />
      </div>
    </div>
  </Drawer>
);
