// =============================================================================
// Stage stepper -- the four linear project.stage steps
// =============================================================================
// Thin wrapper mapping STAGES onto the shared StepTracker.tsx primitive (same
// dot+connector web / pill-row phone, done/current/upcoming colouring
// ProjectJourneyTimeline.tsx uses) -- see that file for the actual rendering.
// No per-step icons exist for this pipeline, so every non-done step falls
// back to StepTracker's generic icon, same as most JourneyStage steps
// already do. No own heading -- the caller supplies section context (see
// ProjectDetailPage.tsx's merged "Project Progress" card).
// =============================================================================
import type { EffectiveLayout } from "../../useLayoutMode";
import { STAGES, STAGE_LABELS, type Stage } from "./projectTypes";
import { StepTracker } from "./StepTracker";

export const StageStepper = ({ stage, layoutMode }: { stage: Stage; layoutMode: EffectiveLayout }) => (
  <StepTracker
    steps={STAGES.map(s => ({ label: STAGE_LABELS[s] }))}
    activeIndex={STAGES.indexOf(stage)}
    layoutMode={layoutMode}
  />
);
