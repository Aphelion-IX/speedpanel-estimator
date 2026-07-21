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
on top of the structural merge, not blocking it. **DONE** — see Handoff status.

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

### Phase 6 — Full verification — DONE
`npm run typecheck && npm test && npm run build && npm run depcruise` all clean (187 tests passing,
0 depcruise errors). Followed "Verifying against the real running app" below (with one addition —
see there) to sign in against a local Supabase instance and drive the live app with Playwright:

- **First-Wall Setup**: confirmed the new "1. Wall type" (Internal/External) step renders, the step
  numbers around it shift correctly (Internal shows "2. Orientation"/"3. Panel type"; External shows
  "2. Orientation" then the colour picker, no numbered Panel type step), and choosing each side
  produces the expected wall.
- **Internal wall, web**: Wall setup shows the Panel type selector; Wall geometry/Panel length &
  materials cards render normally; Project Order Sheet's material section is correctly labeled
  "PANELS (INTERNAL)" / "FIXING AND SEALANT -- INTERNAL"; footer reads "Locked system data".
- **External wall, web**: confirmed the exact regression this session's own code review caught before
  ever running the app — Wall geometry's span table shows the generic width/height-driven lookup
  ("SPAN TABLE - P78"), not Internal Standard's fixed single-row section, i.e. `SpanTable`'s
  `wallSystem` really is only passed for Internal walls. Also confirmed: Wall setup has no Panel
  type/Wall system controls (`showTypes` dispatch correct), the product card reads "Panel colour &
  materials" with an "Off White" pill and the colour swatch grid, no "Advanced track selection"
  block, entering 3m×3m dimensions computes real quantities, and the Order Sheet's material section
  reads "PANELS (EXTERNAL)" / "FIXING AND SEALANT -- EXTERNAL" with correct C-track/J-track/
  Z-flashing/head-flashing line items; footer reads "Locked external system data".
- **Phone layout, Internal wall**: `SystemConfigSectionPhone` shows Panel orientation/Panel type with
  no "Wall type" segment (confirming the toggle removal from phoneSections.tsx), the wall pill strip,
  geometry/panel-length/tracks-with-"Advanced track selection" sections, and the same
  "PANELS (INTERNAL)"/"FIXING AND SEALANT -- INTERNAL" Order Sheet cards as web.
- No console/page errors in any of the above.
- **Not exercised**: a genuinely mixed Internal+External project — expected and consistent with the
  documented gap above (no UI path yet creates one), so there was nothing to click through; the mixed
  path is instead covered at the unit level by `reportData.test.ts`'s and
  `computeProjectReportData.test.ts`'s new mixed-application tests (Phase 4 commit).

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

**Phase 4 done, Phase 5 mostly done, Phase 6 done — tested, committed, pushed to
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
  (0 errors) clean. Followed up with an authenticated visual pass against a local Supabase instance
  (signed in, drove First-Wall Setup, an Internal wall, an External wall, and the phone layout with
  Playwright) — see Phase 6 above for exactly what was checked. No console/page errors in any of it.

**Not done at this point in history**: the mockup's separate "+ Internal wall"/"+ External wall"
creation buttons (see gap above) — since implemented, see the "Full mockup-parity audit" entry
further down this Handoff status section.

**Panel length & materials card's mockup-matching visual rebuild — DONE** (follow-up session, once
the actual mockup files were supplied — they aren't stored in this repo, see the header note on
this doc). Rebuilt against the real `speedpanel-estimator-web-v5.html`/`-phone-v5.html` markup
rather than guessing:
- `lengthExplorer.tsx`'s accordion-dropdown (`LengthExplorer`, one candidate stock length at a
  time) is replaced by the mockup's `.strategy`/`.strategy-card` two-card picker -- "Reduced
  cutting" and "Cutting optimiser" are **not new business logic**, just the two modes that already
  existed relabeled: "Cutting optimiser" is the old "Automatic" option (`packPanels(pieces, null,
  ...)`, packs across whichever stock length(s) minimise waste); "Reduced cutting" is the old
  "pick one explicit stock length" mode, now defaulted to the smallest stock where
  `buildOption()`'s own `cut` flag is false (every piece gets its own full-length panel, no
  splitting) -- confirmed live that stock options needing a cut are correctly distinguishable from
  ones that don't in the picker (`" -- no cuts"` suffix). A `.custom-row` select+Apply lets you
  pick a *different* stock length within "Reduced cutting" once active. The always-visible
  CustomLengthSection (its own real validation/max-length/project-lock interaction) stays a
  separate section below rather than folding into that select the way the mockup's static markup
  shows it -- a deliberate divergence to avoid encoding "which length is active" two different
  ways at once (documented inline in the file).
- `wallConfig.tsx`'s `EdgeRestraintSelector`: `RestrainedEdgesBlock` now uses the mockup's
  `.edge-grid`/`.edge` classes instead of hand-rolled Tailwind buttons; `TrackFinishBlock` drops
  the "Advanced track selection" accordion entirely and always renders the mockup's `.finish-grid`
  (plain `<select>` C-track/J-track pickers, replacing the old toggle-switch `TrackSwitch`);
  `HeadFlashingToggle` is now a `.check-row` checkbox instead of a toggle switch. `CornerAnglesBlock`
  is untouched (not part of this mockup at all -- absent, not contradicted, from the captured
  markup, so left as-is).
- All of the CSS classes used above (`.strategy`, `.strategy-card`, `.check-row`, `.custom-row`,
  `.edge-grid`, `.edge`, `.finish-grid`) already existed in `ui/estimatorTheme.css`, ported ahead of
  this rebuild by an earlier session but never actually consumed by any component until now --
  confirmed via grep before writing a line of new CSS.
- `Calculator.tsx`'s now-dead `showTrackFinish` state (and the matching now-removed
  `showTrackFinish`/`setShowTrackFinish` props on `EdgeRestraintSelector`/`TrackFinishBlock`) is
  gone; `phoneSections.tsx`'s `TracksFlashingSectionPhone` (which also called `TrackFinishBlock`)
  updated to match the new always-visible-only signature -- phone's own mockup
  (`speedpanel-estimator-phone-v5.html`) actually omits the track-finish picker from its Tracks &
  flashing section entirely, but removing a real, working feature from phone wasn't part of what
  was asked, so it stays there, just no longer collapsible (a forced, minimal consequence of
  `TrackFinishBlock` itself no longer supporting an accordion mode, not a deliberate scope
  expansion).
- Verified live (typecheck/test/build/depcruise all clean throughout, 0 new test failures): entered
  real dimensions, confirmed the "Reduced cutting"/"Cutting optimiser" cards show live computed
  values (not placeholders), switched between them, picked a non-default stock length from the
  select and clicked Apply (confirmed the strategy card's own value updated and downstream panel
  counts/materials recomputed correctly), toggled the project-lock checkbox and a C/J track finish
  select (both took effect with no console errors), and confirmed the same rebuild renders
  correctly on the phone layout (which reuses `PanelLengthSection` directly).

**Full mockup-parity audit (add/remove UI to match the mockup exactly) — DONE** (follow-up
session, "use the mockups as a single source of truth" pass). This directly reversed part of the
"Known gap, out of scope for this pass" note above — the mockup's own markup makes clear the
per-wall Wall-type toggle and separate add-wall buttons were always intended, not new scope:

- **Reinstated the per-wall "Wall type" toggle**, gone since Phase 5's project-level `SystemRows`
  removal. This is *not* the old project-level system switch coming back — it's `wallsCard.tsx`'s
  new `WallTypeSelector`, which flips a single wall's own `application` field (`wall.application`,
  Phase 1) via `update({ application })`, exactly the same choke point every other per-wall field
  change already goes through. `validateWall.ts`'s `wouldLoseData()` extended so switching a
  Corner/Shaft-linked wall's application to External is gated by the same confirm-dialog flow as
  switching its orientation or wall system away from corner/shaft (both are equally link-breaking).
- **Added the mockup's own "+ Internal wall"/"+ External wall" structure-nav buttons**
  (`estimateStructureNav.tsx`), replacing the single generic "+ Add wall" footer button. New
  `wallStore.ts` action `addWallWithApplication(application)` (kept separate from `addBlankWall`,
  not an optional param on it, for the same "never take an argument a MouseEvent could be mistaken
  for" reason `addBlankWall`'s own header comment gives). This closes the other half of the
  "Known gap" above — a project can now genuinely mix applications from the structure nav, not just
  via First-Wall Setup.
- **Restructured `WallsCard`'s body to match the mockup's actual 3-column `config-row` grid**
  (`speedpanel-estimator-web-v5.html`'s `.config-row{grid-template-columns:1fr 1fr 1.25fr}`,
  confirmed identical in the iPad mockup). Two real, previously-undetected mismatches fixed here,
  not just the toggle/buttons above:
  - Row 1 (Wall name / Wall type / Orientation) was three separate pieces before this pass: Wall
    name got its own single-column row, Wall type shared a row with an opaque `systemSelector`
    render-prop, and that render-prop was `App.tsx`'s standalone `SystemRows` component — a
    completely differently-styled hand-rolled Tailwind button grid, not the shared mockup `.seg`
    control every other segmented toggle on the card uses. All three now share one `.config-row`
    (the CSS default is already the mockup's exact 3-column grid, so no inline override is needed
    here), and Orientation is a new inline `OrientationSelector` in `wallsCard.tsx` using the same
    `.label`/`.seg` markup as `WallTypeSelector`, wired straight to the `switchOrient` prop
    Calculator already threads through for phone. `SystemRows`/`systemRows.tsx` deleted entirely
    (dead after this — it had exactly one call site) along with the `systemSelector` render-prop on
    `Calculator`/`WallsCard`.
  - External wall setup had a **duplicate P78 badge**: a static blue "External panel: P78"
    placeholder block (added in the earlier Panel-length-rebuild pass, guessing at the mockup's
    static `<div class="seg"><button class="active">P78</button></div>`) stacked directly on top of
    `PanelColourSection`'s own pre-existing dynamic badge (colour-tinted, reads "P78 - Off White"
    etc.). Removed the static duplicate; `PanelColourSection` already renders the equivalent badge
    plus the colour swatch grid.
  - Row 2 (Panel / Wall system, internal-only) now pairs `PanelTypeSelector` and
    `WallSystemSelector` on one `.config-row` when the wall is horizontal (matching the mockup's
    grouping), single-column when vertical (`WallSystemSelector` doesn't apply to vertical walls —
    Corner/Shaft are horizontal-only per `estimate_free_corner_wall.md`/`estimate_shaft_wall.md`,
    a real domain rule the mockup's static demo doesn't encode, so this orientation gate is kept
    even though the mockup always shows the row).
  - **Deliberately not changed**: `CornerLinkSelector`/`ShaftLinkSelector`/`JunctionLinkSelector`
    stay their own rich blocks below the config-row grid (with the Corner side-selector,
    orientation-aware labels, and contextual notes), rather than collapsing into the mockup's
    single static "Adjoining wall" `<select>` — same reasoning as keeping `PanelColourSection`'s
    swatch grid over a plain "Panel colour" `<select>`: real functionality over static-prototype
    simplification. Both are noted inline in `wallsCard.tsx`.
- Audited the remaining mockup files (`speedpanel-estimator-ipad-v5.html`,
  `speedpanel-estimator-ipad-states-v5.html`, `-web-states-v5.html`, `-phone-states-v5.html`,
  `speedpanel-project-order-sheet-v5.html`, `index-v5.html`). Findings:
  - `speedpanel-estimator-ipad-v5.html` uses the identical `.config-row`/`.seg`/`.strategy`/etc.
    CSS as the web mockup at a different viewport, not a distinct component set — nothing
    iPad-specific to build; the app's existing responsive breakpoints already cover it.
  - The three `-states-v5.html` files and `index-v5.html` are a separate design-QA artifact (own
    "Estimator state prototype" nav, explicitly linking back to the real
    `speedpanel-estimator-web-v5.html` as "Active estimator") documenting *behavior* contracts
    (empty states, save-conflict states, validation banners, error/access states) for design
    review, not literal screens to add to the real app's routing — confirmed by its own markup
    (`<span class="pill blue">Estimator state prototype</span>` vs. the active-estimator page's
    `<span class="pill cyan">Active estimator</span>`). Not treated as a UI source of truth for
    this pass; the corresponding real behaviors (wall status pills, save states, read-only
    guard) already exist in the actual app in dynamic form.
  - `speedpanel-project-order-sheet-v5.html`'s standalone "clean order sheet" already has a
    matching implementation (`projectOrderSheet.tsx` + `projectOrderSheetPage.tsx`, the
    `#/estimator/order-sheet` route) from an earlier phase — confirmed present, not re-audited
    line-by-line this pass.
- Verified live against a local Supabase instance (Playwright, signed in): Wall setup card in
  Internal/vertical, External, and Internal/horizontal+Corner states all screenshot-confirmed to
  render the new row layout correctly with no console/page errors at any step.
- 187 tests passing, typecheck/build clean.

**Phone-layout screenshot audit (web/iPad/phone against the mockups) — DONE** (follow-up session).
Screenshotted the live app at web (1440px), iPad (820px) and phone (390px) viewports in Internal
and External states and compared each against `speedpanel-estimator-web-v5.html`/`-ipad-v5.html`/
`-phone-v5.html` section by section. Web and iPad already matched (iPad just being web's own
responsive breakpoints at a narrower width, confirmed again). Phone had two real, confirmed
gaps, both in `phoneSections.tsx`/`Calculator.tsx`:
- **Card grouping**: `SheetCardPhone`/`SheetSectionPhone`'s own header comment already described
  the intended pattern — "one continuous card with flush, divider-separated sections inside it,
  matching the mockup's single `.sheet`" — but no call site actually used it that way.
  `PanelLengthSectionPhone` and `TracksFlashingSectionPhone` each wrapped themselves in their own
  separate `SheetCardPhone`, and the project Warnings block got a third, so the mockup's one
  `.sheet` (Panel length + Tracks & flashing + Warnings as three divider-separated
  `.sheet-section`s) rendered as three separate floating cards instead. Fixed by having both
  components return a bare `SheetSectionPhone` (no own card) and wrapping all three inside one
  shared `SheetCardPhone` at the `Calculator.tsx` call site — `SystemConfigSectionPhone`/
  `GeometrySectionPhone` stay in their own separate cards, matching the mockup's own two separate
  `.sheet` sections ahead of this combined one.
- **Missing header badges**: every mockup `.sheet-hd` has a small status pill on the right
  (`Wall 01`, a profile name, `Project locked`, an edge count, a warning count) — `SheetSectionPhone`
  had no slot for one at all. Added an optional `badge` prop, wired to: the active wall's name
  (System configuration), the selected profile label (Wall geometry, reusing the same label map its
  own `SegPhone` options use), `Project locked`/`Project unlocked` (Panel length — shortened from an
  initial "Project stock enabled/disabled" copy-paste of the web product-card's own badge text,
  which was long enough next to the equally long "Panel length & optimisation" heading to force an
  awkward 3-line wrap on a 390px viewport; also renamed that heading to the mockup's own plain
  "Panel length", which was more accurate anyway and helped the wrap), a restrained-edge count
  (Tracks, flashing & restraint), and the project warning count (Warnings, red when >0).
- Re-verified with typecheck/test/build/depcruise (all clean, 187 tests) and a fresh Playwright
  pass at all three viewports (Internal and External states) confirming the merged card and every
  badge render correctly with no console/page errors.
- Also noted, but explicitly out of scope for this pass: the site's real `TopNav` (Home/Orders/
  Projects/System Selector/Project Estimator/Education Hub) overflows unusably at iPad width
  (~820px) — items get clipped mid-word with no overflow menu. This isn't a mockup-parity issue
  (the mockup's own topbar is decorative placeholder chrome with a different, shorter item set,
  never meant to be copied verbatim onto the real multi-page site nav) and sits well outside
  `src/calculator/`, so it wasn't touched here — flagged for a separate pass if wanted.

**Follow-up fixes: TopNav overflow, estimator workspace overflow, phone header crowding, dark
mode — DONE** (two more follow-up sessions, outside `src/calculator/` — noted here anyway since
this doc is this branch's running log). The user asked for the flagged TopNav bug to be fixed,
then for two more bugs it surfaced along the way, then for a full dark-mode pass:
- **`appShell/topNav.tsx` overflow**: the first fix attempt (bump the fixed Tailwind breakpoint
  from `md` 768px to `lg` 1024px) just relocated the same clipping bug instead of fixing it —
  measuring the real rendered content showed the six tab labels plus the right-hand icon/avatar
  cluster don't actually fit until nearly full desktop width (as late as ~1360px). Replaced the
  fixed breakpoint with `useNavFit`: an always-mounted, unconstrained measuring twin of the tab
  row (kept out of the page's paint/scroll area via a 0×0 `overflow-hidden` wrapper, itself using
  `inline-flex` rather than `flex` after a first attempt silently measured `offsetWidth: 0` --
  `display:flex`'s `width:auto` fills a 0px-wide container instead of sizing to content) compared
  against the real row's allocated width via `ResizeObserver`, so the hamburger menu appears
  exactly when the tabs would actually overflow, at any width. Verified with a live width sweep,
  360px-1920px: zero clipping, zero page overflow everywhere.
- **`ui/estimatorTheme.css` `.workspace` overflow at ~1280px**: the 3-column grid's middle column
  has a `minmax(640px, 1fr)` floor (itself correctly sized to `.geometry-body`'s own two
  `minmax(280px,...)` sub-columns, not an arbitrary number) requiring 1278px of *workspace* width
  before the 2-column collapse breakpoint should kick in, but that breakpoint was set to 1180px —
  146px short once the page's own outer padding (48px) is added on top, so viewports in the
  1181-1326px range rendered 3 columns without enough room, pushing the `.summary` sidebar's right
  edge past the viewport. Fixed by correcting the breakpoint to 1340px (the real minimum, with a
  small buffer) rather than shrinking the column floor (which would have just overflowed
  `.geometry-body` internally instead). Verified with a live sweep, 901-1600px: zero overflow
  anywhere, including a probe of the previously-untested 900-1180px 2-column zone.
- **Phone-width (`appShell/topNav.tsx`/`AuthStatus.tsx`) icon-row crowding**: confirmed
  pre-existing (identical before/after the TopNav fix above, via `git stash`) — the wordmark and
  the five-element icon/avatar cluster are both `shrink-0`, and their combined natural width
  didn't fit a 390px header once the header's own padding was accounted for (a mistake in the
  first sizing pass here too — see `IconButton`'s new `size="header"` variant, `topNav.tsx`'s
  tightened gaps/wordmark size, and `AuthStatus.tsx`'s tightened avatar/padding). Verified with a
  live width sweep measuring the actual gap between the two groups (not just page `scrollWidth`,
  which had masked overlap at 320-360px in an earlier pass): clean from 360px up, which covers
  effectively every real device in use.
- **Dark mode audit**: `estimatorTheme.css` already had a `.est-shell.dark` override block for
  every CSS variable it defines except two -- `.pill.green`/`.pill.orange` (the wall-status
  "Ready"/"Warning" pills) used hardcoded hex/rgba literals instead of `var(--...)`, so they never
  changed the same relative way (`--green`/`--orange` were missing entirely from both the light and
  dark variable blocks); fixed by giving them their own light/dark pair, following the exact pattern
  `.pill.red`/`.pill.cyan` already used. Everything else in the estimator (a heavier grep sweep for
  any other bare hex/rgba not going through a var()) was already dark-aware. The bigger finding was
  outside the estimator entirely: `projectsTheme.css`/`ordersTheme.css`/`projectsAdminTheme.css`
  (Projects, Orders, and Admin → Projects Administration) had **no dark-mode overrides at all** --
  hardcoded `#fff` card backgrounds and light-only borders/text throughout, rendering as
  white-cards-on-black once dark mode was toggled (confirmed live). `projectsAdminTheme.css` was
  worse than just missing: it unconditionally shadows the site-wide `--navy`/`--blue` variable
  names (`index.css`'s own `.dark` class already has real dark values for those two), so nesting
  ANY shared Tailwind component inside `.pa-shell` was actively overriding those back to
  light-mode values even when dark mode was otherwise active. Fixed all three the same way as
  `estimatorTheme.css` already does it: added a `surface`/`surface-soft`/`line-soft`/tinted-border
  token for whatever was still a bare hex literal, then a `.<prefix>-shell.dark, :root.dark
  .<prefix>-shell { ... }` block giving every token (existing and new) a dark equivalent in the
  same relative-lightness relationship `estimatorTheme.css`'s own shift already established.
  Verified live: Projects/Orders/Admin→Projects Administration all fully dark-themed now, light
  mode screenshotted before/after and confirmed pixel-identical (only additive variable/dark-block
  changes, no light-mode value was touched).
- Full verification suite (typecheck/test/build/depcruise) clean after each of the four fixes
  above, 187 tests passing throughout.

**Follow-up refactor: shared theme tokens across the three ordering-suite CSS files — DONE.**
The dark-mode fix above added near-identical `.dark` override blocks to `projectsTheme.css`,
`ordersTheme.css`, and `projectsAdminTheme.css` (all three ported from the same mockup source,
per each file's own header comment) — duplication the user asked to be refactored away. Pulled
every token with a byte-identical value (light AND dark) across all three into a new
`ui/scopedThemeTokens.css`, a `:root`/`.dark`-scoped `--sp-*` set consumed via
`@import "...scopedThemeTokens.css";` and aliased (e.g. `--pj-muted: var(--sp-muted);`) from each
file's own class-scoped block, with each file's `.dark` override trimmed to only the tokens that
still need a page-specific dark value. Any token differing by even one hex digit between files
(accent blues/greens/cyans and their tints, `--pj-warm`/`--ord-warm`, `projectsAdminTheme.css`'s
own `--blue`/`--navy` which deliberately match `index.css`'s site-wide dark values instead of this
shared set's) was deliberately left local — unifying an existing discrepancy is a palette
decision, not a refactor, even where two values look close enough to be a typo (see
`scopedThemeTokens.css`'s own header comment). `projectsAdminTheme.css` needed `../../../ui/...`
rather than `../../ui/...` for the import (one directory deeper than the other two under
`pages/admin/projects/`) — caught by `npm run build` failing on an unresolved `@import` before the
path was corrected; Vite/PostCSS resolves relative `@import` paths in plain (non-Tailwind-`@apply`)
CSS with no extra config needed. Verified live: read every resolved CSS custom property off
`.pj-shell`/`.ord-shell`/`.pa-shell` in both light and dark before and after the refactor —
byte-identical in every case, confirming the refactor is a pure structural no-op with zero visible
change. Full verification suite (typecheck/test/build/depcruise) clean, 187 tests passing.

**Follow-up bug fix: estimator `.workspace` 2-column tier leaving a dead gap at iPad-landscape
widths — DONE.** User report: "the iPad view system estimator is not rendering correctly and
there are gaps in the overall structure." The 900–1340px breakpoint tier (`.workspace`'s
`grid-template-columns: 240px 1fr`, added long before this branch, in the original mockup port
`f0351ff` — not something any fix in this branch introduced) covers real iPad-landscape widths
(1024–1194px) and iPad Pro 12.9" portrait (1024px), a range no prior mockup-parity audit actually
exercised — the "iPad" viewport those audits screenshotted was 820px portrait, which sits inside
the single-column tier below 900px, so this tier's own bug went unnoticed. The CSS only gave
`.summary` an explicit `grid-column: 2` override, leaving `.structure` and `.main-column`
un-positioned; CSS Grid's row-auto-placement (row-major, DOM order) packed `.structure` into row
1/col 1 and `.main-column` into row 1/col 2 first, which then forced `.summary` into row 2/col 2 —
leaving row 2/col 1 completely empty and capping `.structure`'s sticky containing block at the
bottom of row 1. Confirmed live at 1024×1400: `.structure`'s box ended at document y=1237 while
the workspace continued to y=2773 — an ~1536px dead zone in the left column, during which the
sticky structure nav had already detached and stopped tracking the scroll (it doesn't resume once
past its own grid cell), reading as the structure sidebar "disappearing" mid-scroll while a large
blank gap sits in its place. Fixed with explicit `grid-template-areas` (`"structure main"
"structure summary"`) so `.structure`'s single named cell spans both rows instead of being left to
accidental auto-placement — this is what the row-auto-placement was presumably trying (and failing)
to achieve, given the sidebar's `position: sticky` styling only makes sense meant to track the full
column height. Also gave the single-column (<900px) tier the equivalent `"structure" "main"
"summary"` areas instead of leaving `.summary` on a bare `grid-column: 1` override, for the same
robustness reason, though that tier had no observable bug (a true 1-column grid has nowhere for
auto-placement to go wrong). Verified live: a width sweep at 700/899/900/901/1024/1080/1200/1340/
1341/1600/1920px confirms the exact breakpoint boundaries switch cleanly with zero horizontal
overflow at any width; scroll-position sampling at 1024px confirms `.structure` now stays visible
(sticky, pinned near the top of the viewport) well past the old dead-zone boundary instead of
detaching; light and dark mode both screenshotted at 1024px and correctly themed. Full verification
suite (typecheck/test/build/depcruise) clean, 187 tests passing.

**Follow-up bug fix: Wall geometry card's Profile/Dimensions split showing the same dead-gap
pattern — DONE.** User screenshot report right after the fix above: the "Wall geometry" card's
Profile row (label + Standard/Raked/Gable icons) rendered across the full card width at the top,
then Dimensions/Width/Height/Preview/Span table were all squeezed into roughly the left half only,
with a large blank gap on the right for the rest of the card. Root cause was the same class of CSS
Grid auto-placement bug as the iPad fix above, just in a different component: `Calculator.tsx`'s
`geometryContent` renders straight into `.geometry-body`'s 2-column grid (`ui/estimatorTheme.css`)
expecting exactly two top-level children -- one per column -- but `wallConfig.tsx`'s
`ProfileSection` returns a bare fragment (its own "Profile" label div and `<ProfileSelector>` as
two separate un-wrapped nodes, no container). Auto-placement split those two nodes across row 1's
two columns on its own, then packed the second real child (the `border-t` div holding
Dimensions/preview/span table) into row 2 col 1 alone, leaving row 2 col 2 empty --
`firstWallSetup.tsx`'s own `<ProfileSection>` call already wraps it in a `<div>` for exactly this
reason, `Calculator.tsx`'s didn't. Fixed by wrapping the `<ProfileSection>` call in `geometryContent`
in a `<div>` too, so `.geometry-body` gets exactly two grid items again (Profile | Dimensions).
Audited the other CSS-grid content slots in `Calculator.tsx` (`.product-body`'s `stock-col`/
`materials-col`, `.config-row`'s `WallTypeSelector`/`OrientationSelector`/`WallSystemSelector`) for
the same bare-fragment-into-grid pattern -- all already wrap their content in a single container,
so this was an isolated instance. Verified live: `.geometry-body` now has exactly two grid
children, correctly split ~46/54 into Profile | Dimensions+Preview+Span-table, both full card
height, in both light and dark mode. Full verification suite (typecheck/test/build/depcruise)
clean, 187 tests passing.

**Follow-up layout request: Preview moved into its own full-height right column — DONE.** User
request right after the fix above: "Preview should be full right side with dimensions and the
other info on the left hand." Restructured `geometryContent`'s two `.geometry-body` grid children
from [Profile | Dimensions+Preview+Span-table] to [Profile+Dimensions+Span-table | Preview] --
`WallPreviewSection` (`ui/wallPreview.tsx`) moved out of the `border-t` div and out to be its own
second top-level child of the fragment, taking the whole right column at the grid row's full
height (matching the left column, since CSS Grid's `align-items: start` default still lets each
column size to its own content, but `.geometry-body` has no `align-items` override so both stretch
to the row's height by default). `WallPreviewSection` already returns a single wrapping `<div>` (no
bare-fragment risk the same way `ProfileSection` was -- see the fix above), so no extra wrapper
needed there; `ProfileSection`'s own wrapper div now also holds the `border-t` Dimensions/Span-table
block alongside it, still a single grid item. Phone's own `GeometrySectionPhone`
(`phoneSections.tsx`) is untouched -- it keeps Preview inline below Dimensions, a deliberate
divergence noted in the code (phone has no side-by-side room for a Preview column). Verified live
at both web (1600px) and iPad-landscape (1024px) widths, with real dimensions entered (Preview
renders the actual SVG wall diagram, not just the empty-state placeholder) and in dark mode; also
confirmed the Raked-profile note (an extra conditional child inside `ProfileSection`'s own bare
fragment) still stays contained within the left column's single grid item, not spilling into a
third auto-placed cell. Full verification suite (typecheck/test/build/depcruise) clean, 187 tests
passing.

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
2. Before starting Supabase, set `enabled = false` under `[db.seed]` in `supabase/config.toml` --
   otherwise `supabase start`'s own automatic seed attempt runs before schema.sql exists and fails
   outright (`relation "profiles" does not exist`), tearing the containers back down.
3. Apply schema by hand: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f
   supabase/schema.sql`. This is where `schema.sql` sets `companies.price_list_id` `NOT NULL` (its
   one-time backfill UPDATE for that column is a no-op on a fresh DB, since `price_lists` is still
   empty at that point) -- seed.sql's own `insert into companies (...)` never sets this column, so
   seeding will fail on it no matter when you insert a default price list afterward. Work around it:
   ```
   psql ... -c "insert into price_lists (name, is_default, created_by) values ('Default price list', true, '<any auth.users id -- run seed's user-creation DO block first, or use any id you already know>');"
   psql ... -c "alter table companies alter column price_list_id set default '<the price_lists id just inserted>';"
   ```
   (temporary -- only needed to get seed.sql's raw INSERT to succeed; drop the default afterward if
   you want the schema byte-identical to what `schema.sql` alone produces, not required just to view
   the UI).
4. Seed with a self-chosen password: `sed "s/:'seed_password'/'<password>'/" supabase/seed.sql`
   run through `psql` (the `\set ... printf` mechanism the file uses doesn't substitute correctly
   inside a `DO $$` block via this psql version).
5. Grant table privileges manually — a raw `psql` schema apply doesn't run Supabase's own
   default-privilege setup: `grant all on all tables in schema public to anon, authenticated,
   service_role;` (plus sequences/functions) after seeding.
6. Point the dev server at it via `.env` (`VITE_SUPABASE_URL=http://127.0.0.1:54321`,
   `VITE_SUPABASE_PUBLISHABLE_KEY=<the demo anon key printed by `supabase start`>`), sign in as
   one of the seeded `@e2e.test` personas with the password chosen in step 4. Playwright (project
   dependency, `@playwright/test`) with `executablePath: '/opt/pw-browsers/chromium'` works well for
   driving it headlessly and screenshotting -- see CLAUDE.md's own Playwright note.
7. Clean up afterward: revert `supabase/config.toml` (the `db.seed.enabled` toggle from step 2),
   delete the `.env` you created and any one-off check scripts, `npx supabase stop`.

### Known good reference material while doing this
- `speedpanel-estimator-web-v5.html`/`-ipad-v5.html`/`-phone-v5.html` (design package, not stored
  in this repo — was supplied as an upload in the session that started this work) for what the
  merged Wall Setup / Panel length cards should look like.
- `externalCalculator/*.tsx` (before deletion) is the reference for exactly what External-specific
  content each of the six consumers needs to render.
