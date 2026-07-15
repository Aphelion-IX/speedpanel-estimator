// =============================================================================
// Wall store
// =============================================================================
// Owns the single, SHARED wall/project state used by BOTH the Internal
// (InternalCalculator) and External (ExternalCalculator) calculators, plus the
// hook that derives per-mode compute results from that shared wall list. Lives
// at the top level (not under estimate/) since it's app state/persistence, not
// pure compute -- but is importable by both calculators without either
// importing from the other.
// =============================================================================
import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { makeToDisp, makeToM } from "./estimate/computeUtils";
import type { Wall, WallInput, ComputeOut, WallResult, DimField } from "./estimate/wall.types";

// Mirrors src/estimate/wallDomain.ts's Wall interface field-for-field. This is
// the schema behind PersistedProjectSchema below -- the actual highest-value
// validation boundary in the app: a customer's saved project (this shape,
// straight from Supabase's `projects.data` jsonb column) is applied directly
// into the live compute engine's state via loadFrom(), with nothing else
// standing between a malformed/outdated snapshot and src/estimate/*.
const edgeStateSchema = z.object({ top: z.boolean(), bottom: z.boolean(), left: z.boolean(), right: z.boolean() });

export const WallSchema = z.object({
  id: z.number(), name: z.string(),
  orient: z.enum(["vertical", "horizontal"]),
  type: z.union([z.literal(51), z.literal(64), z.literal(78)]),
  profile: z.enum(["standard", "rake", "gable"]),
  wallSystem: z.enum(["standard", "corner", "shaft"]),
  cornerPartnerId: z.number().nullable().optional(),
  cornerSide: z.enum(["left", "right"]).optional(),
  floorHeight: z.string().optional(),
  shaftPartnerId: z.number().nullable().optional(),
  junctionPartnerId: z.number().nullable().optional(),
  width: z.string(), height: z.string(),
  leftH: z.string(), rightH: z.string(),
  eavesH: z.string(), apexH: z.string(), ridgeX: z.string(),
  headFinish: z.enum(["C", "J"]), bottomFinish: z.enum(["C", "J"]),
  leftFinish: z.enum(["C", "J"]), rightFinish: z.enum(["C", "J"]),
  intCorners: z.string(), extCorners: z.string(),
  edges: edgeStateSchema,
  headFlash: z.boolean(), forcedStock: z.string(),
  fullyEngaged: z.boolean(), steelStructure: z.boolean(),
  colour: z.string().optional(), colourType: z.enum(["stocked", "special"]).optional(),
});

// Single default-wall factory shared by both Internal and External. The colour
// fields are only read by External (Internal ignores them), but every wall
// carries them so the same wall list can be shown/computed in either mode --
// see useWallStore, which keeps one shared list across all system switches.
export const defaultWall = (id: number, orient: "vertical" | "horizontal" = "vertical"): Wall => ({
  id, name: `Wall ${id}`, orient, type: 78, profile: "standard", wallSystem: "standard",
  cornerPartnerId: null, cornerSide: "right",
  floorHeight: "", shaftPartnerId: null, junctionPartnerId: null,
  width: "", height: "", leftH: "", rightH: "", eavesH: "", apexH: "", ridgeX: "",
  headFinish: "C", bottomFinish: "C", leftFinish: "C", rightFinish: "C",
  intCorners: "", extCorners: "",
  colour: "OW", colourType: "stocked",
  edges: { top: true, bottom: true, left: true, right: true },
  headFlash: true, forcedStock: "", fullyEngaged: false, steelStructure: false,
});

// --- useWallStore -------------------------------------------------------------
// Owns the single, SHARED wall/project state used by BOTH the Internal
// (SpeedpanelEstimator) and External (ExternalCalculator) calculators. One list
// survives every orientation/wall-type switch (the raw Wall shape is identical
// across modes -- orientation is not stored on a wall, and External compute
// ignores the Internal-only fields), and is persisted to the device so the
// project restores on reopen. Compute-agnostic: per-mode results are derived
// separately via useWallResults.
export const PROJECT_KEY = "speedpanel:project";

export const PersistedProjectSchema = z.object({
  v: z.number(),
  walls: z.array(WallSchema),
  activeId: z.number(),
  nextId: z.number(),
  projectStock: z.string(),
  projectLock: z.boolean(),
  customLengthInput: z.string(),
  customActive: z.boolean(),
});
export type PersistedProject = z.infer<typeof PersistedProjectSchema>;

// Backfill orient for walls saved before orientation became per-wall --
// shared by loadProject() (device-local) and useWallStore's loadFrom()
// (Supabase-saved projects), since both read a PersistedProject-shaped
// payload that may predate that field.
export function backfillOrient(walls: Wall[]): Wall[] {
  return walls.map(w => ({ ...w, orient: w.orient ?? "vertical" }));
}

export function loadProject(): PersistedProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !Array.isArray(p.walls) || p.walls.length === 0) return null;
    // backfillOrient runs BEFORE validation -- older saves predate the
    // per-wall orient field entirely, and PersistedProjectSchema requires
    // it, so the raw JSON needs that default patched in first.
    p.walls = backfillOrient(p.walls);
    const parsed = PersistedProjectSchema.safeParse(p);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// persistLocally: false when a saved (Supabase) project is currently open --
// see App.tsx's openProjectId. In that state, autosaving every keystroke to
// the single device-local PROJECT_KEY slot would blur the line between "this
// device's anonymous scratch project" and "this account's saved project";
// saving the latter instead happens explicitly, via the Save affordance
// calling exportSnapshot() + saveProjectSnapshot(). Defaults to true so
// existing signed-out/no-project usage of the Estimator tab is unchanged.
export function useWallStore({ dimUnit, onWallAdded, persistLocally = true }: { dimUnit: string; onWallAdded?: () => void; persistLocally?: boolean }) {
  const saved = loadProject();
  const [walls, setWalls]               = useState<Wall[]>(() => saved ? saved.walls : [defaultWall(1)]);
  const [activeId, setActiveId]         = useState(() => saved ? saved.activeId : 1);
  const [nextId, setNextId]             = useState(() => saved ? saved.nextId : 2);
  const [projectStock, setProjectStock] = useState(() => saved ? saved.projectStock : "");
  const [projectLock, setProjectLock]   = useState(() => saved ? saved.projectLock : false);
  const [customLengthInput, setCustomLengthInput] = useState(() => saved ? saved.customLengthInput : "");
  const [customActive, setCustomActive] = useState(() => saved ? saved.customActive : false);

  // Persist the whole project to the device on any change (unless a saved
  // Supabase project is currently open -- see persistLocally above).
  useEffect(() => {
    if (typeof window === "undefined" || !persistLocally) return;
    const payload: PersistedProject = {
      v: 1, walls, activeId, nextId, projectStock, projectLock, customLengthInput, customActive,
    };
    try { window.localStorage.setItem(PROJECT_KEY, JSON.stringify(payload)); } catch { /* ignore quota/serialization errors */ }
  }, [walls, activeId, nextId, projectStock, projectLock, customLengthInput, customActive, persistLocally]);

  const active = walls.find(w => w.id === activeId) || walls[0];
  const update = (patch: Partial<Wall>) =>
    setWalls(ws => ws.map(w => w.id === activeId ? { ...w, ...patch } : w));
  const toDisp = makeToDisp(dimUnit);
  const toM    = makeToM(dimUnit);
  const updDim = (field: DimField, d: string) =>
    update({ [field]: toM(d) } as Pick<Wall, DimField>);

  // Apply or clear the project-wide stocked length across all walls.
  const setProjectLength = (stock: string, locked: boolean) => {
    setProjectStock(stock);
    setProjectLock(locked);
    setWalls(ws => ws.map(w => ({ ...w, forcedStock: locked ? stock : "" })));
  };

  // Resolve the forced stock value to inherit when adding/duplicating a wall.
  // When projectLock is on and customActive is on, the typed metres value is used
  // (rounded to 3dp) so the new wall immediately inherits the custom length.
  const projectForcedStock = (): string => {
    if (!projectLock) return "";
    if (customActive) {
      const val = parseFloat(makeToM(dimUnit)(customLengthInput));
      return val > 0 ? String(Math.round(val * 1000) / 1000) : projectStock;
    }
    return projectStock;
  };

  // Shared body for addBlankWall/addCornerWall/addShaftWall -- an optional
  // patch lets a caller pre-set fields (e.g. orient/wallSystem) atomically in
  // the same setWalls call, since update() closes over activeId from
  // render-time state and can't safely be chained right after this (the new
  // wall's setActiveId hasn't re-rendered yet). addBlankWall itself keeps its
  // existing zero-arg signature -- src/ui/wallsCard.tsx passes it directly as
  // `onClick={addBlankWall}`, so it must never take an argument the DOM
  // MouseEvent could be mistaken for.
  const addWall = (patch?: Partial<Wall>) => {
    const id = nextId;
    setWalls(ws => [...ws, { ...defaultWall(id, active.orient), forcedStock: projectForcedStock(), ...patch }]);
    setNextId(id + 1);
    setActiveId(id);
    onWallAdded?.();
  };
  const addBlankWall = () => addWall();
  // Convenience creators for the Estimate Structure nav's "+ Add corner"/
  // "+ Add shaft" actions -- corner/shaft wall systems are horizontal-only
  // (see WallSystemSelector), and shaft is always 78 mm, not a user choice
  // (same convention as WallSystemSelector's own onChange handler).
  const addCornerWall = () => addWall({ orient: "horizontal", wallSystem: "corner" });
  const addShaftWall = () => addWall({ orient: "horizontal", wallSystem: "shaft", type: 78 });

  // sourceId defaults to the active wall (the Calculator Workspace's own
  // Duplicate button), but a specific id can be passed so a non-active row
  // (e.g. the Estimate Structure nav's own per-row Duplicate button) can act
  // on itself without racing setActiveId -- looking the source up fresh from
  // the setWalls updater's own `ws` avoids depending on `active`/`activeId`
  // possibly being stale from a just-fired-but-not-yet-applied setActiveId.
  const duplicateWall = (sourceId: number = activeId) => {
    const id = nextId;
    setWalls(ws => {
      const source = ws.find(w => w.id === sourceId) ?? active;
      return [...ws, {
        ...source, id,
        name: `${source.name} copy`,
        forcedStock: projectLock ? projectForcedStock() : source.forcedStock,
      }];
    });
    setNextId(id + 1);
    setActiveId(id);
    onWallAdded?.();
  };

  // targetId defaults to the active wall (the Calculator Workspace's own
  // Delete button); same id-param pattern as duplicateWall above. Only
  // reassigns activeId when the deleted wall WAS the active one -- deleting
  // an unrelated row (e.g. from the nav) shouldn't change which wall the
  // workspace is editing.
  const deleteWall = (targetId: number = activeId) => {
    if (walls.length === 1) return;
    const rest = walls
      .filter(w => w.id !== targetId)
      // If the deleted wall was linked to another (Corner or Shaft wall
      // pairing), clear the surviving wall's side of the link too -- a
      // dangling cornerPartnerId/shaftPartnerId would point at a wall that no
      // longer exists.
      .map(w => w.cornerPartnerId === targetId ? { ...w, cornerPartnerId: null } : w)
      .map(w => w.shaftPartnerId === targetId ? { ...w, shaftPartnerId: null } : w)
      .map(w => w.junctionPartnerId === targetId ? { ...w, junctionPartnerId: null } : w);
    setWalls(rest);
    if (targetId === activeId) setActiveId(rest[0].id);
  };

  // Commit the typed custom length to forcedStock on the active wall (or all
  // walls if locked). If raw is empty or invalid, clears forcedStock so the
  // stock-length dropdown drives it again.
  const commitCustomLength = (raw: string, isActive: boolean = customActive) => {
    setCustomLengthInput(raw);
    if (!isActive) return;
    const val = parseFloat(makeToM(dimUnit)(raw));
    const stock = val > 0 ? String(Math.round(val * 1000) / 1000) : "";
    if (projectLock) { setWalls(ws => ws.map(w => ({ ...w, forcedStock: stock }))); }
    else { update({ forcedStock: stock }); }
  };

  // Toggle custom length mode on/off.
  const toggleCustom = () => {
    const next = !customActive;
    setCustomActive(next);
    if (next) {
      // Activating: apply any already-typed value immediately.
      const val = parseFloat(makeToM(dimUnit)(customLengthInput));
      if (val > 0) {
        const stock = String(Math.round(val * 1000) / 1000);
        if (projectLock) { setWalls(ws => ws.map(w => ({ ...w, forcedStock: stock }))); }
        else { update({ forcedStock: stock }); }
      }
    } else {
      // Deactivating: restore dropdown-driven value.
      if (projectLock) { setWalls(ws => ws.map(w => ({ ...w, forcedStock: projectStock }))); }
      else { update({ forcedStock: "" }); }
    }
  };

  // Reset all wall state back to a single blank wall. Used by resetAll (the
  // header reset button) -- NOT by switchSystem anymore, which now preserves walls.
  const resetWalls = () => {
    setWalls([defaultWall(1)]);
    setActiveId(1);
    setNextId(2);
    setProjectStock("");
    setProjectLock(false);
    setCustomLengthInput("");
    setCustomActive(false);
  };

  // Clear custom length state -- called when the dim unit switches so a stale
  // typed value (e.g. "7200" entered in mm mode) doesn't linger in m mode.
  const clearCustomLength = () => { setCustomLengthInput(""); setCustomActive(false); };

  // --- Saved-project integration (src/pages/projects/) ------------------------
  // loadFrom replaces the in-memory state wholesale from a saved project's
  // snapshot -- same full-state-replacement shape as resetWalls, but from a
  // given payload instead of a blank wall. exportSnapshot reads the current
  // in-memory state back out in the same shape, for an explicit Save action
  // (as opposed to persistLocally's automatic device-local save). Kept
  // symmetric with loadProject()'s own orient-backfill so snapshots saved
  // before orientation became per-wall still load correctly here too.
  const loadFrom = (data: PersistedProject) => {
    setWalls(backfillOrient(data.walls));
    setActiveId(data.activeId);
    setNextId(data.nextId);
    setProjectStock(data.projectStock);
    setProjectLock(data.projectLock);
    setCustomLengthInput(data.customLengthInput);
    setCustomActive(data.customActive);
  };

  const exportSnapshot = (): PersistedProject => ({
    v: 1, walls, activeId, nextId, projectStock, projectLock, customLengthInput, customActive,
  });

  // Symmetric junction linking (see Wall.junctionPartnerId): marks two walls as
  // physically adjoining for the combined estimate's connection/junction
  // material calculation (src/estimate/calculateConnectionMaterials.ts). Lives
  // here (rather than per-calculator) since it's generic -- available on any
  // wall regardless of orientation/wallSystem, and needed by both the Internal
  // and External calculators, which share this one store.
  const linkJunctionPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === activeId)?.junctionPartnerId ?? null;
      return ws.map(w => {
        if (w.id === activeId) return { ...w, junctionPartnerId: targetId };
        if (targetId !== null && w.id === targetId) return { ...w, junctionPartnerId: activeId };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, junctionPartnerId: null };
        if (targetId !== null && w.junctionPartnerId === targetId && w.id !== activeId) return { ...w, junctionPartnerId: null };
        return w;
      });
    });
  };

  return {
    walls, setWalls, activeId, setActiveId, nextId, setNextId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, toM, updDim,
    setProjectLength, projectForcedStock,
    addBlankWall, addCornerWall, addShaftWall, duplicateWall, deleteWall,
    commitCustomLength, toggleCustom, resetWalls, clearCustomLength,
    linkJunctionPartner, loadFrom, exportSnapshot,
  };
}

// Shared store type, threaded from SpeedpanelEstimator down into ExternalCalculator
// so both calculators read/write the same wall list.
export type WallStore = ReturnType<typeof useWallStore>;

// --- useWallResults -----------------------------------------------------------
// Derives the per-mode compute results from the shared wall list. Called once
// per active calculator with that mode's compute function (compute vs
// computeExternal), so the same walls produce Internal or External estimates
// without touching the stored data. Each wall carries its own `orient`, so a
// combined/project estimate can freely mix vertical and horizontal walls --
// this must NOT be overridden with a single shared orientation here.
export function useWallResults(
  walls: Wall[], activeId: number,
  computeFn: (inp: WallInput) => ComputeOut,
) {
  // PERF NOTE: walls array reference changes on every keystroke (setWalls creates
  // a new array), so this memo re-runs all wall computations on each input event.
  // For typical project sizes (<=20 walls) this is fast enough. If wall counts
  // grow, consider a per-wall memo keyed by wall id + a shallow hash of inputs.
  const results = useMemo<WallResult[]>(
    () => walls.map(w => ({ wall: w, out: computeFn(w) })),
    [walls]
  );
  const out = useMemo(
    () => (results.find(r => r.wall.id === activeId) || { out: { empty: true, warnings: [], notes: [] } }).out
       || { empty: true, warnings: [], notes: [] },
    [results, activeId]
  );
  const warnById = Object.fromEntries(
    results.map(r => [r.wall.id, !!(r.out.warnings && r.out.warnings.length > 0)])
  );
  return { results, out, warnById };
}
