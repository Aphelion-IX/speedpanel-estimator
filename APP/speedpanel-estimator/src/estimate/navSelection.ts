// =============================================================================
// Nav selection
// =============================================================================
// What the Estimate Structure nav currently has selected -- separate from
// (and layered on top of) the wall store's own activeId, since selecting a
// Corner/Shaft kit doesn't pick either linked wall as "the" active one for
// the rest of the form; it shows both walls' shared fields instead. Selecting
// a wall still drives activeId as it always has.
// =============================================================================
export type SelectedNavItem =
  | { type: "wall"; wallId: number }
  | { type: "kit"; kind: "corner" | "shaft"; wallAId: number; wallBId: number };
