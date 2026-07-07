// =============================================================================
// useCornerShaftLinking
// =============================================================================
// Symmetric Corner/Shaft wall partner linking, plus the active wall's
// orientation switch (which needs to unlink any stale Corner/Shaft partner
// before flipping to vertical). Pulled out of App.tsx's root component body
// since these are wall-store-adjacent concerns, not view/chrome state.
// =============================================================================
import type { WallStore } from "../wallStore";

export function useCornerShaftLinking(store: WallStore, setShowWall: (v: boolean) => void) {
  const { setWalls, active, update } = store;

  // Symmetric corner-wall linking: setting the active wall's partner to
  // targetId also points targetId back at the active wall, and un-links
  // whichever previous partners either wall had (a wall can only be linked to
  // one other wall at a time -- see estimate_free_corner_wall.md, "always 1
  // corner"). Passing targetId === null unlinks the active wall only.
  // cornerSide defaults are set to opposite sides on link so the pair starts
  // as a sensible right-angle corner rather than both runs claiming the same side.
  const linkCornerPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === active.id)?.cornerPartnerId ?? null;
      return ws.map(w => {
        if (w.id === active.id) return { ...w, cornerPartnerId: targetId, cornerSide: "right" as const };
        if (targetId !== null && w.id === targetId) return { ...w, cornerPartnerId: active.id, cornerSide: "left" as const };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, cornerPartnerId: null };
        // If the newly-chosen partner was itself linked to a third wall, break that old link too.
        if (targetId !== null && w.cornerPartnerId === targetId && w.id !== active.id) return { ...w, cornerPartnerId: null };
        return w;
      });
    });
  };

  // Symmetric shaft-wall linking (primary <-> secondary split), same pattern
  // as linkCornerPartner -- no side field to default here since Shaft wall
  // doesn't have a "which side" concept, just the shared junction.
  const linkShaftPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === active.id)?.shaftPartnerId ?? null;
      return ws.map(w => {
        if (w.id === active.id) return { ...w, shaftPartnerId: targetId };
        if (targetId !== null && w.id === targetId) return { ...w, shaftPartnerId: active.id };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, shaftPartnerId: null };
        if (targetId !== null && w.shaftPartnerId === targetId && w.id !== active.id) return { ...w, shaftPartnerId: null };
        return w;
      });
    });
  };

  // Switches the ACTIVE wall's own orientation (per-wall now -- see Wall.orient),
  // not a global setting, so other walls in a combined project are unaffected.
  // Corner/Shaft wall systems only make sense for horizontal walls, so switching
  // to vertical resets wallSystem back to "standard" and unlinks any partner
  // (mirroring deleteWall's dangling-partner cleanup) to avoid stale state.
  const switchOrient = (o: "vertical" | "horizontal") => {
    if (o === active.orient) return;
    if (o === "vertical") {
      if (active.wallSystem === "corner" && active.cornerPartnerId != null) linkCornerPartner(null);
      if (active.wallSystem === "shaft" && active.shaftPartnerId != null) linkShaftPartner(null);
      update({ orient: o, wallSystem: "standard" });
    } else {
      update({ orient: o });
    }
    setShowWall(true);
  };

  return { linkCornerPartner, linkShaftPartner, switchOrient };
}
