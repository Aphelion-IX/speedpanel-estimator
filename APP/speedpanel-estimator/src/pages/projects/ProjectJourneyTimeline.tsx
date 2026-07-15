// =============================================================================
// Project journey timeline -- the derived 8-step JourneyStage
// =============================================================================
// Thin wrapper mapping JOURNEY_STAGES onto the shared StepTracker.tsx
// primitive (dot+connector web / pill-row phone, done/current/upcoming
// colouring) -- see that file for the actual rendering. `stage` is always
// the DISPLAY-ONLY value from journeyStage.ts -- see that file's header
// comment for why this is never a persisted column.
// =============================================================================
import { Package, Settings, ShieldCheck, Truck } from "lucide-react";
import type { EffectiveLayout } from "../../useLayoutMode";
import { JOURNEY_STAGES, JOURNEY_STAGE_LABELS, type JourneyStage } from "./journeyStage";
import { StepTracker } from "./StepTracker";

// Mirrors the mockup's own icon choice exactly: a per-stage icon for the
// upcoming/current dot, overridden by a plain checkmark once a step is done.
const STEP_ICON: Partial<Record<JourneyStage, typeof Settings>> = {
  manufacturing: Package,
  ready_for_delivery: Truck,
  completed: ShieldCheck,
};

export const ProjectJourneyTimeline = ({ stage, layoutMode }: { stage: JourneyStage; layoutMode: EffectiveLayout }) => (
  <StepTracker
    steps={JOURNEY_STAGES.map(s => ({ label: JOURNEY_STAGE_LABELS[s], icon: STEP_ICON[s] }))}
    activeIndex={JOURNEY_STAGES.indexOf(stage)}
    layoutMode={layoutMode}
  />
);
