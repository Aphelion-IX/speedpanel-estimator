# speedpanel-estimator

## Project basics

The app lives in `APP/speedpanel-estimator/`, not the repo root — run all
commands from there. Before considering any task complete:

```
npm run typecheck && npm test && npm run build
```

Stack: React 19 + Vite + TypeScript (strict) + Tailwind, backed by
Supabase (Postgres + Auth + Storage + Edge Functions). Authorization is
RLS-driven — `has_staff_role()`/`is_admin()` (see `supabase/schema.sql`)
gate almost everything server-side, not just client-side nav.

## Dependency graph / architecture enforcement

`.dependency-cruiser.js` mechanically enforces the fork-not-share boundary
below (`internalCalculator/` and `externalCalculator/` must never import
from each other) — `npm run depcruise` validates and exits non-zero on a
violation; `npm run depcruise:graph` writes a Mermaid dependency graph to
`depcruise-graph.mmd` (gitignored, regenerate on demand) for either the
whole `src/` tree or a scoped subfolder, e.g.
`npx depcruise --config .dependency-cruiser.js --output-type mermaid src/internalCalculator`.

## Supabase auth / RLS rules

- Never disable RLS.
- Never expose the `service_role` key to the frontend.
- Never use a service-role client in frontend code.
- All privileged operations go through an Edge Function
  (`supabase/functions/`) or a `security definer` RPC gated by
  `has_staff_role()`/`is_admin()` — see `admin-invite-user` and
  `admin_promote_user_to_staff_by_email` for the existing pattern to follow.
- Preserve strict TypeScript (`tsconfig.json`: `strict`, `noUnusedLocals`,
  `noUnusedParameters` are all on).
- Preserve Zod validation on every Supabase row shape (existing convention
  throughout `src/pages/**/*.ts` stores).
- Run `npm run typecheck`, `npm test`, and `npm run build` before
  considering a task complete.

## Estimator UI architecture (src/internalCalculator, src/externalCalculator)

- **Fork-not-share convention**: Internal and External calculators keep
  separate copies of calculator-specific UI (`wallsCard.tsx`,
  `estimateStructureNav.tsx`, `estimateResultsCard.tsx`, `mainSections.tsx`,
  `phoneShell.tsx`, `phoneSections.tsx`, `allWallsPage.tsx`, etc.) rather
  than sharing one component tree. This is deliberate — each calculator can
  evolve its own UI without risking a change leaking into the other. Only
  genuinely calculator-agnostic pieces live in `src/ui/` (e.g. `Table`,
  `Drawer`, `primitives.tsx`) or `src/wallStore.ts` (the one shared
  wall-list state hook both calculators read/write).
- **Single mode**: the estimator always runs as the combined "project" view
  (wall carousel + `EstimateResultsCard`'s Overview/Selected Wall/
  Connections/Order tabs), regardless of wall count. A "single-wall mode"
  toggle (`EstimateModeSelector`) existed earlier and was deliberately
  retired — don't reintroduce a mode switch here without asking first.
- **Design tokens**: `src/styleTokens.ts` — `NAVY`/`BLUE`/`GOLD`/`WHITE`/
  `MUTED` (all `var(--...)` CSS custom properties) plus the `cx` object of
  reusable Tailwind class strings. Use `color-mix(in srgb, ${VAR} X%,
  transparent)` when adapting a token's opacity in a CSS string — string-
  concatenating a percentage directly onto a `var(--...)` value (e.g.
  `` `${BLUE}22` ``) produces invalid CSS that silently drops the whole
  declaration.
- **Visual verification**: the whole portal requires a signed-in session —
  an anonymous visitor hitting any tab (`/#estimator`, `/#selector`, etc.,
  hash routing via `useHashRoute`, see `App.tsx`) is shown the sign-in/
  sign-up `LandingPage` instead, no exceptions. Playwright checks against
  `/#estimator` therefore need to sign in first (or the check will just see
  the landing page). For Playwright checks, launch with
  `executablePath: '/opt/pw-browsers/chromium'`, and don't touch the manual
  layout-mode toggle button when testing phone layout — just set a narrow
  viewport, since the toggle flips relative to the *currently effective*
  auto-detected layout and can flip the wrong way on an already-narrow page.

## Debugging an auth/RLS failure ("permission denied for table ...", etc.)

Do NOT bypass the failure by disabling RLS, weakening a policy, or reaching
for a service-role client in the frontend. Instead:

1. Reproduce the issue.
2. Trace the request: React component → hook → Supabase query →
   authenticated user → JWT claims → matching RLS policy.
3. Identify which of these is the actual cause: missing session, expired
   JWT, incorrect Supabase client, RLS policy, database function, Edge
   Function, frontend auth flow, or incorrect role assignment.
4. Explain the root cause.
5. Propose the smallest secure fix.
6. Implement it — if elevated access is genuinely needed, add or modify an
   Edge Function or security-definer RPC rather than bypassing RLS.
7. Run `npm run typecheck`, `npm test`, and `npm run build`.
8. Explain what changed and why it's still secure.
