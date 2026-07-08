import { describe, it, expect } from "vitest";
import { backfillOrient, defaultWall } from "./wallStore";

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
