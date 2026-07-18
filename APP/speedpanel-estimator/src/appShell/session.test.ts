import { describe, it, expect } from "vitest";
import { PersistedSessionSchema } from "./session";
import { SYSTEMS } from "./systems";

describe("PersistedSessionSchema", () => {
  it("accepts a well-formed session with a real system id", () => {
    const session = { v: 1, system: SYSTEMS[0].id, dimUnit: "m" };
    expect(PersistedSessionSchema.safeParse(session).success).toBe(true);
  });

  it("rejects an unknown system id", () => {
    const session = { v: 1, system: "not-a-real-system", dimUnit: "m" };
    expect(PersistedSessionSchema.safeParse(session).success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const session = { v: 1, system: SYSTEMS[0].id };
    expect(PersistedSessionSchema.safeParse(session).success).toBe(false);
  });

  it("ignores a legacy `mode` field from before single-wall mode was retired", () => {
    const session = { v: 1, system: SYSTEMS[0].id, mode: "single", dimUnit: "m" };
    expect(PersistedSessionSchema.safeParse(session).success).toBe(true);
  });
});
