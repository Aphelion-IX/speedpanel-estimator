// =============================================================================
// Admin section catalog <-> route dispatch parity
// =============================================================================
// An audit found twelve fully-built, working admin pages that AdminRoot.tsx
// dispatched but no dashboard tile pointed at, so they were reachable only by
// typing their hash URL. Nothing failed -- the pages worked, the routes
// worked, they were just invisible.
//
// These tests keep the catalog and the dispatch in sync in BOTH directions:
// a new admin page can't ship unreachable, and a tile can't point at a
// section that no longer dispatches (the trap "companies"/"priceLists" would
// have been after their Phase 14 retirement).
//
// AdminRoot.tsx is read as source rather than rendered: the assertion is
// about which sections the router *dispatches*, which is a static property of
// the file, and rendering it would drag in every admin page plus Supabase.
// =============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ADMIN_GROUPS } from "./adminSections";
import { canAccessSection } from "./adminSectionAccess";
import type { AdminSubPage } from "../../appShell/useHashRoute";

const adminRootSrc = readFileSync(new URL("./AdminRoot.tsx", import.meta.url), "utf8");

// Every `route.sub === "..."` comparison in AdminRoot.tsx's dispatch.
function dispatchedSubPages(): Set<string> {
  const found = new Set<string>();
  for (const m of adminRootSrc.matchAll(/route\.sub\s*===\s*"([a-zA-Z]+)"/g)) found.add(m[1]);
  found.delete("dashboard"); // the dashboard is the tile grid itself, not a tile
  return found;
}

const tiledSubPages = new Set<string>(ADMIN_GROUPS.flatMap(g => g.items.map(i => i.key)));

describe("admin section catalog", () => {
  it("gives every dispatched admin sub-page a dashboard tile", () => {
    const missing = [...dispatchedSubPages()].filter(sub => !tiledSubPages.has(sub)).sort();
    expect(missing, `Admin pages reachable only by typing their URL: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no tile pointing at a sub-page the router doesn't dispatch", () => {
    const dispatched = dispatchedSubPages();
    const orphaned = [...tiledSubPages].filter(sub => !dispatched.has(sub)).sort();
    expect(orphaned, `Tiles leading nowhere: ${orphaned.join(", ")}`).toEqual([]);
  });

  it("actually found the dispatch table (guards against a vacuous pass)", () => {
    // If the regex ever stops matching, both tests above would pass trivially.
    expect(dispatchedSubPages().size).toBeGreaterThan(10);
    expect(dispatchedSubPages()).toContain("products");
  });

  it("lists no duplicate tiles", () => {
    const keys = ADMIN_GROUPS.flatMap(g => g.items.map(i => i.key));
    expect(keys.length).toBe(new Set(keys).size);
  });

  it("does not resurrect the Phase 14 sections that moved to #/accounts", () => {
    expect([...tiledSubPages]).not.toContain("companies");
    expect([...tiledSubPages]).not.toContain("priceLists");
  });
});

describe("admin dashboard tile visibility", () => {
  const allKeys = [...tiledSubPages] as AdminSubPage[];

  it("shows every section to a super_admin", () => {
    const visible = allKeys.filter(k => canAccessSection("super_admin", new Set(), k));
    expect(visible.length).toBe(allKeys.length);
  });

  it("shows a role only the sections it has been granted", () => {
    const granted = new Set(["admin.section.orders", "admin.section.products"]);
    const visible = allKeys.filter(k => canAccessSection("dispatch", granted, k)).sort();
    expect(visible).toEqual(["orders", "products"]);
  });

  it("hides every section from a role with no grants", () => {
    const visible = allKeys.filter(k => canAccessSection("dispatch", new Set(), k));
    expect(visible).toEqual([]);
  });
});
