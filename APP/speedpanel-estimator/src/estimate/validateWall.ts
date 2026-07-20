// =============================================================================
// Wall validation
// =============================================================================
// Structured field/compatibility issues for one wall, per the implementation
// spec's §7.16 (validateWall) and §5.2 (Incomplete examples). Reuses
// out.empty/out.warnings from the existing compute pipeline (computeWall.ts)
// rather than re-deriving calculability -- this is a thin layer over data
// that's already computed, not a second calculation engine. See
// ./wallStatus.ts, which turns this validation result into the spec's
// Not Started/Incomplete/Ready/Warning/Error status for one wall.
// =============================================================================
import type { Wall } from "./wallDomain";
import type { ComputeOut } from "./computeOut.types";

export interface WallIssue {
  field?: string;
  kind: "required" | "invalid" | "compatibility";
  message: string;
}

export interface WallValidation {
  issues: WallIssue[];
  warnings: string[];
  // Whether the wall has any calculable output right now (out.empty is
  // false and the compute pipeline didn't throw -- see out.error, set by
  // useWallResults' try/catch in wallStore.ts).
  calculable: boolean;
  // Whether the wall has ANY meaningful geometry entered yet -- distinguishes
  // "Not Started" (blank slate) from "Incomplete" (some fields entered, some
  // still missing). See spec §5.1 vs §5.2.
  touched: boolean;
}

const isSet = (v: string | undefined | null): boolean => !!v && v.trim() !== "";

// Whether the wall has begun to be configured at all -- only the dimension-
// shaped fields count (name/panel-type/profile/system all carry non-blank
// defaults from defaultWall(), so they can't be used to detect "untouched").
function hasAnyGeometryInput(wall: Wall): boolean {
  return isSet(wall.width) || isSet(wall.height) || isSet(wall.leftH) || isSet(wall.rightH) ||
    isSet(wall.eavesH) || isSet(wall.apexH) || isSet(wall.ridgeX) || isSet(wall.floorHeight);
}

export function validateWall(wall: Wall, walls: Wall[], out: ComputeOut): WallValidation {
  const touched = hasAnyGeometryInput(wall);
  const warnings = out.warnings ?? [];
  const calculable = touched && !out.empty && !out.error;

  if (!touched) {
    return { issues: [], warnings, calculable, touched };
  }

  const issues: WallIssue[] = [];

  if (!isSet(wall.width)) issues.push({ field: "width", kind: "required", message: "Wall width is required." });
  if (!isSet(wall.height)) issues.push({ field: "height", kind: "required", message: "Wall height is required." });

  if (wall.profile === "rake") {
    if (!isSet(wall.leftH)) issues.push({ field: "leftH", kind: "required", message: "Rake profile is missing its low-point height." });
    if (!isSet(wall.rightH)) issues.push({ field: "rightH", kind: "required", message: "Rake profile is missing its high-point height." });
  }
  if (wall.profile === "gable") {
    // Matches resolveGeometry's own fallback (wallGeometry.ts): leftH/rightH
    // each fall back to the legacy single eavesH value if unset, so only
    // flag a side as missing when NEITHER it nor eavesH is set. ridgeX is
    // genuinely optional -- blank centres the ridge (see the "blank =
    // centred" field label in wallConfig.tsx's DimensionInputs).
    if (!isSet(wall.leftH) && !isSet(wall.eavesH)) issues.push({ field: "leftH", kind: "required", message: "Gable profile is missing its left eaves height." });
    if (!isSet(wall.rightH) && !isSet(wall.eavesH)) issues.push({ field: "rightH", kind: "required", message: "Gable profile is missing its right eaves height." });
    if (!isSet(wall.apexH)) issues.push({ field: "apexH", kind: "required", message: "Gable profile is missing its apex height." });
  }

  // Corner wall always needs its partner ("always 1 corner" -- see
  // useCornerShaftLinking.ts); Shaft wall's secondary partner is optional
  // (a shaft can be a lone primary stack -- see Wall.shaftPartnerId's own
  // comment), so only floor height is required there. wallSystem is
  // Internal-only (see Wall.application/wallSystem) -- gated so a leftover
  // "corner"/"shaft" value on a wall that's since become External (its
  // application field, not wallSystem itself, is the source of truth once a
  // wall's application can change) doesn't spuriously demand a corner
  // partner/floor height it no longer needs.
  if (wall.application === "internal" && wall.wallSystem === "corner" && wall.cornerPartnerId == null) {
    issues.push({ kind: "compatibility", message: "Corner wall is missing its partner wall." });
  }
  if (wall.application === "internal" && wall.wallSystem === "shaft" && !isSet(wall.floorHeight)) {
    issues.push({ field: "floorHeight", kind: "required", message: "Shaft system is missing its floor height." });
  }

  // Defensive: a linked partner id that no longer resolves to a real wall
  // (spec §5.2's "a linked system contains an orphaned wall"). deleteWallById
  // already clears these on delete, so this should be unreachable in
  // practice, but a stale/imported snapshot could still carry one.
  if (wall.cornerPartnerId != null && !walls.some(w => w.id === wall.cornerPartnerId)) {
    issues.push({ kind: "compatibility", message: "Linked corner partner no longer exists." });
  }
  if (wall.shaftPartnerId != null && !walls.some(w => w.id === wall.shaftPartnerId)) {
    issues.push({ kind: "compatibility", message: "Linked shaft partner no longer exists." });
  }

  // Colour is External-only -- same reasoning as the wallSystem gate above.
  if (wall.application === "external" && wall.colourType === "special" && !isSet(wall.colour)) {
    issues.push({ field: "colour", kind: "required", message: "Custom colour name is required." });
  }

  return { issues, warnings, calculable, touched };
}

// Whether applying `patch` to `wall` would silently discard data the user
// would reasonably want confirmed first -- used to gate incompatible
// application/orientation/wall-system changes (spec §7.12-7.14) behind a
// ConfirmDialog rather than applying the patch immediately.
export function wouldLoseData(wall: Wall, patch: Partial<Wall>): string | null {
  const losingCornerLink = wall.wallSystem === "corner" && wall.cornerPartnerId != null &&
    ((patch.orient === "vertical" && wall.orient === "horizontal") ||
      (patch.wallSystem != null && patch.wallSystem !== "corner"));
  if (losingCornerLink) return "This wall is linked as part of a Corner system. This change will remove the link, and the linked partner will become a standalone wall.";

  const losingShaftLink = wall.wallSystem === "shaft" && wall.shaftPartnerId != null &&
    ((patch.orient === "vertical" && wall.orient === "horizontal") ||
      (patch.wallSystem != null && patch.wallSystem !== "shaft"));
  if (losingShaftLink) return "This wall is linked as part of a Shaft system. This change will remove the link, and the linked partner will become a standalone wall.";

  return null;
}
