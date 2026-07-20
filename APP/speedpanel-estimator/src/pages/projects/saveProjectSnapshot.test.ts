// =============================================================================
// saveProjectSnapshot -- covers the notFound branch (spec §11 "Project
// deleted while open"): a successful-looking update() with zero rows
// returned must be distinguishable from a real save, not reported as one.
//
// The module under test is dynamically imported inside each test, AFTER
// vi.doMock + vi.resetModules(), so it picks up a fresh, mocked
// ../../lib/supabaseClient instead of the real client -- a static top-level
// import here would load (and cache) the real client first.
// =============================================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SavedProjectData } from "./projectTypes";

const FAKE_SNAPSHOT = {
  v: 1, walls: [], activeId: 1, nextId: 2,
  projectStock: "", projectLock: false, customLengthInput: "", customActive: false,
  system: "int-vert", dimUnit: "m",
} as unknown as SavedProjectData;

function mockSupabaseUpdate(result: { data: unknown[] | null; error: { message: string } | null }) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from };
}

beforeEach(() => {
  vi.resetModules();
});

describe("saveProjectSnapshot", () => {
  it("reports success when the update actually matched a row", async () => {
    vi.doMock("../../lib/supabaseClient", () => ({ supabase: mockSupabaseUpdate({ data: [{ id: "p1" }], error: null }) }));
    const { saveProjectSnapshot } = await import("./saveProjectSnapshot");

    const result = await saveProjectSnapshot("p1", FAKE_SNAPSHOT);
    expect(result).toEqual({ error: null });
  });

  it("reports notFound when the update matched zero rows (deleted/inaccessible)", async () => {
    vi.doMock("../../lib/supabaseClient", () => ({ supabase: mockSupabaseUpdate({ data: [], error: null }) }));
    const { saveProjectSnapshot } = await import("./saveProjectSnapshot");

    const result = await saveProjectSnapshot("p1", FAKE_SNAPSHOT);
    expect(result.error).toBeTruthy();
    expect(result.notFound).toBe(true);
  });

  it("surfaces a real Postgrest error as-is, without notFound", async () => {
    vi.doMock("../../lib/supabaseClient", () => ({ supabase: mockSupabaseUpdate({ data: null, error: { message: "network down" } }) }));
    const { saveProjectSnapshot } = await import("./saveProjectSnapshot");

    const result = await saveProjectSnapshot("p1", FAKE_SNAPSHOT);
    expect(result).toEqual({ error: "network down" });
  });

  it("short-circuits when Supabase isn't configured", async () => {
    vi.doMock("../../lib/supabaseClient", () => ({ supabase: null }));
    const { saveProjectSnapshot } = await import("./saveProjectSnapshot");

    const result = await saveProjectSnapshot("p1", FAKE_SNAPSHOT);
    expect(result.error).toBeTruthy();
    expect(result.notFound).toBeUndefined();
  });
});
