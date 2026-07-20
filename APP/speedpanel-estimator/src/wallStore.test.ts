/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { backfillOrient, defaultWall, useWallStore, WallSchema, PersistedProjectSchema } from "./wallStore";

describe("backfillOrient", () => {
  it("leaves an already-set orient untouched", () => {
    const walls = [{ ...defaultWall(1, "horizontal") }];
    expect(backfillOrient(walls)[0].orient).toBe("horizontal");
  });

  it("defaults a missing orient to vertical (pre-per-wall-orientation saves)", () => {
    const { orient: _orient, ...legacyWall } = defaultWall(1);
    const [backfilled] = backfillOrient([legacyWall as ReturnType<typeof defaultWall>]);
    expect(backfilled.orient).toBe("vertical");
  });

  it("doesn't mutate the input array's objects", () => {
    const wall = defaultWall(1, "horizontal");
    const [result] = backfillOrient([wall]);
    expect(result).not.toBe(wall);
    expect(wall.orient).toBe("horizontal");
  });
});

describe("PersistedProjectSchema / WallSchema", () => {
  const validProject = () => ({
    v: 1, walls: [defaultWall(1)], activeId: 1, nextId: 2,
    projectStock: "", projectLock: false, customLengthInput: "", customActive: false,
  });

  it("accepts a well-formed project, including a wall with only its required fields", () => {
    expect(PersistedProjectSchema.safeParse(validProject()).success).toBe(true);
  });

  it("accepts optional Wall fields being entirely absent (cornerPartnerId, colour, etc.)", () => {
    const { cornerPartnerId: _c, cornerSide: _s, colour: _colour, colourType: _ct, ...requiredOnly } = defaultWall(1);
    expect(WallSchema.safeParse(requiredOnly).success).toBe(true);
  });

  it("rejects a project whose wall is missing a required field", () => {
    const project = validProject();
    const { width: _width, ...brokenWall } = project.walls[0];
    expect(PersistedProjectSchema.safeParse({ ...project, walls: [brokenWall] }).success).toBe(false);
  });

  it("rejects a project whose wall has a wrong-type field", () => {
    const project = validProject();
    expect(PersistedProjectSchema.safeParse({ ...project, walls: [{ ...project.walls[0], width: 123 }] }).success).toBe(false);
  });

  it("rejects a project missing a top-level required field", () => {
    const { activeId: _activeId, ...broken } = validProject();
    expect(PersistedProjectSchema.safeParse(broken).success).toBe(false);
  });
});

describe("useWallStore's atomic linked-system creation", () => {
  // useWallStore always starts with one seeded blank wall (see defaultWall
  // usage in useWallStore itself), so each pair-creation call adds two MORE
  // walls to whatever's already there -- these tests look up the new pair by
  // wallSystem rather than assuming an exact final wall count.
  it("createCornerPair creates two walls, cross-linked, in one action", () => {
    const { result } = renderHook(() => useWallStore({ dimUnit: "m", persistLocally: false }));
    const before = result.current.walls.length;
    act(() => result.current.createCornerPair());

    expect(result.current.walls.length).toBe(before + 2);
    const [a, b] = result.current.walls.filter(w => w.wallSystem === "corner");
    expect(a.orient).toBe("horizontal");
    expect(b.orient).toBe("horizontal");
    expect(a.cornerPartnerId).toBe(b.id);
    expect(b.cornerPartnerId).toBe(a.id);
    expect(a.cornerSide).not.toBe(b.cornerSide);
    // The first member of the pair becomes the active wall.
    expect(result.current.activeId).toBe(a.id);
  });

  it("createShaftPair creates two P78 walls, cross-linked, in one action", () => {
    const { result } = renderHook(() => useWallStore({ dimUnit: "m", persistLocally: false }));
    const before = result.current.walls.length;
    act(() => result.current.createShaftPair());

    expect(result.current.walls.length).toBe(before + 2);
    const [a, b] = result.current.walls.filter(w => w.wallSystem === "shaft");
    expect(a.type).toBe(78);
    expect(b.type).toBe(78);
    expect(a.shaftPartnerId).toBe(b.id);
    expect(b.shaftPartnerId).toBe(a.id);
  });

  it("does not collide ids across two consecutive pair creations", () => {
    const { result } = renderHook(() => useWallStore({ dimUnit: "m", persistLocally: false }));
    act(() => result.current.createCornerPair());
    act(() => result.current.createShaftPair());

    const ids = result.current.walls.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
