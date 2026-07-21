# Company Accounts & Pricing — phased implementation plan

## Context

The user supplied three reference documents for a new internal admin module:
1. A static HTML/CSS admin mockup bundle (13 pages, rougher/earlier-pass visual style).
2. `COMPANY_ACCOUNTS_AND_PRICING_BACKEND_SPEC.md` (612 lines) — the functional requirements: company management, external-user roles + invitation workflow, two pricing methods (assigned predefined price list, and per-company item overrides), a 3-tier pricing priority, price-list versioning with order-time price freezing, price-visibility rules for external customers, required screens, an internal permissions matrix, and audit history.
3. 14 polished 1600×1200 PNG screenshots, styled to match the real live app ("mySPEEDPANEL" branding) — the **definitive visual/UX reference**, superseding the HTML mockup. These show a new left-sidebar "Account Management" workspace (Companies / Company Users / Invitations / Company Pricing / Price Lists / Permissions / Audit History) sitting alongside the existing Estimator/Projects nav.

A large amount of what the spec describes **already exists and works** in this codebase — companies, company memberships, invitations, staff assignment, dynamic RBAC, audit logging, and single-list price assignment are all real, live features (`supabase/schema.sql`, `src/pages/admin/companies/`, `src/pages/company/`, `src/pages/admin/priceLists/`). This is **not a rebuild** — it's a scoped, additive extension of one domain (companies + pricing), reusing existing infrastructure everywhere it already satisfies the spec, and adding new tables/RPCs/pages only for genuine gaps. The three genuine backend gaps are: **per-company item price overrides** (zero backend today), **price-list versioning** (today's `price_lists` is one flat, live-edited row with no history), and **multi-address support** (today `companies.address` is a single text field). A fourth gap — order-time price freezing — is real but smaller than first thought, since `order_deliveries` already freezes addresses as plain text columns (no FK to unfreeze).

User confirmed (AskUserQuestion): build the new module as its **own top-level workspace** matching the screenshots exactly; retire the old `#/admin/companies` / `#/admin/priceLists` / (raw-grant) `#/admin/roles` pages once their new-module equivalents reach parity, in a final cleanup phase — `AdminRolesPage.tsx` itself is kept permanently as the underlying raw-grant editor, not replaced, since the new "Access Permissions" page is a curated summary view reading the same `role_permissions` data, not a different grant model.

This plan is intentionally phased for execution across many separate future sessions (not one sitting) — mirrors this codebase's own precedent (`docs/unified-estimator-merge-plan.md`'s Phase 1–6 structure for the estimator merge). Commit after each phase passes its own verification; don't batch phases into one commit.

## Corrected understanding from deep research (read this before starting any phase)

- **The admin dashboard tile grid is already orphaned for this area.** `adminSections.tsx`'s `ADMIN_GROUPS` has exactly one group today ("Workflow": Projects Administration/Orders/Delivery Requests) — Companies/Price Lists/Permissions routes still work via direct `#/admin/...` URLs but have zero dashboard tiles pointing at them. There is no "current experience" to visually integrate the new module with beyond raw URLs.
- **"One active primary user required" already exists server-side** as `company_set_member_role`/`company_set_member_status`/`company_remove_member`'s existing refusal to demote/suspend/remove the last remaining `owner`. Spec's "Primary User" is just a display label for the existing `owner` `CompanyRole` — no new role, no new guard, just UI copy (`COMPANY_ROLE_LABELS`).
- **`src/export/applyEffectivePricing.ts`** is the single load-bearing file for Method 2 — it already implements the assigned-list → default-list fallback chain; adding the item-override tier in front of it is the one-line change the whole feature builds toward. Audit every current caller (client-side pricing preview, order pricing, Excel export), not just the obvious one.
- **`price_lists`/`price_list_prices` today has no version concept whatsoever** — `admin_set_price_list_price` edits a live row in place, immediately affecting every assigned company. Versioning is a real behavioral change to a live, working, in-place-edit RPC and page (`AdminPriceListsPage.tsx`), not just new tables bolted on alongside.
- **Order creation is a bare RLS insert, not an RPC** (`"Owners can create their own orders"` policy, schema.sql ~1136–1180) — only `revise_order` (an existing RPC, staff-only, submitted/proforma_requested stages only) recomputes totals server-side, and even it doesn't validate against price lists. This matters for Phase 10: there's no existing RPC boundary to add price re-verification into for *initial* order creation.
- **`order_deliveries` already freezes addresses** as plain text columns (`address_line1/2`, `suburb`, `state`, `postcode` — schema.sql ~1191) with no FK to any address entity. "Freeze the address used" is a solved problem already, not a gap — `company_addresses` (Phase 3) is purely a *picker source* for populating those text columns at delivery-creation time; no additional freeze work is needed in Phase 10.
- **No cron infrastructure exists anywhere** (`pg_cron` not enabled, only `pgcrypto` is; grep confirms zero `cron.schedule` usage) and **no "date has passed" lazy-check pattern exists either** (`invitations.expires_at` is set but never actually compared against `now()` in any view/function). "Scheduled" price-list versions auto-activating on their effective date has no precedent to follow — recommend a **lazy on-read check** (a view/function comparing `effective_date <= current_date`) over introducing `pg_cron` as a new dependency, but this is a real design choice to make explicitly in Phase 8, not follow convention on.
- **No `supabase/migrations/` directory** — `schema.sql` is one monolithic declarative file; new permission keys are appended as new `insert into public.permissions (...) values (...) on conflict (key) do nothing;` blocks near each new feature's own section (6 such blocks already exist, scattered through the file) — follow that exact pattern, don't invent a migrations folder.
- **CSV import/export (`priceListCsv.ts`) is schema-agnostic and directly reusable** for Phase 7's draft-version editor — it never touches Supabase itself (pure parse/build functions over `PriceListPriceRow[]`), matches by `Product ID` + `Category` (name column is cosmetic/ignored on import), and export uses `XLSX.writeFile(..., {bookType:"csv"})` for a direct browser download (no manual Blob/anchor code needed). Only `priceListsStore.ts` (which parameterizes reads/writes by `price_list_id`) needs updating to target `price_list_version_id` instead.
- **Test infrastructure to hook into, with exact commands:**
  - pgTAP: `supabase/tests/database/01_..07_...test.sql` (numbered, run together via `npm run test:rls` → `supabase test db`, against the local Docker Supabase stack, real RLS via `set_config('request.jwt.claims', ...)` — not a service-role bypass). New phases add `08_...test.sql` onward. `02_company_isolation.test.sql` is the representative company/permissions example (`plan(10)`, `results_eq`/`throws_ok`-style cross-company isolation checks).
  - Playwright: `e2e/*.spec.ts` (19 files, incl. `cross-company-isolation.spec.ts`, `admin-invite-flow.spec.ts`, plus one spec per role under `e2e/roles/`), run via `npm run test:e2e` → `playwright test`, against a **production build** (`npm run preview`) and a **real/remote** Supabase project (not local Docker), authenticating as fixed seeded `@e2e.test` accounts via `e2e/fixtures/auth.ts`. CI (`.github/workflows/e2e.yml`) runs this on every PR but with `continue-on-error: true` — it does **not** gate merges today (pre-existing CI/auth environment issue), so don't treat a red e2e run as a hard blocker, but do still extend the suite for new isolation-sensitive behavior (new override/pricing endpoints).
  - Neither suite runs automatically via CLAUDE.md's standard `typecheck && test && build` — both are separate, explicit commands to run per phase.

## Open decisions resolved from the spec/screenshots directly (flag if wrong when reviewing)

- **`companies.status`**: expand to the spec's exact 5-state list — Pending / Active / On Hold / Suspended / Archived. Spec §1 states On Hold and Suspended both "prevent new orders but should not remove access to existing projects and order history" — treat them as functionally identical for order-blocking purposes; On Hold additionally gets the reason/review-date/hold-details tracking the screenshot shows (screen 14), Suspended does not need to (no such screen was shown for it).
- **Override "Approved by"**: spec §6 lists it as a stored field, and neither the spec text nor the screenshot describes a pending-approval gate (override status shown is only Active/Scheduled/Expired, derived from dates) — treat `approved_by`/`approved_at` as audit-only metadata set at creation/edit time by whoever has permission, not a second workflow state. The Access Permissions screenshot's BDM row showing "Request" for Overrides suggests a lower-privileged role can *request* one but not create it directly — worth a lightweight `pending_review` concept only if BDM-initiated requests turn out to be in scope; default to skipping it (Internal Sales/Super Admin only can write overrides directly per the permissions grid).
- **Invitation expiry default**: mockup screen 07's "Invitation Rules" panel explicitly states "expires after five days" — change the schema default from 14 days to 5.
- **Access Permissions page**: a curated read view (screen 11's Full/View/Assigned/Request/Limited/Hidden/No labels per role/capability), backed by existing `role_permissions`/`has_permission()` data via a new client-side `capabilityLabelMap.ts`, not a new grant model and not a rewrite of `AdminRolesPage.tsx`.
- **Order/quote price-freeze fields**: spec §9's list (product description/code, qty, unit, unit price, price source, discount, tax, line total, price-list version, override used) maps onto additive fields in the existing `orders.line_items` jsonb array element shape, plus one new `orders.price_list_version_id` column — not a new snapshot table, consistent with this schema's existing "whole array as one jsonb column" convention (see the comment already on `orders.line_items`).

---

## Phase 1 — Workspace shell, routing, Control Room — DONE

**Scope.** New top-level workspace nav + shell + a Control Room dashboard reading only data that already exists (company/user/invitation/price-list counts). Action-queue items depending on not-yet-built data (override expiring soon, price list ready to publish) render empty/hidden with an inline comment noting which later phase wires them for real — never fake data.

**What actually shipped.**
- `src/appShell/useHashRoute.ts`: new `AccountsSubPage` union (`controlRoom | companies | companyUsers | invitations | companyPricing | priceLists | permissions | auditHistory`), `{ tab: "accounts"; sub: AccountsSubPage }` `Route` variant, `ACCOUNTS_SUBPAGES` array, `parseHash`/`routeToHash` cases mirroring `AdminSubPage`'s handling exactly.
- **IA decision made concretely, not just discussed**: "admin" is deliberately excluded from `topNav.tsx`'s `TOP_NAV_ITEMS` (reached via `AuthStatus.tsx`'s account dropdown instead) — the new workspace follows that exact same precedent rather than adding a `TOP_NAV_ITEMS` entry. `TopNavTab` gained `"accounts"` purely for type-compatibility with `route.tab` (same reason `"admin"`/`"company"`/`"myRequests"` are already in that union without ever matching a nav button). `AuthStatus.tsx` gained a second staff-only dropdown item, "Company Accounts & Pricing" (`Building2` icon), right below "Admin"; the dropdown widened from `w-48` to `w-60` to fit the longer label without an awkward wrap.
- `src/pages/accounts/AccountsRoot.tsx` — a hybrid of `AdminRoot.tsx`'s pattern (route.sub-driven dispatch, `AdminGate`-gated on `isInternalStaff`) and `AdminProjectsAdministrationPage.tsx`'s pattern (a persistent left sidebar owned by the page itself, since every one of this workspace's 14 screens shares the identical sidebar, unlike Admin's per-section-owned sidebars). One file does both — no separate `AccountsSidebar.tsx` was worth splitting out, since the nav config/JSX is only ever used here. Per-section `admin.section.*`-style permission gating is deferred (the plan itself says this is optional for Phase 1); the whole workspace is gated on `isInternalStaff` only for now, same as `AdminGate`.
- `src/pages/accounts/accountsTheme.css` — **a lighter-weight scoped theme than the other ported admin themes on purpose**: unlike `.pa-shell`/`.est-shell` (each sourced from a *separate* UI-DESIGNS mockup bundle with genuinely different hex values from the site's own brand), this module's screenshots are the live app's *own* real branding ("uses the supplied desktop open-project page as the visual reference") — so `.cap-shell` does NOT shadow `--navy`/`--blue`/etc with an invented palette. It reads the site-wide tokens directly and only adds new component classes for shapes with no existing equivalent: `.cap-side`/`.cap-nav` (closely mirrors `.pa-side`/`.pa-nav`'s dark-rail-with-active-highlight shape) and `.cap-kpi`/`.cap-queue-item`/`.cap-allocation-item` (screenshot-specific tile/list shapes). Still imports `ui/scopedThemeTokens.css` for the handful of genuinely shared `--sp-*` tokens (surface/line/muted/bg colours). Built incrementally — only what Phase 1's Control Room needs exists so far; later phases add their own classes as their screens get built, not speculatively now.
- `src/pages/accounts/ControlRoomPage.tsx` + `controlRoomStore.ts` — real KPI tiles (active companies, external users, pending invitations, active price lists) and a real Price List Allocation breakdown, all read via plain Supabase queries (confirmed live: `companies`/`company_memberships`/`invitations`/`price_lists` each already carry an `or public.is_admin()` clause on their own SELECT RLS policy, so no new RPC was needed for Phase 1, matching the plan's own "Backend: None" expectation). The screenshots' "Module Owner"/"Pricing Administrators" owner cards and the override-expiring/price-list-ready action-queue items were deliberately omitted rather than faked — there's no per-module ownership-assignment concept in the backend, and no override/version data exists yet (Phases 6–9). Only "N invitations pending" and "N companies on hold" (using today's existing 3-value status enum, ahead of Phase 2's 5-value expansion) are shown, each with an inline comment marking where the deferred items get wired in later.
- `src/App.tsx` — `AccountsRoot` lazy-loaded the same way `AdminRoot` is (separate bundle chunk, confirmed in the build output: `AccountsRoot-*.js`/`.css` split cleanly from the main bundle and from `AdminRoot`'s own chunk), rendered for `route.tab === "accounts"` inside the same `<Suspense>` pattern.
- Reused `PlaceholderPage.tsx` (the app's existing "not-yet-built admin route" stub) for the other 7 sub-pages, each with a description naming which later phase replaces it — swapped out page-by-page as those phases land, same convention that component already documents for the Admin section.

**Verified live** (Playwright against a local Supabase instance, `admin@e2e.test`): account-dropdown shortcut opens the workspace; all 8 sidebar nav items present and route correctly (`#/accounts`, `#/accounts/companies`, etc.); active-item highlighting follows `route.sub`; KPI tiles render real live counts (not placeholders); placeholder sub-pages render without crashing; light AND dark mode both screenshotted and correctly themed; responsive breakpoint (`.cap-layout` collapses to a single column below 900px) confirmed with zero horizontal overflow at 820px width. Full verification suite (typecheck/test/build/depcruise) clean, 187 tests passing, 0 new dependency-cruiser errors (28 pre-existing warnings unchanged).

---

## Phase 2 — Companies list + Company Overview shell + companies schema catch-up

**Scope.** Real Companies list + Company Overview page (Overview tab only — other tabs are placeholders here, built out in later phases). Extend `companies` with whatever Account-step fields the spec defines that don't exist yet (pull exact field names from the spec doc, not this plan) and expand `status` to the 5-state model — **schema only, no enforcement wiring yet** (that's Phase 11, kept separate on purpose).

**Backend.**
- `alter table companies` for new Account-step columns + expanded `status` check constraint.
- New `admin_set_company_status(p_company_id uuid, p_status text, p_reason text)` RPC — `has_permission('companies.set_status')`-gated, logs via `log_audit()` with new `company_status_changed` event type (add to `EVENT_TYPE_LABELS`).
- New permission key `companies.set_status`.
- Extend `admin_create_company`'s params additively (backward compatible with the old 3-step wizard call shape during the transition).
- `AdminCompanyWizard.tsx`'s existing 3 steps (Company Details → Customer Users → Assign Speedpanel Team) become the new 6-step wizard's first 3 (Company Details → Account → Primary User); still commit-per-step for now (draft-autosave-before-final-commit is a stretch goal, not a blocker — Addresses/Pricing steps can't exist until Phases 3/9 land anyway).

**Frontend.** `src/pages/accounts/companies/CompaniesListPage.tsx`, `CompanyWizard.tsx` (extends `AdminCompanyWizard.tsx`'s pattern/reuses `useAdminCreateCompany`, not a rewrite), `CompanyOverviewPage.tsx` + tab shell (`ui/tabs.tsx`'s `Tabs`/`TabPanel`). Extend `src/pages/admin/companies/companiesStore.ts` in place (import from both old and new locations during the transition) rather than duplicating it.

**Dependencies.** Phase 1.

**Verification.** Standard triad; new `supabase/tests/database/08_company_status.test.sql`; live Playwright pass creating a company through the new wizard, viewing Overview, changing status.

---

## Phase 3 — Company Addresses

**Scope.** New `company_addresses` table (billing/delivery/office typing, default flags, delivery-contact fields) + Addresses tab on Company Overview + the wizard's Addresses step. This is genuinely new — today `companies.address` is one text field. Existing `order_deliveries` freeze behavior (Phase note above) needs zero changes — this table is purely a picker source for pre-filling that form.

**Backend.**
```sql
create table company_addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null check (type in ('billing','delivery','office')),
  is_default boolean not null default false,
  line1 text not null, line2 text, suburb text, state text, postcode text,
  delivery_contact_name text, delivery_contact_phone text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index company_addresses_one_default_per_type on company_addresses (company_id, type) where is_default;
```
(exact field set to confirm against spec text). New RPCs: `company_list_addresses`, `admin_set_company_address` (upsert), `admin_delete_company_address`, `admin_set_default_address`. New permission keys `company_addresses.read`/`company_addresses.write`. RLS: `is_company_admin(company_id)` write-gate (existing precedent), active-membership read (mirrors `staff_assignments`' read policy).

**Frontend.** `src/pages/accounts/companies/CompanyAddressesTab.tsx`, `companyAddressesStore.ts`, wizard's Addresses step.

**Dependencies.** Phase 2.

**Verification.** Standard triad; new pgTAP file for the one-default-per-type constraint + cross-company isolation (extend `02_company_isolation.test.sql`'s pattern); live Playwright pass add/edit/delete + default-flag exclusivity.

---

## Phase 4 — Company Users tab

**Scope.** Restyle `CompanyMemberList.tsx` (308 lines, already implements roster/invite/role-change/suspend/remove/resend against real data) into the new module's Users tab — overwhelmingly reuse, minimal-to-no new backend.

**Backend.** None expected — `CompanyMemberRowSchema` already returns `assigned_project_count`; verify the mockup's "Project Access" column needs nothing further before assuming a change is needed.

**Frontend.** `src/pages/accounts/companies/CompanyUsersTab.tsx` wrapping `CompanyMemberList.tsx` in the new module's chrome (same component, new container styling — not a fork).

**Dependencies.** Phase 2.

**Verification.** Standard triad; live Playwright pass re-testing invite/role-change/suspend/resend inside the new tab (a restyle can silently break a click handler — don't just trust it compiled, per this session's own recent "functional wiring audit" precedent on the estimator).

---

## Phase 5 — Standalone Invitations page + "Delivery Failed" status

**Scope.** Cross-company Invitations page (today invitations only surface per-company) + a genuinely new "Delivery Failed" invitation status (confirmed absent from both the schema and the Edge Function's error handling — a real send failure currently deletes the just-inserted row and returns a synchronous error, nothing persisted).

**Backend.**
- `invitations.status` check constraint: add `'delivery_failed'`.
- New `invitations.failure_reason text` (nullable).
- `supabase/functions/company-invite-member/index.ts` (and `admin-invite-user`): on a real `inviteUserByEmail` failure (not "already registered"), update the row to `delivery_failed` + failure_reason instead of deleting it — both the initial-invite and resend code paths need this.
- New `admin_list_invitations(p_company_id uuid default null, p_status text default null)` RPC, cross-company, new `invitations.list` permission key.
- New `admin_fix_invitation_email(p_invitation_id uuid, p_new_email text)` RPC (resets to pending, clears failure_reason, re-triggers send).
- Change `invitations.expires_at` default from 14 days to 5 (per mockup copy).

**Frontend.** `src/pages/accounts/invitations/InvitationsPage.tsx` + tabs, `invitationsStore.ts`, delivery-failure detail/fix-email panel.

**Dependencies.** Phase 1 only — independent of Phases 2–4, can run in parallel across sessions if useful.

**Verification.** Standard triad; new pgTAP coverage for the status transition + cross-company list RPC's permission gate; extend `e2e/admin-invite-flow.spec.ts` with a forced-failure case confirming the row lands in `delivery_failed` (not deleted), then that fix-email/resend clears it.

---

## Phase 6 — Price-list versioning schema (backend only, no new UI)

**Scope.** The highest-risk phase — restructure `price_lists`/`price_list_prices` from one flat, live-edited row into a versioned model, **while keeping the existing `AdminPriceListsPage.tsx` working throughout** (it's live and used today; this is a hard backward-compatibility requirement, not optional).

**Schema.**
```sql
create table price_list_versions (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references price_lists(id) on delete cascade,
  version_number int not null,
  status text not null check (status in ('draft','scheduled','active','expired','archived')),
  effective_date date,
  notes text,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  published_at timestamptz, published_by uuid references auth.users(id),
  unique (price_list_id, version_number)
);
create unique index price_list_versions_one_active on price_list_versions (price_list_id) where status = 'active';
```
- Add `price_list_prices.price_list_version_id` (additive column, migrate, then drop the old `price_list_id` column in a later sub-step within this phase once nothing reads it — never a single risky rename).
- Data migration: one `price_list_versions` row per existing `price_lists` row (`version_number=1, status='active', effective_date=today`), repoint existing `price_list_prices` rows at it.
- `companies.price_list_id` **stays pointed at the logical `price_lists.id`**, not a version — add a `current_price_list_prices(price_list_id)` view/function (security invoker, joins `price_list_versions where status='active'`) that `applyEffectivePricing`'s callers read instead of `price_list_prices` directly.
- Immutability: a trigger on `price_list_prices` rejecting writes against a row whose version is `status='active'`.
- New RPCs: `admin_create_draft_version(p_price_list_id, p_from_version_id default null)`, `admin_set_draft_price(p_version_id, ...)` (replaces `admin_set_price_list_price` for version-scoped writes — cut over atomically in this same commit, don't run two parallel write paths into the same table).
- New permission keys: `price_lists.create_draft`, `price_lists.publish`, `price_lists.schedule`.
- **Scheduled-activation decision** (Phase 8's concern, but the schema needs to support whichever is chosen): lean lazy on-read check (`effective_date <= current_date` in the "active version" resolution logic) over introducing `pg_cron` as a new dependency — no existing precedent either way, this is a from-scratch call.

**Frontend.** Minimal — only what keeps `AdminPriceListsPage.tsx` compiling/working against the new RPC names (its "edit in place" UX now implicitly targets that list's current draft, auto-creating one via `admin_create_draft_version` on first edit if none exists — a stopgap until Phase 7's real draft/compare/publish UX).

**Dependencies.** None from the accounts module, but this is a live-table production migration — highest care of any phase.

**Verification.** Standard triad; new pgTAP file for the immutability trigger + one-active-version-per-list invariant; live Playwright pass confirming `AdminPriceListsPage.tsx` still works end-to-end (edit price, CSV import/export) after cutover, not just typechecks.

---

## Phase 7 — Price Lists library + draft editor UI

**Scope.** New Price Lists page (Overview/Price Lists/Draft Versions/Scheduled/Archived tabs, library table, company-allocation breakdown) + price-list detail/draft editor (Product Prices/Details/Visibility/Company Impact/Publish tabs, version-diff table, draft-validation checklist, CSV import into a draft).

**Backend.** `admin_list_price_list_versions(p_price_list_id)`, `admin_diff_price_list_versions(p_from_version_id, p_to_version_id)` (per-product old/new price + Changed/Unchanged — build once, reuse in Phase 8's Compare screen). Validation (duplicate lines impossible given the unique index; negative/zero and large-change-% detection) can be pure client-side over the diff RPC's output.

**Frontend.** `src/pages/accounts/priceLists/PriceListsPage.tsx`, `PriceListVersionEditor.tsx` (reuses `priceListCsv.ts`'s `parsePriceListCsv`/`exportPriceListCsv` verbatim, only `priceListsStore.ts`'s param needs to shift from `price_list_id` to `price_list_version_id`), `priceListVersionsStore.ts`.

**Dependencies.** Phase 6.

**Verification.** Standard triad; live Playwright pass: create draft → edit prices → CSV import into it → confirm the active version is genuinely read-only in the UI (not just server-rejected).

---

## Phase 8 — Compare & Publish

**Scope.** Version-diff table with company-impact counts, Normal/Review flag per line (large % change), publication-approval note, Publish action, and the scheduled-activation decision from Phase 6 actually implemented (lazy on-read check, recommended).

**Backend.** `admin_publish_price_list_version(p_version_id, p_approval_note)` — validates no concurrent publish in flight, flips outgoing active version to `expired`, target to `active` (immediately) or leaves at `scheduled` (future `effective_date`, resolved via the lazy-check function/view at read time — no cron job). Logs `price_list_version_published` audit event with company-impact counts in `detail`.

**Frontend.** `src/pages/accounts/priceLists/ComparePublishPage.tsx`.

**Dependencies.** Phase 7.

**Verification.** Standard triad; pgTAP test that the one-active-version invariant survives a publish (never two actives, never zero visible mid-transaction); live Playwright pass through create→edit→compare→publish→confirm old version `expired`, new one `active`, and Phase 6's `AdminPriceListsPage.tsx` stopgap targets a fresh draft again.

---

## Phase 9 — Method 2: item-level company price overrides

**Scope.** `company_price_overrides` table + Company Pricing tab (override table, pricing-priority explainer, live Customer Price Preview, expiry warning) + the 3-tier priority actually wired into pricing resolution.

**Backend.**
```sql
create table company_price_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  category text not null check (category in ('panel','track','fixing','sealant')),
  panel_id uuid references panels(id), track_id uuid references tracks(id),
  fixing_id uuid references fixings(id), sealant_id uuid references sealants(id),
  override_price numeric not null,
  effective_date date not null default current_date,
  expiry_date date,
  internal_reason text,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  approved_by uuid references auth.users(id), approved_at timestamptz,
  check ( /* same one-of-four-FKs pattern as price_list_prices */ )
);
create unique index company_price_overrides_unique on company_price_overrides
  (company_id, category, coalesce(panel_id, track_id, fixing_id, sealant_id))
  where expiry_date is null or expiry_date >= current_date;
```
Active/Scheduled/Expired is derived from `effective_date`/`expiry_date` at read time, never stored (matches the mockup's own description — only genuinely stateful lifecycles like `price_list_versions.status` get an explicit column). New RPCs: `company_list_price_overrides(p_company_id)`, `admin_set_company_price_override`, `admin_delete_company_price_override`. New permission keys `company_price_overrides.read`/`.write`.

**`applyEffectivePricing.ts` gets its 3rd, highest-priority tier**: `override ?? assignedList ?? fallback ?? existing`. Audit and update every current caller (pricing preview, order pricing, Excel export), not just the obvious one.

**Frontend.** `src/pages/accounts/companies/CompanyPricingTab.tsx`, `companyPriceOverridesStore.ts`, `PricingPriorityExplainer.tsx`, `CustomerPricePreview.tsx`.

**Dependencies.** Phase 2 (Overview shell); land after Phase 6 so "assigned price list" correctly means "assigned list's active version."

**Verification.** Standard triad; pgTAP for the one-active-override-per-product index + cross-company isolation; extend the existing `applyEffectivePricing.test.ts` with an override-present case; live Playwright pass setting an override and confirming both the Customer Price Preview and a real estimate/order reflect it.

---

## Phase 10 — Order price freeze

**Scope.** Close the confirmed gap: order creation is a bare RLS insert with no server-side price re-verification (the schema's own comment already flags this as a known, pre-existing tampering/staleness gap). Address freezing needs **no work** — `order_deliveries` already stores addresses as plain text, not a live FK.

**Backend.**
- Extend `orders.line_items` jsonb element shape additively: `priceSource: "override"|"price_list"|"default"`, `priceListVersionId`, `overrideId` (all optional — old rows without them still parse fine, matching this app's existing "patch missing fields on read" precedent from the estimator merge).
- New `orders.price_list_version_id` column (nullable), set at creation time.
- **Convert order creation from a bare RLS insert to an RPC** (`create_order(p_project_id, p_line_items, ...)`) that re-resolves each line item's price server-side against `company_price_overrides`/the assigned list's active version/default, rejecting (or flagging `matched: false`, mirroring the existing pattern) a client-submitted price that doesn't match — this is the actual fix, not a smaller trigger-based patch, since there's currently no RPC boundary at all for initial creation to hook into. This is a bigger, riskier change than the rest of this phase; consider splitting it into its own sub-phase if it grows.
- `revise_order` (existing RPC) gets the same re-resolution check added.

**Frontend.** Small, low-risk: show price source on order/quote-review UI (`OrderReviewDrawer.tsx`/`projectOrderSheet.tsx`) — display-only addition, keep this phase backend-heavy.

**Dependencies.** Phase 6 (price_list_versions), Phase 9 (company_price_overrides).

**Verification.** Standard triad; dedicated pgTAP file — this is the phase closing a documented security/correctness gap, so test that a fabricated client-sent `unitPriceExGst` gets rejected/corrected server-side; live Playwright pass placing an order, then changing the assigned list's active version or an override, confirming the already-placed order's displayed pricing is unchanged.

---

## Phase 11 — companies.status enforcement (On Hold / Suspended / Pending)

**Scope.** Make `companies.status` (expanded in Phase 2) actually gate something: On Hold/Suspended block new quote/order creation while preserving read access to existing projects/order history; Pending drives the onboarding-progress stepper; a real hold audit trail (reason/review-date, mockup screen 14).

**Backend.**
- Extend `can_submit_orders(...)` with an early-exit clause: if the company's status is `on_hold`/`suspended`, return `false` regardless of the existing owner/admin checks (layer on top, don't rewrite).
- `companies` gains `hold_reason text`, `hold_applied_by uuid`, `hold_placed_at timestamptz`, `hold_review_date date` (nullable, populated only while `status='on_hold'`), set/cleared inside Phase 2's `admin_set_company_status` RPC.
- Onboarding completion as a computed function (`company_onboarding_progress(company_id)` returning per-step booleans: legal_name+abn present, has an owner membership, has ≥1 default address, has a price list or ≥1 override) rather than a stored/maintained percentage.

**Frontend.** Pending Setup stepper + activation checklist, On Hold banner + restrictions list + hold-details card on `CompanyOverviewPage.tsx`; the external-user-facing block message on the customer-facing side (`src/pages/company/`) — real customer-visible copy, review against spec carefully.

**Dependencies.** Phase 2, Phase 3 (addresses), Phase 9 (pricing) — the onboarding checklist needs both.

**Verification.** Standard triad; extend `03_project_and_order_access.test.sql`'s pattern with an On-Hold-company order-blocked case; live Playwright pass as both a staff user (placing a hold) and an external customer of that company (confirm read access intact, new-order/quote creation blocked with correct message).

---

## Phase 12 — Access Permissions (curated view)

**Scope.** The curated per-role capability grid (screen 11) on top of existing `role_permissions` data.

**Backend.** None new — reads `admin_list_permission_matrix()` (existing) plus every permission key seeded by prior phases.

**Frontend.** `src/pages/accounts/permissions/AccessPermissionsPage.tsx` + `capabilityLabelMap.ts` (translates `(permission_key, role) → curated label`, defined once every prior phase's keys are known — why this phase is sequenced near the end), static "Pricing Protection" panel, static "Account Restrictions" panel (documents Phase 11's behavior).

**Dependencies.** Every phase adding a permission key (2, 3, 5, 6/7/8, 9, 11).

**Verification.** Standard triad; a real security review pass (not just functional click-through) — grep every RPC return shape and RLS policy reachable by a non-staff `company_memberships` role, confirm cost price/gross margin/supplier pricing/internal notes are genuinely never sent to an external-customer client, not just hidden in the UI.

---

## Phase 13 — Audit History (standalone) + pricing audit events + Transaction Price Trace

**Scope.** Cross-company Audit History page (searchable events, Transaction Price Trace sidecard, required-audit-data checklist) + the missing pricing-specific `EVENT_TYPE_LABELS` entries and their `log_audit()` call sites.

**Backend.** New event types at the right call sites: `price_list_assigned` (`admin_set_company_price_list`), `price_list_version_published` (Phase 8), `item_override_added/changed/removed` (Phase 9), `pricing_used_in_order` (Phase 10 — backs the Transaction Price Trace), `company_status_changed` (Phase 2/11), `company_address_added/changed/removed` (Phase 3). New cross-company `admin_list_audit_log(p_filters...)` RPC (today's is per-company only), new `audit.list_all` permission key. Transaction Price Trace reads directly off Phase 10's frozen `orders.line_items`/`price_list_version_id`/override fields — no new storage.

**Frontend.** `src/pages/accounts/audit/AuditHistoryPage.tsx`, `TransactionPriceTrace.tsx`.

**Dependencies.** Phases 9, 10, plus every phase contributing an event type.

**Verification.** Standard triad; live Playwright pass performing one action per earlier phase (add override, publish version, place order, put company on hold) confirming each produces the right audit row with actor+timestamp+old/new values.

---

## Phase 14 — Retirement of old pages + full mockup-parity audit

**Scope.** Cleanup, sequenced last on purpose (same reasoning as the estimator merge plan's own final phase — never delete a working fallback before its replacement has verified parity): retire `AdminCompaniesPage.tsx`/`AdminCompanyWizard.tsx`/`AdminPriceListsPage.tsx`'s old routes (delete or redirect, matching the existing `#/quote` redirect precedent in `useHashRoute.ts`), remove dead code (`admin_set_price_list_price` if fully superseded), and do a section-by-section visual audit against all 14 screenshots (web/iPad/phone, light/dark) the same way the estimator plan's mockup-parity audits worked.

**Dependencies.** All prior phases.

**Verification.** Full `typecheck/test/build/depcruise` + `npm run test:rls` + `npm run test:e2e`; full visual diff pass against every screenshot; confirm no dangling references to retired RPCs/components via `depcruise` + a grep sweep.

---

## Critical files

- `supabase/schema.sql` — companies/company_memberships/invitations/price_lists/price_list_prices/permissions/role_permissions/orders/order_deliveries sections
- `src/appShell/useHashRoute.ts`
- `src/pages/admin/AdminRoot.tsx`, `adminSections.tsx`, `adminSectionAccess.ts`
- `src/export/applyEffectivePricing.ts` (+ its test file)
- `src/pages/admin/priceLists/priceListTypes.ts`, `priceListsStore.ts`, `priceListCsv.ts`
- `src/pages/company/companyTypes.ts`, `staffTypes.ts`, `CompanyMemberList.tsx`
- `supabase/functions/company-invite-member/index.ts`
- `src/pages/admin/companies/AdminCompanyWizard.tsx`
- `src/pages/accounts/AccountsRoot.tsx`, `accountsTheme.css` (Phase 1 -- the new workspace's own shell)
- `supabase/tests/database/*.test.sql` (numbered convention, `npm run test:rls`)
- `e2e/*.spec.ts`, `e2e/fixtures/auth.ts` (`npm run test:e2e`)

## Verification (every phase)

`npm run typecheck && npm test && npm run build` (mandatory, CLAUDE.md standing rule) plus a live Playwright pass against a local Supabase instance (per CLAUDE.md's sandboxed-verification recipe) before considering any phase done. Add a numbered pgTAP file (`supabase/tests/database/NN_....test.sql`, run via `npm run test:rls`) for any phase touching RLS/RPCs. Extend `e2e/*.spec.ts` for any phase touching cross-company isolation or invitation delivery (`npm run test:e2e`, not CI-blocking today but still worth running locally). Phase 6 and Phase 10 are the two most likely to need splitting further once inside them — budget for that rather than forcing either into one commit.
