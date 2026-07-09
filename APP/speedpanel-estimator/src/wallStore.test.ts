import { describe, it, expect } from "vitest";
import { backfillOrient, defaultWall, WallSchema, PersistedProjectSchema } from "./wallStore";

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
