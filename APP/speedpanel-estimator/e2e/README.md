# Role-based auth/RLS testing

Comprehensive, role-based coverage of this app's Supabase authorization
model, driven through the real login form and real RLS -- never a bypassed
service-role client in a test assertion. Two layers:

- **`supabase/tests/database/*.sql`** (pgTAP) -- exercises `is_admin()`,
  `has_staff_role()`, `is_company_admin()`, `can_view_project()`,
  `can_edit_project()`, `can_submit_orders()`, and a spot-check of the
  security-definer RPC surface, by simulating each seeded user's session
  directly in Postgres. **Verified passing** (36/36 assertions) against the
  live project as of this writing.
- **`e2e/*.spec.ts`** (Playwright) -- signs in through the real UI as each
  persona and exercises pages, direct-fetch bypass attempts, Edge Function
  auth, scoped-queue behavior, and the staff-invite flow. **Runs for real in
  GitHub Actions** (`.github/workflows/e2e.yml`, on every PR/push to `main`
  and on demand) -- that workflow run, not a sandbox claim, is the source of
  truth for pass/fail. See "What's actually verified" below for exactly what
  was and wasn't confirmed passing in *this* development session.

## Test personas

All seeded by `supabase/seed.sql`, one shared password
(`E2E_PASSWORD` env var). Emails use the IANA-reserved `.test` TLD (RFC
2606), never a real domain.

| Email | Role | `profiles.role` | `staff_role` | Company |
|---|---|---|---|---|
| `admin@e2e.test` | Platform administrator | `admin` | `super_admin` | none |
| `project-manager@e2e.test` | Project Manager (staff) | `admin` | `project_manager` | assigned to Co. A |
| `bdm@e2e.test` | Business Development Manager (staff) | `admin` | `bdm` | assigned to Co. A |
| `internal-sales@e2e.test` | Internal Sales (staff) | `admin` | `internal_sales` | assigned to Co. A |
| `dispatch@e2e.test` | Dispatch (staff) | `admin` | `dispatch` | assigned to Co. A |
| `technical@e2e.test` | Technical Services (staff) | `admin` | `technical_services` | assigned to Co. A |
| `company-admin@e2e.test` | Customer company administrator | `user` | none | owner of Co. A |
| `member@e2e.test` | Standard customer member | `user` | none | estimator @ Co. A |
| `outsider@e2e.test` | Different company, no access to Co. A | `user` | none | owner of Co. B |
| `unassigned@e2e.test` | Authenticated, no role, no company | `user` | none | none |
| *(anonymous)* | No account | -- | -- | -- |

Fixture data: two companies (A, B); 5 projects -- 3 in Company A across
draft/install_review/technical_review stages, 2 in Company B
(draft/install_review, so the Project Reviews queue has a genuine
cross-company negative case); 3 orders across
draft/proforma_requested/proforma_issued stages with one delivery; one
project document; one company-attributed request and one anonymous request.
See `supabase/seed.sql` for exact IDs (also in `e2e/fixtures/seedIds.ts`).

## Role access matrix

Client-side page gating is `src/pages/admin/adminSectionAccess.ts`'s
`SECTION_ROLES` -- real enforcement is server-side (RLS + `has_staff_role()`
on every write RPC), the table below reflects both layers together.

| Section/action | super_admin | project_manager | bdm | internal_sales | dispatch | technical_services | company-admin | member | outsider/unassigned |
|---|---|---|---|---|---|---|---|---|---|
| Admin > Requests | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Admin > Project Reviews | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Admin > Orders | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Admin > Manufacturing | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Admin > Users/Companies/Permissions/Analytics/Audit Log/Catalog | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Read any project/order (RLS, `is_admin()`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | own company only | own+shared only | own company only |
| Own company's Team page management | n/a | n/a | n/a | n/a | n/a | n/a | ✅ | ❌ (estimator) | n/a |

**Notable, worth-knowing finding** (pinned down explicitly in
`03_project_and_order_access.test.sql` and `unassigned.spec.ts`):

1. Any Speedpanel staff account gets **blanket RLS read access to every
   project/order across every company** via `can_view_project()`'s
   `is_admin()` clause -- `staff_assignments` does NOT itself restrict
   *read* visibility, it's a UI-side query-scoping convenience only (see
   `src/pages/admin/shared/useMyQueueScope.ts`). Write actions are
   separately role-gated at the RPC layer.
2. `adminSectionAccess.ts`'s `canAccessSection` treats a `null` `staffRole`
   as "always allowed" (mirroring `has_staff_role()`'s own "not-yet-assigned
   internal admin" grandfather rule) -- but it doesn't distinguish that case
   from an **external customer** who also happens to have `staff_role=null`.
   In practice this means a signed-in customer can navigate to `#/admin` and
   see the dashboard shell/tile descriptions (a client-side information
   exposure, not a data leak), even though every underlying RPC call still
   correctly denies them via RLS. Neither is a security defect on its own
   (RLS is the real boundary and it holds), but the UI-shell exposure is
   arguably unintended and worth a follow-up if it matters for this app.

## Running it

`playwright.config.ts`'s `webServer` runs `npm run preview` (serves the
production `dist/` build, on `http://127.0.0.1:4173` by default), not
`npm run dev` -- run `npm run build` first, both locally and in CI.

### Path A -- local Supabase (needs Docker + real network access)
```
supabase start
supabase db reset      # applies schema.sql + seed.sql
npm run test:rls       # pgTAP via `supabase test db`
npm run build
npm run test:e2e       # Playwright, against the local stack
```

### Path B -- against a live project (what was actually used to verify Part C in this session)
```
# .env.test already points VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY
# at the target project; seed.sql/teardown-e2e.sql are applied via the
# Supabase MCP connector's execute_sql, or psql/the SQL editor directly.
npm run build
npm run test:e2e
```
Tear down with `supabase/teardown-e2e.sql` (deletes every seeded row by
`@e2e.test` email / fixed UUID) whenever you're done.

### Path C -- GitHub Actions (`.github/workflows/e2e.yml`)

Runs on every `pull_request`/`push` to `main`, and on demand via
`workflow_dispatch`. Builds the app, starts the preview server, runs the
full Playwright suite against the live project below, and uploads the
Playwright HTML report + traces/screenshots/videos as build artifacts
(`if: always()`, 14-day retention) so a failure is debuggable without
rerunning anything locally.

Requires these repository secrets (Settings -> Secrets and variables ->
Actions) to be set **once**, manually -- never committed to git:

| Secret | Required? | Notes |
|---|---|---|
| `E2E_PASSWORD` | **Yes** | The one shared password for all 10 seeded `@e2e.test` personas (see `supabase/seed.sql`). Without this, sign-in fails for every persona-based test. |
| `VITE_SUPABASE_URL` | Optional | `src/lib/supabaseClient.ts` falls back to this project's own URL if unset. Only needed to point the workflow at a *different* project. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional | Same fallback as above, for the anon/publishable key. |

Nothing here is a service-role key, and the workflow never seeds data
itself -- `seed.sql`/`teardown-e2e.sql` are applied out-of-band by whoever
administers the target project, same as Path B above. The invite-flow spec
(`admin-invite-flow.spec.ts`) calls the already-deployed `admin-invite-user`
Edge Function through the real UI; it does not redeploy it.

## Spec files

| File | Covers |
|---|---|
| `e2e/roles/*.spec.ts` | One file per persona -- permitted/blocked pages, visible/hidden nav, allowed/denied reads, cross-company isolation, direct-fetch bypass, Edge Function auth. |
| `e2e/session.spec.ts` | Logout, expired/absent session, anonymous access. |
| `e2e/cross-company-isolation.spec.ts` | Company A vs. B fixtures, general isolation checks. |
| `e2e/direct-api-bypass.spec.ts` | "Hidden button != security" -- REST/RPC calls a hidden UI control would have made, asserted still RLS-blocked. |
| `e2e/edge-function-auth.spec.ts` | `admin-invite-user`/`company-invite-member` called directly as non-super_admin personas, asserted 401/403. |
| `e2e/scoped-queue.spec.ts` | The Project Reviews queue's company scoping (`useMyQueueScope`/`applyQueueScope`) as a real signed-in `project_manager`: sees only Company A's queue, no other Workflow tiles, no super-admin-only sections, blocked from role-gated direct navigation; `outsider` sees only Company B (RLS-backstopped, not nav-gated); `admin` sees both companies. |
| `e2e/admin-invite-flow.spec.ts` | The active `admin-invite-user` v5 "Set password directly" flow through the real "Add Speedpanel staff" form: a uniquely-named (`invite-<timestamp>@e2e.test`) throwaway account is created and confirmed to actually sign in. |

## What's actually verified

- ✅ **Seed data**: all 10 personas + all fixture rows (5 projects, 3
  orders, etc.) created and confirmed present; all 10 passwords confirmed
  to authenticate against their stored hash.
- ✅ **pgTAP/SQL-RLS**: all 36+ assertions across the test files run for
  real against the live project via the Supabase MCP connector's
  `execute_sql` (simulating each user's JWT session with `set local role
  authenticated` + `request.jwt.claims`, the same technique
  `basejump/supabase_test_helpers` uses) and confirmed passing.
- ⚠️ **Playwright, run from the dev sandbox**: written completely and
  typechecks cleanly; smoke-tested against this environment's
  pre-installed Chromium, but every assertion requiring a real Supabase
  Auth/REST round-trip failed with `Failed to fetch` -- **this sandbox's
  network policy blocks outbound HTTPS to `*.supabase.co` from a browser
  context**, confirmed via the proxy's own denial log. Not a defect in the
  app or the suite -- it's exactly the gap Path C (GitHub Actions) exists
  to close.
- ✅ **Playwright, run in GitHub Actions**: this is the genuine end-to-end
  signal -- see the workflow run linked in the PR/commit this change ships
  with, not a claim made from this sandbox.
- ⬜ **Local Docker path (Path A)**: `supabase/config.toml` was generated by
  the real Supabase CLI (`supabase init`) and `[db.seed]` already points at
  `seed.sql`, but `supabase start`/`supabase db reset` themselves were never
  run in this session -- the same network policy blocks pulling the
  Postgres/GoTrue/Kong container images. Untested here, but should work in
  a normal Docker-capable environment.
