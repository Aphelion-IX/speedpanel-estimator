import { describe, it, expect } from "vitest";
import { determineWallStatus } from "./wallStatus";
import { defaultWall } from "../wallStore";
import type { ComputeOut } from "./computeOut.types";

const emptyOut: ComputeOut = { empty: true, warnings: [], notes: [] };
const readyOut: ComputeOut = { empty: false, warnings: [], notes: [] };
const warningOut: ComputeOut = { empty: false, warnings: ["Waste is above the configured threshold."], notes: [] };
const errorOut: ComputeOut = { empty: true, warnings: [], notes: [], error: "boom" };

describe("determineWallStatus", () => {
  it("is notStarted for a blank wall", () => {
    const wall = defaultWall(1);
    expect(determineWallStatus(wall, [wall], emptyOut)).toBe("notStarted");
  });

  it("is incomplete once some but not all required fields are entered", () => {
    const wall = { ...defaultWall(1), width: "3.2" };
    expect(determineWallStatus(wall, [wall], emptyOut)).toBe("incomplete");
  });

  it("is ready for a complete, warning-free wall", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4" };
    expect(determineWallStatus(wall, [wall], readyOut)).toBe("ready");
  });

  it("is warning for a complete wall with an active compute warning", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4" };
    expect(determineWallStatus(wall, [wall], warningOut)).toBe("warning");
  });

  it("is error when the compute pipeline threw, even over a blank-looking wall", () => {
    const wall = defaultWall(1);
    expect(determineWallStatus(wall, [wall], errorOut)).toBe("error");
  });

  it("prioritises error over incomplete", () => {
    const wall = { ...defaultWall(1), width: "3.2" };
    expect(determineWallStatus(wall, [wall], errorOut)).toBe("error");
  });
});
