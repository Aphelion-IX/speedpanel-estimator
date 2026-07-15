# Design Audit — SpeedPanel Estimator

*Prepared as a first step toward unifying the app's visual design. Scope:
the whole app under `src/`, produced from a full pass over routing/layout,
Tailwind/color-token usage, and shared component patterns.*

## Executive summary

Two separate problems are contributing to the app feeling inconsistent and,
per stakeholder feedback, "ugly":

1. **A real design-token system exists but is optional, not enforced.**
   `src/styleTokens.ts` and `src/index.css` define a genuine brand palette
   (`NAVY`/`BLUE`/`GOLD`/`MUTED` as CSS custom properties) plus a `cx`
   dictionary of shared Tailwind class strings (card, input, badge, etc.).
   The calculator/estimator core (`src/ui/primitives.tsx`,
   `internalCalculator/`, `externalCalculator/`) follows these tokens
   fairly well. Almost everywhere else — `src/pages/**`, especially
   `admin/` — bypasses them in favor of raw Tailwind palette classes,
   because **`tailwind.config.js` has zero theme customization**
   (`theme: { extend: {} }`). Nothing makes the tokens the path of least
   resistance, so new code doesn't reach for them.

2. **The app has two visual tiers, and most of it is the plainer one.**
   `LandingPage.tsx` (signed-out) and `OverviewDashboardPage.tsx`
   (signed-in home) were built to a distinctly more polished visual
   language — bold type, generous whitespace, large soft shadows, big
   corner radii, accent-colored hover states. Every other page uses a
   flatter, smaller-scale, lower-contrast style built on `cx.card`
   (`rounded-xl`, `shadow-sm`, `p-5`) and a `text-lg font-bold` heading
   convention. This second point is the primary driver of the "it feels
   ugly" reaction — it's not just that pages are inconsistent with each
   other, it's that the *baseline itself* is plainer than the two screens
   users actually like.

The recommended fix addresses both: raise the shared baseline (`cx.card`,
headings, buttons) to match the two benchmark pages, then migrate the rest
of the app onto that raised baseline, starting with `admin/` where drift is
worst.

---

## Design benchmark: what makes `LandingPage` / `OverviewDashboardPage` work

| Attribute | Benchmark pages | Rest of the app |
|---|---|---|
| Heading scale | `text-4xl`–`text-6xl`, `font-extrabold`/`font-black`, tight tracking (`tracking-tight`, `tracking-[-0.04em]`) | `text-lg font-bold` for most page h1s |
| Corner radius | `rounded-2xl`, `rounded-[28px]` | `rounded-xl` (dominant), `rounded-lg` (also common) |
| Shadow | Layered, soft: `shadow-[0_24px_80px_rgba(15,23,42,0.12)]`, dark `shadow-[0_18px_60px_rgba(0,0,0,0.22)]` | Flat `shadow-sm` everywhere |
| Card interactivity | Accent-colored icon chips per card, `hover:-translate-y-0.5`, border-color transition | Static; no hover feedback on most cards |
| Padding/whitespace | `p-6`–`p-10`, `mt-8`–`mt-12` section gaps | `p-5` (`cx.card`), `mt-2`–`mt-3` |
| Inputs | 12px-tall, icon-prefixed, `focus-within:ring-4 focus-within:ring-blue-50` | Plain `cx.input` box, thin border-only focus |
| Texture/depth | Background blueprint-grid texture + `backdrop-blur-xl` on the login card | Flat white/slate backgrounds |

`(file references: src/pages/home/LandingPage.tsx, src/pages/home/OverviewDashboardPage.tsx, src/styleTokens.ts)`

**Recommendation**: treat these two pages as the app's actual design
language, and raise `cx.card`/`cx.section`/heading styles/button styles to
match, rather than treating them as one-off exceptions to "fix" into
conformity with the plainer baseline.

---

## Findings by category

### 1. Color system duplication

- Brand tokens (`NAVY`/`BLUE`/`GOLD`/`MUTED`, `src/styleTokens.ts:6-10`)
  are consumed via inline `style={{color: ...}}` in the calculator core,
  but 52 files across `src/pages/**` use raw Tailwind palette utilities
  instead (`bg-blue-600`, `text-red-600`, etc.) with no shared constant.
- Two different "danger" reds are both in active use: `text-red-500` with
  no dark variant (`src/pages/company/CompanyMemberList.tsx:195,221`,
  `src/pages/projects/ProjectDetailPage.tsx:220`) vs. `text-red-600
  dark:text-red-400` used everywhere else (15+ occurrences, e.g.
  `SaveDraftBanner.tsx:40`, `OrderDetailPage.tsx:39`).
- Status-badge color maps (amber/emerald/red/blue → Tailwind classes) are
  hand-duplicated across five separate files instead of one shared
  lookup: `src/pages/company/companyTypes.ts:28-29`,
  `src/pages/projects/journeyStage.ts:49-53`,
  `src/pages/projects/requests/requestTypes.ts:32-33`,
  `src/pages/projects/projectTypes.ts:66-67,80-81`,
  `src/pages/projects/orders/orderTypes.ts:35-37,110,140-143`. The string
  `"bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"`
  is duplicated 8 times across these files.
- `src/pages/projects/ProjectDetailPage.tsx:66-67` defines an ad hoc
  `blue/green/purple/orange` → class lookup local to that one file.
- No custom Tailwind color tokens exist (`tailwind.config.js:6`,
  `theme: { extend: {} }`), so there is no `bg-brand-blue`-style class to
  make raw-palette usage visibly "off-brand" at a glance.

### 2. No shared component library for the basics

- No `Button`, `Table`, `Modal`/`Dialog`, `Checkbox`, `Tabs`, or `Badge`
  component exists anywhere in the app (confirmed via full-repo search).
- **Buttons**: 72 files hand-roll `<button>` markup. Concrete drift:
  primary CTA uses `rounded-xl px-4 py-2.5` in `OrderDetailPage.tsx:109`
  vs. `rounded-lg px-3 py-1.5` in `AdminProductsPage.tsx:115` for the same
  role. Text-link buttons mix `font-bold` no-underline
  (`AdminUsersPage.tsx:268`) with `font-semibold hover:underline`
  (`OrderDetailPage.tsx:67`).
- **Tables**: every table is bespoke raw `<table>` markup
  (`AdminRolesPage.tsx`, `AdminUsersPage.tsx`,
  `admin/shared/repeatableRowEditor.tsx`,
  `projects/orders/LineItemAllocationTable.tsx`, `OrderLineItemsTable.tsx`,
  `ProformaInvoicePage.tsx`, `QuickOrderPage.tsx`, plus three in `src/ui/`).
  Header styling has two competing conventions (regular-case semibold navy
  vs. uppercase bold muted); `ProformaInvoicePage.tsx:73` uses a
  light-mode-only border (`border-b border-slate-200`, no `dark:`
  variant) that will be hard to see in dark mode. No table anywhere has
  zebra striping or row hover states.
- **Modals**: none exist. All "detail" views use inline expand panels
  instead of overlays; confirmations use native `window.confirm`/`alert`
  at 9+ call sites (`AdminPriceListsPage.tsx:115,123`, `App.tsx:110`,
  `AdminProductsPage.tsx:75,80,87`, and others), meaning every destructive
  action's confirmation UI looks like the OS, not the app.
- **Checkboxes**: zero styling anywhere — every checkbox is a bare native
  `<input type="checkbox">` (7+ locations, e.g.
  `admin/shared/repeatableRowEditor.tsx:64`,
  `admin/companies/AdminCompanyWizard.tsx:114`,
  `admin/AdminRolesPage.tsx:109`).
- **Forms**: `src/pages/shared/fields.tsx` provides `Field`, `NumField`,
  `SelectField`, `TextAreaField`, etc. and is used in ~11 files, but 26+
  other files roll raw `<input>`/`<select>`/`<textarea>` instead —
  `AdminUsersPage.tsx:151` even has a code comment acknowledging the
  divergence for its table-row-editing inputs.

### 3. Copy-pasted boilerplate at scale

- The loading-state snippet — `<div className={cx.card + " mt-N text-sm"}
  style={{color: MUTED}}>Loading...</div>` — is duplicated verbatim in 34
  separate files rather than extracted into a shared component. Margin
  values vary arbitrarily between copies (`mt-2`, `mt-3`, `mt-5`, `mt-6`).
  `ProformaInvoicePage.tsx:26` breaks the pattern entirely (`p-8` instead
  of `cx.card`). Zero `animate-spin`/spinner usage exists anywhere — every
  loading state is plain text.
- The error-text snippet — `<p className="text-sm text-red-600
  dark:text-red-400">{error}</p>` — is duplicated across 15+ files.
- The empty-state snippet — `<p className={cx.footnote}>No X yet.</p>` —
  is mostly consistent but has at least one deviation
  (`StaffTeamAssignmentPanel.tsx:52` uses a different ad hoc style right
  next to a `cx.footnote` instance at line 38).

### 4. Inconsistent radii, shadows, spacing

- Border radius counts across `src/**/*.tsx`: `rounded-xl` 158×,
  `rounded-lg` 58×, `rounded-2xl` 7×, `rounded-full` 34×, `rounded-md` 2×,
  one arbitrary `rounded-[28px]` (`LandingPage.tsx:79`) — five different
  radii for what is conceptually the same "card/button/input corner" role,
  with `rounded-lg`/`rounded-xl` both used interchangeably.
- Shadows: `shadow-sm` dominates (36×) and matches `cx.card`, but
  `shadow-md` (3×), `shadow-lg` (2×), and 3 arbitrary `shadow-[...]` values
  appear as one-offs on `OverviewDashboardPage.tsx:59` and
  `LandingPage.tsx:79`, visually standing out against the rest of the
  app's flat cards.
- Button padding alone has 5+ different combos in circulation (`px-3
  py-1.5`, `px-4 py-2.5`, `px-4 py-2`, `px-3.5 py-2`, `px-5 py-2`, 57
  combined occurrences) with no single dominant value.
- `styleTokens.ts:21-27` documents an intended spacing rhythm, but the
  `pages/` tree doesn't reference it and uses its own varied paddings.

### 5. Heading hierarchy

At least 5 different (size/weight/color) combinations exist for
conceptually equivalent "page h1" elements:
- `text-lg font-bold` NAVY — the most common convention (`CompanyTeamPage.tsx:24`, `OrderDetailPage.tsx:71`, `AdminRolesPage.tsx:75`, `AdminCompaniesPage.tsx:62`, and others)
- `text-2xl font-bold` NAVY (`ProjectsListPage.tsx:237`, `SystemSelector.tsx:54`)
- `text-2xl font-extrabold` BLUE (`PlaceholderPage.tsx:14`)
- `text-4xl font-extrabold ... sm:text-5xl`, raw `text-slate-900`, not the NAVY token (`OverviewDashboardPage.tsx:142`)
- `text-3xl font-extrabold`, raw `text-slate-950`, not the NAVY token (`LandingPage.tsx:66,82`)

`PlaceholderPage.tsx` was originally meant to be the shared shell for
not-yet-built pages, but only `AdminDashboard.tsx` still uses it — all 14
other `Admin*Page.tsx` files were since built with their own bespoke
wrappers instead.

### 6. Page-shell inconsistency

- There is no `PageContainer` component. `App.tsx` (~lines 206–322) renders
  one shared header/content shell for most routes, but each page then adds
  its own top-margin wrapper independently: `mt-2` (EducationHub,
  AdminRequestsPage, AdminAnalyticsPage, AdminMathsPage), `mt-6` (AdminRoot
  and several Admin*Page loading/error states), `mt-3`, or no wrapper at
  all.
- `LandingPage` (signed-out) and `ProformaInvoicePage` (printable) both
  bypass the shared shell entirely via early returns in `App.tsx` — a
  deliberate, documented exception, but it means three different root
  layout code paths exist (shared shell, landing, proforma), each
  hand-maintained.

### 7. Admin vs. customer-facing split

The app has four zones: customer-facing (`pages/home`, `pages/projects`,
the calculators), company/customer-org admin (`pages/company`), internal
staff admin (`pages/admin`, ~15 pages, lazy-loaded), and the standalone
proforma document. All four consume the same base tokens, so at the color/
radius/type level there's no separate "admin theme" — but the **admin
zone is where nearly every inconsistency above concentrates**: raw tables,
raw inputs/checkboxes, native `alert`/`confirm`, duplicated cards, and
duplicated loading/error text all live predominantly in
`src/pages/admin/**`, while the customer-facing calculator
(`internalCalculator`/`externalCalculator`) is comparatively well unified
via `src/ui/primitives.tsx`. This makes admin the highest-value first
target for remediation.

### 8. Dark mode

Implemented once, centrally (`src/useThemeMode.ts` + `.dark` CSS-var
overrides in `index.css:24-31`), with `darkMode: "class"` in
`tailwind.config.js:3`. Coverage is good overall — no `bg-white` was found
without a `dark:` counterpart — but dark-mode correctness for raw-Tailwind-
color usage (as opposed to the CSS-var tokens) depends entirely on each
author remembering to add the matching `dark:` class by hand, since
there's no single source of truth for those pairings. One found gap:
`ProformaInvoicePage.tsx`'s border (§2) and error text are missing `dark:`
variants that exist everywhere else.

### 9. Duplicated component implementations

Several feature folders reimplement the same UI concept independently
rather than composing shared primitives: `education/DocumentCard.tsx`,
`admin/products/productCard.tsx`, `admin/companies/CompanyPriceListCard.tsx`,
`systemSelector/WallSystemOptionCard.tsx` each hand-build a bordered/
rounded/shadow "card" rather than reusing `ui/primitives.tsx`'s `Card`.
Tab/segmented-control UI is separately reimplemented in at least three
places (`AdminMathsPage.tsx`, `AdminSystemsPage.tsx`'s `SystemToggle`,
`EstimateModeSelector` in `ui/primitives.tsx`).

---

## Prioritized remediation roadmap

### Phase 1 — Foundation (design system + raised baseline)

1. Register the brand palette as real Tailwind theme colors in
   `tailwind.config.js` (e.g. `brand.navy/blue/gold/muted`) so raw-palette
   usage becomes visibly inconsistent rather than invisible.
2. **Raise the shared baseline to match the benchmark pages**: update
   `cx.card`/`cx.section` to larger radius (`rounded-2xl`) and a layered
   shadow, widen default padding, and introduce a shared heading scale
   (page h1/h2) matching the bolder, tighter-tracked type used on
   `LandingPage`/`OverviewDashboardPage`. Add hover-lift/border-transition
   treatment to interactive cards and primary buttons.
3. Build the missing core primitives in one canonical shared location
   (resolving the current 3-way split between `src/ui/`,
   `src/pages/shared/`, `src/pages/admin/shared/`): `Button`, `Checkbox`,
   `Badge`, `Table`, `LoadingState`/`ErrorState`/`EmptyState`,
   `ConfirmDialog` (to replace native `confirm`/`alert`).
4. Consolidate the 5 duplicated status-color maps into one shared utility.

### Phase 2 — Admin section (first migration target)

Migrate all ~15 `Admin*Page.tsx` files onto the Phase 1 primitives:
replace raw tables with the shared `Table`, raw inputs/checkboxes with the
existing `fields.tsx` components (already built, just underused), native
`alert`/`confirm` with `ConfirmDialog`, and the duplicated loading/error
snippets with `LoadingState`/`ErrorState`. Standardize admin page headings
and top-level container spacing.

### Phase 3 — Rest of the app

Projects/orders/company pages next, then reconcile the customer-facing
pages (`LandingPage`, `OverviewDashboardPage`) — which should need the
least work, since they're the design reference, but may want small
adjustments once the raised baseline exists (e.g. removing one-off
arbitrary values like `rounded-[28px]`/`bg-[#f7f9fc]` in favor of the new
shared tokens, if they end up matching).

---

## Verification for this deliverable

This audit is a documentation task; no application code was changed.
Findings were cross-checked against three independent codebase
exploration passes and against a direct reading of the two benchmark
files (`LandingPage.tsx`, `OverviewDashboardPage.tsx`). All file paths
above are relative to `APP/speedpanel-estimator/`.
