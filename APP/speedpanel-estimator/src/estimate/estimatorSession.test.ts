import { describe, it, expect } from "vitest";
import { determineSessionState, isNoEstimate } from "./estimatorSession";
import { defaultWall } from "../wallStore";
import type { ComputeOut } from "./computeOut.types";

describe("determineSessionState", () => {
  it("is noProject when nothing is open and nothing has been touched", () => {
    expect(determineSessionState({ openProject: false, noEstimate: true, readOnly: false, loadError: false })).toBe("noProject");
  });

  it("is blankDraft once the seeded wall has been configured but nothing is saved", () => {
    expect(determineSessionState({ openProject: false, noEstimate: false, readOnly: false, loadError: false })).toBe("blankDraft");
  });

  it("is active whenever a saved project is open, even if it's still blank", () => {
    expect(determineSessionState({ openProject: true, noEstimate: true, readOnly: false, loadError: false })).toBe("active");
  });

  it("is readOnly regardless of noEstimate/openProject when the flag is set", () => {
    expect(determineSessionState({ openProject: true, noEstimate: false, readOnly: true, loadError: false })).toBe("readOnly");
  });

  it("is loadFailed above every other state", () => {
    expect(determineSessionState({ openProject: true, noEstimate: false, readOnly: true, loadError: true })).toBe("loadFailed");
  });
});

describe("isNoEstimate", () => {
  it("is true for the freshly-seeded, untouched single wall", () => {
    const wall = defaultWall(1);
    const out: ComputeOut = { empty: true, warnings: [], notes: [] };
    expect(isNoEstimate([{ wall, out }], [])).toBe(true);
  });

  it("is false once the single wall has been configured", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4" };
    const out: ComputeOut = { empty: false, warnings: [], notes: [] };
    expect(isNoEstimate([{ wall, out }], [])).toBe(false);
  });

  it("is false once a second wall exists, even if both are blank", () => {
    const wallA = defaultWall(1);
    const wallB = defaultWall(2);
    const out: ComputeOut = { empty: true, warnings: [], notes: [] };
    expect(isNoEstimate([{ wall: wallA, out }, { wall: wallB, out }], [])).toBe(false);
  });
});
