import { describe, it, expect } from "vitest";
import { determineSessionState } from "./estimatorSession";

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
