// =============================================================================
// Project readiness
// =============================================================================
// The implementation spec's §6 project-level readiness states, computed from
// every wall's status (./wallStatus.ts) plus every linked kit's own warnings
// (see ./synthesizeKits.ts). Pure and unit-testable without mounting either
// calculator -- see ./projectReadiness.test.ts.
// =============================================================================
import type { WallResult } from "./computeOut.types";
import type { KitEntry } from "./synthesizeKits";
import { determineWallStatus } from "./wallStatus";
import { toStructuredWarnings, type StructuredWarning } from "./warnings";

export type ProjectReadiness = "waitingForInput" | "orderIncomplete" | "readyWithWarnings" | "readyToReview";

export interface ReadinessBlocker { wallId: number; wallName: string; message: string; }

export interface ProjectReadinessResult {
  state: ProjectReadiness;
  blockers: ReadinessBlocker[];
  warnings: StructuredWarning[];
}

export const READINESS_LABEL: Record<ProjectReadiness, string> = {
  waitingForInput: "Waiting for input",
  orderIncomplete: "Order incomplete",
  readyWithWarnings: "Ready with warnings",
  readyToReview: "Ready to review",
};

function kitLabelFor(kit: KitEntry): string {
  return kit.kind === "corner"
    ? `${kit.wallAName} + ${kit.wallBName} corner kit`
    : `${kit.wallAName} + ${kit.wallBName} shaft junction`;
}

export function determineProjectReadiness(
  results: WallResult[],
  kits: KitEntry[],
  acknowledgedIds: Set<string> = new Set(),
): ProjectReadinessResult {
  const allWalls = results.map(r => r.wall);
  const blockers: ReadinessBlocker[] = [];
  const allWarnings: StructuredWarning[] = [];
  let anyTouched = false;

  for (const r of results) {
    const status = determineWallStatus(r.wall, allWalls, r.out);
    if (status !== "notStarted") anyTouched = true;
    if (status === "incomplete") {
      blockers.push({ wallId: r.wall.id, wallName: r.wall.name, message: "This wall is missing required information." });
    } else if (status === "error") {
      blockers.push({ wallId: r.wall.id, wallName: r.wall.name, message: r.out.error ?? "Calculation failed for this wall." });
    }
    if (r.out.warnings?.length) allWarnings.push(...toStructuredWarnings(r.out.warnings, r.wall.name));
  }

  for (const kit of kits) {
    if (kit.result.warnings?.length) allWarnings.push(...toStructuredWarnings(kit.result.warnings, kitLabelFor(kit)));
  }

  const unacknowledged = allWarnings.filter(w => !acknowledgedIds.has(w.id));

  let state: ProjectReadiness;
  if (!anyTouched) state = "waitingForInput";
  else if (blockers.length > 0) state = "orderIncomplete";
  else if (unacknowledged.length > 0) state = "readyWithWarnings";
  else state = "readyToReview";

  return { state, blockers, warnings: allWarnings };
}
