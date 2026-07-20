import { describe, it, expect } from "vitest";
import { validateWall, wouldLoseData } from "./validateWall";
import { defaultWall } from "../wallStore";
import type { ComputeOut } from "./computeOut.types";

const emptyOut: ComputeOut = { empty: true, warnings: [], notes: [] };
const readyOut: ComputeOut = { empty: false, warnings: [], notes: [] };
const warningOut: ComputeOut = { empty: false, warnings: ["Horizontal span is near the selected system limit."], notes: [] };

describe("validateWall", () => {
  it("is untouched (Not Started) for a fully blank wall", () => {
    const wall = defaultWall(1);
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.touched).toBe(false);
    expect(v.issues).toEqual([]);
  });

  it("flags a missing height once width is entered (Incomplete, not Not Started)", () => {
    const wall = { ...defaultWall(1), width: "3.2" };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.touched).toBe(true);
    expect(v.issues.some(i => i.field === "height")).toBe(true);
  });

  it("is calculable and issue-free for a complete standard wall", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4" };
    const v = validateWall(wall, [wall], readyOut);
    expect(v.touched).toBe(true);
    expect(v.issues).toEqual([]);
    expect(v.calculable).toBe(true);
  });

  it("surfaces compute warnings unchanged", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4", orient: "horizontal" as const };
    const v = validateWall(wall, [wall], warningOut);
    expect(v.warnings).toEqual(warningOut.warnings);
  });

  it("flags a rake profile missing its left/right heights", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4", profile: "rake" as const };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.issues.some(i => i.field === "leftH")).toBe(true);
    expect(v.issues.some(i => i.field === "rightH")).toBe(true);
  });

  it("flags a gable profile missing left/right eaves and apex height, but not ridge position (blank = centred)", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4", profile: "gable" as const };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.issues.some(i => i.field === "leftH")).toBe(true);
    expect(v.issues.some(i => i.field === "rightH")).toBe(true);
    expect(v.issues.some(i => i.field === "apexH")).toBe(true);
    expect(v.issues.some(i => i.field === "ridgeX")).toBe(false);
  });

  it("does not flag a gable profile whose sides are covered by the legacy single eavesH value", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4", profile: "gable" as const, eavesH: "2.4", apexH: "3.0" };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.issues.some(i => i.field === "leftH" || i.field === "rightH")).toBe(false);
  });

  it("flags a corner wall with no partner (always required, unlike shaft's optional secondary)", () => {
    const wall = { ...defaultWall(1, "horizontal"), width: "3.2", height: "2.4", wallSystem: "corner" as const, cornerPartnerId: null };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.issues.some(i => i.kind === "compatibility" && /partner/.test(i.message))).toBe(true);
  });

  it("does not require a corner partner on an External wall (wallSystem is Internal-only)", () => {
    const wall = { ...defaultWall(1, "horizontal", "external"), width: "3.2", height: "2.4", wallSystem: "corner" as const, cornerPartnerId: null };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.issues.some(i => i.kind === "compatibility" && /partner/.test(i.message))).toBe(false);
  });

  it("does not require a shaft wall to have a partner, only a floor height", () => {
    const wall = { ...defaultWall(1, "horizontal"), width: "3.2", height: "9", wallSystem: "shaft" as const, shaftPartnerId: null, floorHeight: "3" };
    const v = validateWall(wall, [wall], readyOut);
    expect(v.issues.some(i => /partner/.test(i.message))).toBe(false);
  });

  it("flags a shaft wall missing floor height", () => {
    const wall = { ...defaultWall(1, "horizontal"), width: "3.2", height: "9", wallSystem: "shaft" as const, floorHeight: "" };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.issues.some(i => i.field === "floorHeight")).toBe(true);
  });

  it("flags a dangling corner partner reference (orphaned link)", () => {
    const wall = { ...defaultWall(1, "horizontal"), width: "3.2", height: "2.4", wallSystem: "corner" as const, cornerPartnerId: 99 };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.issues.some(i => /no longer exists/.test(i.message))).toBe(true);
  });

  it("flags a special colour with no colour name (External wall)", () => {
    const wall = { ...defaultWall(1, "vertical", "external"), width: "3.2", height: "2.4", colourType: "special" as const, colour: "" };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.issues.some(i => i.field === "colour")).toBe(true);
  });

  it("does not flag a special colour with no colour name on an Internal wall (colour is External-only)", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4", colourType: "special" as const, colour: "" };
    const v = validateWall(wall, [wall], emptyOut);
    expect(v.issues.some(i => i.field === "colour")).toBe(false);
  });
});

describe("wouldLoseData", () => {
  it("warns when switching a linked corner wall to vertical", () => {
    const wall = { ...defaultWall(1, "horizontal"), wallSystem: "corner" as const, cornerPartnerId: 2 };
    expect(wouldLoseData(wall, { orient: "vertical" })).toMatch(/Corner/);
  });

  it("warns when switching a linked shaft wall's system away from shaft", () => {
    const wall = { ...defaultWall(1, "horizontal"), wallSystem: "shaft" as const, shaftPartnerId: 2 };
    expect(wouldLoseData(wall, { wallSystem: "standard" })).toMatch(/Shaft/);
  });

  it("returns null for an unlinked wall changing system", () => {
    const wall = { ...defaultWall(1, "horizontal"), wallSystem: "corner" as const, cornerPartnerId: null };
    expect(wouldLoseData(wall, { wallSystem: "standard" })).toBeNull();
  });
});
