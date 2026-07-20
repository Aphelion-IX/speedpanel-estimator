# Merge Internal + External calculators into one unified estimator

*Plan + handoff status from the session that started this work on
`claude/system-estimator-redesign-chhqa3`. Phases 1-3 are done and merged into
this branch's history; Phase 4 onward is not started — see "Handoff status"
below before picking this up.*

## Context

The supplied v5 design package models ONE estimator where each wall independently picks
"Internal" or "External" application (spec §4.3). The production app instead implements this as
two deliberately-forked calculator trees (`src/internalCalculator/` vs `src/externalCalculator/`),
selected once per PROJECT via a `system` string (`appShell/systems.ts`), documented in CLAUDE.md
as intentional ("fork-not-share... each calculator can evolve its own UI without risking a change
leaking into the other").

During visual verification against the mockups, this showed up concretely: the mockup's
"Wall setup" card has an "Internal/External" wall-type toggle and its sidebar has separate
"+ Internal wall" / "+ External wall" buttons — neither makes sense under the current
project-level split, where a whole project is either all-Internal or all-External.

The user explicitly confirmed they want the real fix: merge the two calculators into one, with
per-wall application, overriding the documented fork-not-share convention. This is a large,
multi-file change to a production app with real saved customer data, so it's staged into
independently-verified phases, each committed once green — never one big uncommitted rewrite.

## Key facts from research (evidence, not guesses)

- **`computeWall()` is already unified** (`src/estimate/computeWall.ts`) — `compute`/
  `computeExternal` are trivial wrappers around one 161-line `computeWall(inp, cfg)`, branching
  entirely on `cfg.hasZFlash`/`SystemConfig`. This is the template: per-wall dispatch just needs
  to pick `INT_CONFIG`/`EXT_CONFIG` from the wall's own field instead of a project-level choice.
- **`useWallStore` (`src/wallStore.ts`) is already fully unified** — zero isExt/system branching
  today. Only `useWallResults` (separate export) takes one `computeFn` applied to the whole
  array; that's the one place dispatch needed to become per-wall (done, Phase 2).
- **`Wall` already carried both Internal-only fields (`wallSystem`, `cornerPartnerId`,
  `shaftPartnerId`) and External-only fields (`colour`, `colourType`) simultaneously**
  (`src/estimate/wallDomain.ts`) before this work started — no new fields needed for those, just
  one new discriminator field (`application`, added Phase 1).
- **`aggregate()` (145 lines, `aggregateInternal.ts`) and `buildExtProjAgg()` (56 lines,
  `aggregateExternal.ts`) are genuinely separate implementations**, sharing only math helpers.
  Corner/Shaft kit logic (`cornerShaftKits.ts`) is explicitly Internal-only, code-enforced via
  `!cfg.hasZFlash` in `computeWall.ts` — not an artifact of the fork, a real product-scope
  boundary. External has genuinely different materials (Z-flashing) Internal doesn't.
- **Persistence precedent**: `backfillOrient()` (`wallStore.ts`) patches `w.orient ?? "vertical"`
  into raw JSON before Zod validation for exactly this kind of backward-compat need, called from
  `loadProject()` and `projectTypes.ts`'s `patchLegacyProjectRow()`. `backfillApplication()`
  (Phase 1) follows the same pattern.
- **Existing per-item branching precedent**: `PanelTypeSelector` (`wallsCard.tsx`) already
  branches per-active-wall on `wallSystem==="shaft"`; `EstimateStructureNav` already renders a
  single list mixing per-wall rows and synthesized kit rows. Both are templates for how a
  per-wall `application` branch should look in the merged UI.

## Phased plan

### Phase 1 — Data model + persistence migration — DONE (commit `fd117ba`)
- `application: "internal" | "external"` added to `Wall` (`wallDomain.ts`) and `WallSchema`
  (`wallStore.ts`).
- `backfillApplication(walls, legacySystem)` mirrors `backfillOrient()` exactly — derives each
  wall's `application` from the project's legacy `system`/`isExt` when absent. Wired into the
  same two call sites `backfillOrient()` uses (`loadProject()`, `patchLegacyProjectRow()`).
- `defaultWall()` takes an `application` param; every call site that creates a wall passes the
  right value (inherits active wall's application, Corner/Shaft creation is explicit
  `"internal"`, `seedSnapshotForSystem()` derives it from the chosen system).

### Phase 2 — Per-wall compute dispatch — DONE (commit `8f32ca5`)
- `useWallResults` (`wallStore.ts`) dispatches each wall to `compute()`/`computeExternal()` based
  on that wall's own `application`, not one fixed function for the whole array. The 4 existing
  call sites (`InternalCalculator.tsx`, `ExternalCalculator.tsx`, both `projectOrderSheetPage.tsx`
  forks) dropped their now-redundant explicit `compute`/`computeExternal` argument.
- `computeWall.ts`'s Standard/Corner/Shaft normalization and `validateWall.ts`'s corner/shaft-
  partner and special-colour checks now also gate on `wall.application` directly, not just which
  `SystemConfig` the caller passed in.

### Phase 3 — Aggregate: combine, don't flatten — DONE (commit `cad5b0d`)
Internal and External are genuinely different product catalogs (different track/flashing SKUs,
Corner/Shaft kits only make sense for Internal). Flattening both into one line-item list would
misrepresent the order. `aggregateProject(results)` (`src/estimate/aggregateProject.ts`) filters
`results` by each wall's `application`, runs the existing `aggregate()`/`buildExtProjAgg()` on
each subset unchanged, and returns `{ internal, external, combined }` where `combined` sums only
the cross-cutting top-level numbers (total area, total panels ordered, total warnings) for
project-wide KPI tiles.

Not yet wired into any UI — the existing per-fork `EstimateTopCard`/sidebar/order sheet still
call `aggregate()`/`buildExtProjAgg()` directly, which is fine today since no UI path lets a
project mix applications yet. This is the summary layer the unified calculator (Phase 4) reads
from.

### Phase 4 — Merge components — DONE (see Handoff status)

This phase turned out to be one atomic, unsplittable change, not a series of independently-
mergeable file pairs the way the tier breakdown below originally assumed — see "Handoff status"
for what actually shipped.

**Tier A — near-identical, merge directly:** `lengthExplorer.tsx` (confirmed identical logic),
`orderReviewDrawer.tsx`, `estimateStructureNav.tsx`, `projectOrderSheetPage.tsx`.

**Tier B — moderate, merge with conditional sections:** `EstimateTopCard.tsx`,
`estimateResultsCard.tsx`, `estimateSummarySidebar.tsx`, `orderContent.tsx`, `mainSections.tsx`,
`trackFlashingCards.tsx`, `phoneSections.tsx`/`phoneShell.tsx`, `projectOrderSheet.tsx` — kit
sections render only when the project has internal walls, Z-flash/colour sections only when it
has external walls (mirrors the `PanelTypeSelector`/`EstimateStructureNav` precedent above).

**Tier C — genuinely divergent, redesign carefully:** `wallsCard.tsx`/`wallConfig.tsx` turned out
to need **zero changes** (see Handoff status — Internal's copies are already a gateable superset).
`firstWallSetup.tsx` becomes the real spec §4.3 flow (Internal/External choice first, then the
rest). `InternalCalculator.tsx`/`ExternalCalculator.tsx` merge into one `Calculator.tsx`.

**Stays conditional, not merged:** `kitCards.tsx`/`kitWorkspace.tsx`/`kitWorkspacePhone.tsx`
(Internal-only, rendered when kits exist) and `panelColourSection.tsx` (External-only, rendered
per-wall when `wall.application==="external"`) move to a shared location but keep their existing
internals — no logic changes needed there.

Panel length & materials card gets its mockup-matching visual rebuild (card-based
Reduced-cutting/Cutting-optimiser strategy picker, always-visible track toggles) as a follow-up
on top of the structural merge, not blocking it.

### Phase 5 — Routing, System Selector, cleanup — MOSTLY DONE (see Handoff status)
- `App.tsx`: remove the `isExt` branch, render one `<Calculator>` always. **DONE.**
- `systemSelector/`: repurpose from "pick the project's system" to "pick the default
  application/profile for the next new wall" (or fold into the merged first-wall-setup flow —
  decide during implementation based on what reads cleanest). **Partially done** — the project-
  level Internal/External toggle (`SystemRows`'s "Wall type" row, `SystemConfigSectionPhone`'s
  matching phone segment) is removed rather than repurposed (see Handoff status for why); the real
  choice now lives in `firstWallSetup.tsx`'s new "1. Wall type" step. The `systemSelector/` route
  itself (`SystemSelector.tsx`, `/#selector`, used for creating a new *saved project* from a
  template) is untouched — still fine, since it seeds a whole new project/wall rather than editing
  an in-progress one.
- `.dependency-cruiser.js`: remove the internalCalculator/externalCalculator no-cross-import
  rule (the boundary is intentionally gone now). **DONE.**
- Delete the old `src/internalCalculator/`/`src/externalCalculator/` trees once
  `src/calculator/` (or similar) replaces them. **DONE** — both trees are gone entirely.
- Update CLAUDE.md's "Estimator UI architecture" section to describe the merged model,
  replacing the fork-not-share paragraph. **DONE.**

### Phase 6 — Full verification — typecheck/test/build/depcruise DONE; visual pass NOT DONE
`npm run typecheck && npm test && npm run build && npm run depcruise` all clean (187 tests passing,
0 depcruise errors). A headless-Chromium smoke check confirmed the app still boots and renders the
sign-in landing page with no console errors. **What's NOT done**: an authenticated visual pass
against the real running app (mixed Internal+External project end to end, Wall Setup/Panel length
cards matching the mockup) — this session didn't set up local Supabase (see "Verifying against the
real running app" below for the recipe); next session should do this pass before considering Phase
6 fully closed, especially for the phone layout and the new First-Wall Setup "Wall type" step.

## Execution discipline

Commit after each phase passes typecheck/test/build, not at the end — given the size, partial
verified progress must never be at risk of being lost or left half-broken. If a phase turns out
larger than expected mid-way, stop at the next safe, green checkpoint and report status rather
than pushing through into an unverified state.

---

## Handoff status

**Done, tested, committed, pushed to `claude/system-estimator-redesign-chhqa3`:**
- Phase 1 (data model + migration) — commit `fd117ba`
- Phase 2 (per-wall compute dispatch) — commit `8f32ca5`
- Phase 3 (combined aggregate) — commit `cad5b0d`

184 tests passing, typecheck/build/depcruise clean at every commit. All backward-compatible —
no existing saved project or user-visible behavior changed by these three phases.

**Phase 4 done, Phase 5 mostly done, Phase 6 partly done — tested, committed, pushed to
`claude/pr122-phase-4-7opvpy`:**

Picked up from the warm-up-only state (wallsCard.tsx/wallConfig.tsx/kitCards.tsx/kitWorkspace*.tsx/
panelColourSection.tsx consolidated into `src/calculator/`, described in the previous handoff below)
and completed the rest of the merge in one pass, per the "execution discipline" above's own
allowance for one atomic commit when a phase can't be safely split:

- Every remaining `internalCalculator/`/`externalCalculator/` file pair merged into
  `src/calculator/`, dispatching on `active.application`/`wall.application` at each per-wall leaf
  call site (WallsCard's `showTypes`, the product card's colour-section-vs-panel-length-stock split,
  `SpanTable`'s fixed-vs-looked-up C-track section, `EdgeRestraintSelector`'s Internal-only track-
  finish/locked-edges pieces, `WallEstimateCards`' colour-note-vs-kit-cards split) and on
  `results.some(r => r.wall.application === ...)` at each project-level leaf (which materials
  section(s) to render in `OrderContent`, whether to show a project-wide waste% stat, etc.) —
  `lengthExplorer.tsx`/`estimateStructureNav.tsx`/`phoneShell.tsx` needed no such dispatch (confirmed
  the same "already a safe superset" property wallsCard.tsx/wallConfig.tsx had).
- New `src/calculator/Calculator.tsx` replaces `InternalCalculator.tsx`/`ExternalCalculator.tsx`.
- `aggregateProject(results)` (`{ internal, external, combined }`) threaded through all six
  consumers named in the original plan, via a barrel re-export already anticipating this
  (`src/estimate/aggregate.ts` already exported `aggregateProject` alongside `aggregate`/
  `buildExtProjAgg` — a piece of forward-compatible groundwork from Phase 3 this session didn't
  know about until it got there).
- `firstWallSetup.tsx`: added "1. Wall type" (Internal/External) as the real first step (spec §4.3),
  before Orientation. Choosing External drops to External's simpler flow (no wall-system/panel-type
  steps, colour picker instead); Internal keeps the original flow including Corner/Shaft.
- `buildInternalReportData.ts`/`buildExternalReportData.ts` merged into `export/buildReportData.ts`.
  Found and fixed a real latent gap while doing this: `computeProjectReportData.ts` (the headless
  recompute the Orders/pricing feature uses, `OrderBuilderPage.tsx` → `priceEstimateReportData.ts`)
  was still dispatching a WHOLE project to `compute()` or `computeExternal()` based on the legacy
  `system` field, never adopted the per-wall `application` dispatch Phase 2 introduced three phases
  ago — harmless while no UI path could create a mixed project, but silently wrong the moment one
  could. Fixed to dispatch per wall (with `backfillApplication()` for pre-Phase-1 saves, mirroring
  `loadProject()`). Also found that `FixingsSummary`'s single `sealantLabel`/`sealantBoxes` pair
  can't represent both sides' genuinely different sealant products (Hilti CP606 vs Sikaflex 400) for
  a mixed project — added an optional `sealantLines` breakdown array (additive, doesn't change
  behavior for any pure-Internal or pure-External project) and taught
  `priceEstimateReportData.ts` to price from it when present, so a mixed project's Excel export and
  Order pricing both account for both sealants instead of silently dropping one.
- `App.tsx`: removed the `isExt` branch; renders one `<Calculator>`. The `SystemRows`/
  `SystemConfigSectionPhone` project-level "Wall type" toggle is removed (not repurposed) — with
  per-wall application, there's no whole-project system left to switch; First-Wall Setup's new step
  is the one place this choice is made. **Known gap, out of scope for this pass**: there is still no
  way to change an existing wall's application after First-Wall Setup, or to add a wall of the
  *other* application to a project that already has one (the mockup's separate "+ Internal wall"/
  "+ External wall" sidebar buttons from this plan's own Context section aren't implemented) — every
  "+ Add wall" still inherits the active wall's application, same as Phase 1 left it.
- `.dependency-cruiser.js`: removed the internal/external no-cross-import rule (kept the
  general no-circular check). `src/internalCalculator/`/`src/externalCalculator/` deleted entirely.
  CLAUDE.md's "Estimator UI architecture" section rewritten for the merged model.
- 187 tests passing (184 existing + 3 new covering the mixed-application path specifically:
  `reportData.test.ts`'s "mixes Internal and External walls" case,
  `computeProjectReportData.test.ts`'s mixed-project and backfill cases), typecheck/build/depcruise
  (0 errors) clean. A headless-Chromium check confirmed the app still boots and renders the sign-in
  landing page with no console errors — **not** an authenticated visual pass of the estimator itself
  (see Phase 6 above and "Verifying against the real running app" below).

**Not done**: the mockup's separate "+ Internal wall"/"+ External wall" creation buttons (see gap
above); the Panel length & materials card's mockup-matching visual rebuild (always noted as a
follow-up, not blocking the structural merge); an authenticated visual pass.

### What Phase 4 actually required (historical — kept for context; Phase 4 is now done, see above)

Two files need **zero changes** — confirmed by full diff, not just line-count comparison:
- `internalCalculator/wallsCard.tsx` is already a superset of `externalCalculator/wallsCard.tsx`,
  parameterized via `showTypes`/`orient`/`onCornerLink`/`onShaftLink` props that already gate every
  Internal-only control (WallSystemSelector, CornerLinkSelector, ShaftLinkSelector,
  PanelTypeSelector) off when unused — exactly what External's own trimmed copy does today by
  calling it with `showTypes=false`.
- `internalCalculator/wallConfig.tsx` is already a superset of `externalCalculator/wallConfig.tsx`
  the same way (`TrackFinishBlock`/`OtherOptionsBlock`/`SpanTable`'s Standard/Corner/Shaft branches
  are simply never invoked by a caller that doesn't pass those props/values).

So for those two: delete the `externalCalculator/` copies, done. **The real remaining work is the
Calculator shell and everything downstream of its aggregate.**

`InternalCalculator.tsx`'s `projChosenAgg` (today: `aggregate(results)`, an Internal-only shape)
flows into **six** consumers in the same render tree:
`EstimateSummarySidebar`, `EstimateResultsCard`, `ProjectOrderSheet`, `OrderReviewDrawer`,
`phoneSections.tsx`'s several Phone components, and `buildInternalReportData` (Excel export).
Merging in External's needs means switching to `aggregateProject(results)` (already built, Phase
3) and updating all six consumers to read `{ internal, external, combined }` instead of one flat
shape — rendering an Internal materials section and an External materials section side by side,
each only when that side has walls. **This can't be split into smaller independently-verified
commits**: the fork-not-share dependency-cruiser rule (`.dependency-cruiser.js`) forbids any
halfway state where some files reference the old shape and others the new one, and once you start
threading the new aggregate shape through, every one of those six consumers needs it
simultaneously for the app to even typecheck.

### Recommended execution order for Phase 4 (historical — this is what was actually followed)

1. ~~Delete `externalCalculator/wallsCard.tsx` and `externalCalculator/wallConfig.tsx`~~ **DONE**
   this session — see Handoff status above (also moved `kitCards.tsx`/`kitWorkspace.tsx`/
   `kitWorkspacePhone.tsx`/`panelColourSection.tsx`, all into the new `src/calculator/`). Turned out
   `.dependency-cruiser.js` needed no relaxation — its rule was already scoped to direct
   internal↔external imports only, not a shared-sibling-folder restriction.
2. Write the new unified `Calculator.tsx` (working name) by extending `InternalCalculator.tsx`,
   in `src/calculator/`:
   swap `aggregate(results)` for `aggregateProject(results)`, gate kit logic
   (`synthesizeKits`/`computeCornerPair`/`computeShaftPair`/`KitWorkspace`) to only run over
   `results.filter(r => r.wall.application === "internal")`, and add External's colour section
   (`externalCalculator/panelColourSection.tsx`, already `application==="external"`-appropriate)
   into the Wall Setup card area for external walls.
3. Update the six consumers (`EstimateSummarySidebar`, `EstimateResultsCard`, `ProjectOrderSheet`,
   `OrderReviewDrawer`, `phoneSections.tsx`, `buildInternalReportData.ts`) to accept
   `{ internal, external, combined }` and render two material sections instead of one where
   relevant — External's own current versions of these files show exactly what the External
   section should look like content-wise.
4. `firstWallSetup.tsx`: add the Internal/External choice as the actual first step (spec §4.3),
   before orientation/system/panel/profile.
5. `App.tsx`: remove the `isExt` branch, render one `<Calculator>`.
6. `.dependency-cruiser.js`: remove the internalCalculator/externalCalculator no-cross-import rule.
7. Delete `src/externalCalculator/` entirely.
8. Update CLAUDE.md's "Estimator UI architecture" section (currently documents fork-not-share as
   deliberate — needs to describe the merged model instead).
9. Full verification: `npm run typecheck && npm test && npm run build && npm run depcruise`, then
   a fresh visual pass. See "Verifying against the real running app" below for how to actually
   see the authenticated app in a sandboxed session.

### Verifying against the real running app in a sandboxed session

Self-serve signup doesn't exist in this app (contact-your-rep only), and `*.supabase.co` is
blocked from a browser context in at least some sandboxes — but a locally-run Supabase is not.
What worked this session:
1. Start `dockerd` manually if needed, then
   `npx supabase start -x edge-runtime -x vector -x imgproxy` (excluding `edge-runtime` avoids a
   `setrlimit`/nested-container permission failure seen in this sandbox; those services aren't
   needed to view the estimator UI).
2. Apply schema by hand: `psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/schema.sql`
   (the local `supabase db reset` path chokes on this repo's schema.sql assuming an admin profile
   already exists — apply schema, then manually insert the missing default `price_lists` row it
   expects, then run seed).
3. Seed with a self-chosen password: `sed "s/:'seed_password'/'<password>'/" supabase/seed.sql`
   run through `psql` (the `\set ... printf` mechanism the file uses doesn't substitute correctly
   inside a `DO $$` block via this psql version).
4. Grant table privileges manually — a raw `psql` schema apply doesn't run Supabase's own
   default-privilege setup: `grant all on all tables in schema public to anon, authenticated,
   service_role;` (plus sequences/functions) after seeding.
5. Point the dev server at it via `.env` (`VITE_SUPABASE_URL=http://127.0.0.1:54321`,
   `VITE_SUPABASE_PUBLISHABLE_KEY=<the demo anon key printed by `supabase start`>`), sign in as
   one of the seeded `@e2e.test` personas with the password chosen in step 3.
6. Clean up afterward: revert `supabase/config.toml` if you toggled `db.seed.enabled`, delete the
   `.env` you created, `npx supabase stop`.

### Known good reference material while doing this
- `speedpanel-estimator-web-v5.html`/`-ipad-v5.html`/`-phone-v5.html` (design package, not stored
  in this repo — was supplied as an upload in the session that started this work) for what the
  merged Wall Setup / Panel length cards should look like.
- `externalCalculator/*.tsx` (before deletion) is the reference for exactly what External-specific
  content each of the six consumers needs to render.
