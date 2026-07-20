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

### Phase 4 — Merge components — NOT STARTED

See "Handoff status" below — this phase turned out to be one atomic, unsplittable change, not a
series of independently-mergeable file pairs the way the tier breakdown below originally assumed.

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

### Phase 5 — Routing, System Selector, cleanup — NOT STARTED
- `App.tsx`: remove the `isExt` branch, render one `<Calculator>` always.
- `systemSelector/`: repurpose from "pick the project's system" to "pick the default
  application/profile for the next new wall" (or fold into the merged first-wall-setup flow —
  decide during implementation based on what reads cleanest).
- `.dependency-cruiser.js`: remove the internalCalculator/externalCalculator no-cross-import
  rule (the boundary is intentionally gone now).
- Delete the old `src/internalCalculator/`/`src/externalCalculator/` trees once
  `src/calculator/` (or similar) replaces them.
- Update CLAUDE.md's "Estimator UI architecture" section to describe the merged model,
  replacing the fork-not-share paragraph.

### Phase 6 — Full verification — NOT STARTED
`npm run typecheck && npm test && npm run build && npm run depcruise`, then a fresh visual pass
confirming: mixed Internal+External project works end to end, the Wall Setup and Panel length
cards match the mockup, and nothing in the existing test suite regressed in meaning (not just
passing — re-read any test whose expected values changed).

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

**Phase 4 in progress — warm-up file consolidation done, tested, committed, pushed to
`claude/pr122-phase-4-7opvpy`:**
- Created `src/calculator/` (new shared location, outside both fork trees).
- Moved `wallsCard.tsx` and `wallConfig.tsx` there from `internalCalculator/` (confirmed superset,
  zero logic changes — see "What Phase 4 actually requires" below) and deleted the
  `externalCalculator/` copies, updating every import site (`InternalCalculator.tsx`,
  `ExternalCalculator.tsx`, `firstWallSetup.tsx`, `lengthExplorer.tsx`, `phoneSections.tsx` in both
  trees, `estimateResultsCard.tsx`, `mainSections.tsx`, `export/buildInternalReportData.ts`) to the
  new path.
- Also moved `kitCards.tsx`/`kitWorkspace.tsx`/`kitWorkspacePhone.tsx` (Internal-only) and
  `panelColourSection.tsx` (External-only) into `src/calculator/` unchanged internally — these were
  already scoped by the plan as "stays conditional, not merged... move to a shared location but keep
  their existing internals", and moving them doesn't depend on the six-consumer aggregate-shape work
  below, so it was safe to do in the same warm-up pass.
- One real fix needed along the way: `ExternalCalculator.tsx`'s `EdgeRestraintSelector` call was
  missing the now-required `orient` prop (External's old trimmed `wallConfig.tsx` didn't require it;
  Internal's superset does, for its `TrackFinishBlock`/`SpanTable` branches) — added
  `orient={orient}`, an existing in-scope value, no behavior change for External (those branches
  still don't render for it).
- `.dependency-cruiser.js` needed **no change** — its rule only forbids direct
  `internalCalculator/`↔`externalCalculator/` imports; both importing from the new sibling
  `src/calculator/` was already unaffected. `npm run depcruise` stays 0 errors (36 pre-existing-
  pattern `no-circular` warnings, up from 28 — same root cause as before, `calculator/wallsCard.tsx`
  importing the `WallSystemId` type from `App.tsx` while `App.tsx` imports the calculator
  components; now hit via both the Internal and External import paths instead of just Internal's,
  not a new category of problem. Confirmed via `git stash` that the pre-existing tree was also
  warnings-only, exit 0).
- 184 tests passing, typecheck/build/depcruise clean.

**Still not started: the six-consumer aggregate-shape merge (the real bulk of Phase 4), Phase 5
(routing/cleanup), Phase 6 (final verification).** See "What Phase 4 actually requires" and the
(renumbered) "Recommended execution order" below — this session completed old step 1 only.

### What Phase 4 actually requires (learned this session, more precise than the tier plan above)

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

### Recommended execution order for Phase 4, remaining steps

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
