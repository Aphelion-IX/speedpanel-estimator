# Speedpanel Estimator

A React + TypeScript single-page app that estimates panel, track, flashing,
fixing and sealant quantities for Speedpanel wall systems (Internal panels and
External-clad panels), for a single wall or a whole multi-wall project.

## Run in GitHub Codespaces

```bash
npm install
npm run dev
```

Then open the forwarded port **5173** from the Codespaces **Ports** tab.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints in the terminal.

## Check before release

```bash
npm run typecheck
npm run build
```

## Scripts

- `npm run dev` — start dev server using `vite --host 0.0.0.0`
- `npm run typecheck` — TypeScript check
- `npm run build` — production build (runs typecheck first)
- `npm run preview` — preview production build

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| UI framework | **React 19** | Function components + hooks only, no class components. |
| Language | **TypeScript** | Strict-ish; `npm run typecheck` runs `tsc --noEmit` with no build output. |
| Build tool | **Vite 8** | Dev server (`vite --host`) and production build (`vite build`). |
| Styling | **Tailwind CSS 3.4** | Utility classes only — there is no separate CSS-in-JS or component library. |
| Icons | **lucide-react** | The only external UI dependency besides React itself. |
| Persistence | `localStorage` | The project (walls, dimensions, settings) and small UI preferences (layout mode, theme) persist between visits — there is no backend/database. |

There is no state-management library (Redux/Zustand/etc.) — all app state lives
in a handful of custom hooks (`useWallStore`, `useWallResults`,
`useLayoutMode`, `useThemeMode`) built on plain `useState`/`useMemo`/`useEffect`.

### Tailwind setup

- `tailwind.config.js` sets `darkMode: "class"` — dark mode is driven by a
  `.dark` class on `<html>`, toggled by `useThemeMode.ts`, **not** by the
  `prefers-color-scheme` media query directly (though "auto" mode reads that
  media query to decide whether to apply the class).
- `content` is scoped to `index.html` and everything under `src/**/*.{js,ts,jsx,tsx}`.
- `src/index.css` has the three standard `@tailwind base/components/utilities`
  directives, plus a small set of CSS custom properties (`--navy`, `--blue`,
  `--gold`, etc.) defined once under `:root` and again under `.dark`. A handful
  of brand colours in `App.tsx` (`NAVY`, `BLUE`, `GOLD`, ...) are plain
  `var(--navy)`-style references into these tokens instead of hardcoded hex,
  so any inline `style={{ color: NAVY }}` usage automatically flips with the
  theme — only the ad-hoc `bg-*`/`text-*`/`border-*` Tailwind utility classes
  needed explicit `dark:` variants added by hand.
- No Tailwind plugins are used (no `@tailwindcss/forms`, no daisyUI, etc.) —
  every control (buttons, toggles, badges, cards) is hand-styled utility classes.

## Project structure

```
src/
  App.tsx                     -- the app: UI, per-wall compute engine, aggregation
  data.ts                     -- single source of truth for product/spec data
  useLayoutMode.ts            -- phone vs web layout preference (auto/phone/web)
  useThemeMode.ts             -- light vs dark theme preference (auto/light/dark)
  estimate/
    estimate.types.ts             -- WallLike / ConnectionMaterial shared types
    estimate.rules.ts              -- named constants for the junction allowance
    calculateConnectionMaterials.ts -- wall-to-wall junction material calc (pure)
    calculateCombinedEstimate.ts    -- rolls junctions into combined-estimate totals (pure)
    useCombinedEstimateCalc.ts      -- React hook binding over the above
    mathUtils.ts                    -- rounding/ceiling helpers shared by the engine
```

`data.ts` is deliberately kept free of calculation logic — it's the catalog of
panel types, span tables, stock lengths, pack sizes and system constants. To
change a spec number, that's the only file that should need editing. `App.tsx`
holds the actual compute engine and every UI component; the `estimate/` folder
holds the newer multi-wall junction logic as small, pure, independently
testable functions (no React, no App.tsx imports) with a thin hook wrapper.

## How the calculation logic works

Every wall — internal or external, single or part of a multi-wall project —
goes through the same pipeline. The two calculators (`INTERNAL`/`EXTERNAL`)
are **the same engine** parameterized by a `SystemConfig` object
(`INT_CONFIG` / `EXT_CONFIG` in `data.ts`) that supplies the differing stock
lengths, pack sizes, sealant rate, whether Z-flashing applies, etc. — there is
no duplicated calculation code between Internal and External.

### 1. Single-wall estimate — `computeWall(input, config)`

This is the one entry point both calculators call. It runs as a series of
named steps, each of which can short-circuit the whole estimate by returning
an `exit` result (e.g. "width exceeds the system limit") the moment something
is invalid, so nothing downstream runs on bad input:

1. **`resolveGeometry`** — turns width/height (and, for non-standard profiles,
   left/right eave heights, ridge height/position) into an area, a max height,
   and — for vertical orientation — a per-panel-strip height array. Three wall
   profiles are supported: **standard** (rectangular), **raked** (one straight
   slope), and **gable** (two slopes meeting at a ridge that can sit off-centre).
   For sloped profiles, each vertical strip is sized to the *taller* edge of
   its own bay, not the wall's centreline — a panel has to cover its whole bay,
   not just the average height under it.
2. **`validateSpan`** — checks the resolved width/height against the selected
   panel type's span-table limits (from `data.ts`'s `PANELS[].spanVert` /
   `spanHoriz`), plus wall-system-specific limits (e.g. Shaft wall's separate
   5.0 m width ceiling). A failing check exits early with a warning instead of
   producing a (wrong) quantity.
3. **`buildPieces`** — turns the geometry into a flat list of raw panel piece
   lengths to be cut: one length per vertical strip, or one length per
   horizontal row.
4. **Stock packing — `packPanels` / `buildOption`** — the raw piece lengths are
   bin-packed against the system's available stock lengths (`STOCK_LENGTHS`
   for Internal, `EXT_STOCK` for External, or a single forced length if the
   user locked one). It tries every stock length long enough for the largest
   piece, bin-packs each candidate (first-fit-by-remaining-space), and keeps
   the candidate with the least waste — provided that waste doesn't exceed
   `STOCK_WASTE_THRESHOLD` (20%). The result is then converted into whole
   packs/spares via `packInfo`, using each panel type's pack size (`PACK` in
   `data.ts`, e.g. P78 = 14 panels/pack).
5. **`computeTrackLM`** — perimeter/vertical C-track and (Internal P78 only)
   J-track linear metres, from the wall's restrained edges and geometry.
6. **`computeHorizCtrack`** / **`pickHorizCtrack`** — for horizontal-orientation
   walls, looks up the correct C-track section and fixing count from each
   panel type's `horizCtrack` band table in `data.ts` (an ordered list of
   width/height bands — first match wins), rather than a formula.
7. **`computeFixings`** — screw counts: structural fixings (`fix30`, one style
   per row/edge configuration) and panel-to-panel fixings (`fix16`), including
   the enhanced-fixing rule for P78 vertical walls over 5.0 m.
8. **Wall-system special cases** — **Corner wall** (`computeCornerPair`) and
   **Shaft wall** (`computeShaftPair`/`computeShaftVerticals`) are two walls
   explicitly linked by the user (`cornerPartnerId` / `shaftPartnerId`) that
   share one physical corner post or vertical-track/slab-pass kit — that
   shared kit is computed once per linked pair, not once per wall, in
   `aggregate()` (tracked via a `seen*PairIds` set so the second wall in a
   pair doesn't double-count it).

`computeWall`'s result (`ComputeOut`) carries panel groups, track linear
metres, fixing counts, sealant sausages, warnings and notes for that one wall.

### 2. Whole-project aggregation — `aggregate(results, config)`

Sums every wall's `ComputeOut` into project-level totals: panel piece counts
grouped by `type|stock`, C-track linear metres grouped by `type|orientation`,
custom-length schedules, fixing/sealant totals, plus the once-per-pair Corner/
Shaft kit totals described above. This is what powers the "Easy to Order"
project summary cards for a single calculator session.

### 3. Combined (multi-wall) estimate — the `estimate/` module

When a project has more than one wall, `aggregate()`'s per-wall totals already
cover each wall's own edges — but where two *different-orientation* walls
physically meet (a vertical wall butting into a horizontal one), extra track
is needed at that junction that neither wall's own edge materials account for.
This is what the `estimate/` module adds, as a separate, pure, three-stage
pipeline layered on top of (not duplicating) the per-wall engine above:

1. **`calculateConnectionMaterials(walls)`** — for each pair of walls the user
   has explicitly linked (`junctionPartnerId`), where the two walls have
   *different* orientations, produces one `ConnectionMaterial`: two track
   lengths run back-to-back (`JUNCTION_TRACK_QUANTITY = 2`), each sized to the
   *taller* of the two walls, converted to stock pieces against
   `JUNCTION_TRACK_STOCK` (the same 6 m stock as horizontal C-track). Same-
   orientation linked pairs are skipped here — they're Corner/Shaft walls with
   their own dedicated kits from step 1 above, not a generic junction.
2. **`calculateCombinedEstimate(walls)`** — sums those connection line items
   into total junction linear metres, total junction pieces, and pooled
   warnings (e.g. a note when the two linked walls have different heights, so
   the junction was sized to the taller one).
3. **`useCombinedEstimateCalc(walls)`** — a one-line `useMemo` hook wrapper so
   the combined estimate only recomputes when the wall list actually changes.

The junction quantities from this module are added into the "Combined wall
estimate" view's Easy to Order summary and shown itemised in the Connection
Breakdown card, alongside (not instead of) each wall's own `aggregate()`
totals.

### Why it's split this way

`data.ts` (pure spec data) → `App.tsx`'s `computeWall`/`aggregate` (the
single- and whole-project engine, tightly coupled to the UI's `Wall`/
`ComputeOut` shapes) → `estimate/` (the junction layer, deliberately
structural/framework-agnostic — it only needs anything shaped like
`WallLike`, so it has no dependency on the compute engine or React, and can be
unit-tested in isolation). Each stage only knows about the stage before it.
