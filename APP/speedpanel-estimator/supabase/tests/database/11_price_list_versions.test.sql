-- =============================================================================
-- Company Accounts & Pricing Phase 6 -- price_list_versions: the one-active-
-- version-per-list invariant, draft-only mutability (the immutability
-- trigger), the draft-create/set/delete RPCs, current_price_list_prices()'s
-- active-only resolution, the rewritten company-member read policy's
-- draft-visibility gap being closed, and the new permission keys' gate.
-- =============================================================================
-- Same set_config('request.jwt.claims', ...) session-simulation technique as
-- 02_company_isolation.test.sql/07_delivery_allocation.test.sql/etc -- real
-- RLS, no service-role bypass. Everything here runs inside one transaction,
-- rolled back at the end.
-- =============================================================================
begin;
select plan(20);

-- Fixtures, run as the unrestricted connecting role (before the
-- `set local role authenticated` switch below), same convention
-- 07_delivery_allocation.test.sql/10_invitations.test.sql already establish
-- for writes that would otherwise be blocked by RLS/triggers that haven't
-- been set up to allow them yet -- panels has no seed data in this repo at
-- all (populated only via the admin UI against a real project), so a
-- priceable product needs its own fixture row here.
insert into panels (id, type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack)
values ('eeeeeeee-0000-0000-0006-000000000001', 51, 'Test P51', '150mm', '-/60/60', 10, 1, '64x38', '64x38', 3000, 6000, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

-- PL1 - Standard's own active version has zero real price rows in this repo
-- (its backfill selects from panels/tracks/fixings/sealants, all empty here
-- -- populated only via the admin UI against a real project) -- give it one
-- real, known active-version price row so the immutability-trigger and
-- read-visibility assertions below have something concrete to target.
insert into price_list_prices (price_list_version_id, category, panel_id, price)
  select id, 'panel', 'eeeeeeee-0000-0000-0006-000000000001', 40
  from price_list_versions where price_list_id = (select id from price_lists where is_default) and status = 'active'
on conflict do nothing;

-- The immutability trigger fires regardless of role (BEFORE UPDATE/DELETE
-- triggers always fire), but price_list_prices has no write RLS policy at
-- all ("admin_* RPCs only") -- run these two as the unrestricted role so the
-- write actually reaches the trigger to prove IT rejects the change, not
-- just that RLS would have. Targets PL1 - Standard's own seeded/backfilled
-- active-version row (schema.sql's migration guarantees at least one).
select throws_ok(
  $$ update price_list_prices set price = 999
       where id = (select plp.id from price_list_prices plp join price_list_versions plv on plv.id = plp.price_list_version_id
                    where plv.status = 'active' and plv.price_list_id = (select id from price_lists where is_default) limit 1) $$,
  'P0001', 'Cannot modify prices on an active price list version -- create a draft first',
  'immutability trigger: a direct UPDATE against an active version''s price is rejected'
);
select throws_ok(
  $$ delete from price_list_prices
       where id = (select plp.id from price_list_prices plp join price_list_versions plv on plv.id = plp.price_list_version_id
                    where plv.status = 'active' and plv.price_list_id = (select id from price_lists where is_default) limit 1) $$,
  'P0001', 'Cannot modify prices on an active price list version -- create a draft first',
  'immutability trigger: a direct DELETE against an active version''s price is rejected'
);

set local role authenticated;

-- super_admin: admin_create_price_list() also creates version 1 as active.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select lives_ok(
  $$ select admin_create_price_list('Test PL 6') $$,
  'super_admin: admin_create_price_list() succeeds'
);
select is(
  (select count(*)::int from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 6') and status = 'active'),
  1, 'admin_create_price_list() also creates an initial active version'
);

select lives_ok(
  $$ select admin_set_company_price_list('eeeeeeee-0000-0000-0001-000000000001', (select id from price_lists where name = 'Test PL 6')) $$,
  'super_admin: admin_set_company_price_list() assigns Test PL 6 to Company A'
);

-- Writes are draft-only: targeting the freshly-created ACTIVE version
-- directly (never a draft) is rejected by admin_set_draft_price's own
-- pre-check.
select throws_ok(
  $$ select admin_set_draft_price((select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 6') and status = 'active'), 'panel', 'eeeeeeee-0000-0000-0006-000000000001', 50) $$,
  'P0001', 'Prices can only be set on a draft version',
  'admin_set_draft_price() rejects a target version that is not a draft'
);

select lives_ok(
  $$ select admin_create_draft_version((select id from price_lists where name = 'Test PL 6')) $$,
  'super_admin: admin_create_draft_version() succeeds'
);
select is(
  (select count(*)::int from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 6') and status = 'draft'),
  1, 'admin_create_draft_version() created exactly one draft'
);

select lives_ok(
  $$ select admin_set_draft_price((select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 6') and status = 'draft'), 'panel', 'eeeeeeee-0000-0000-0006-000000000001', 77) $$,
  'super_admin: admin_set_draft_price() succeeds against a real draft'
);

-- The one-active-version-per-list invariant survives a draft existing
-- alongside it (the partial unique index only constrains status = 'active').
select is(
  (select count(*)::int from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 6') and status = 'active'),
  1, 'exactly one active version remains after creating a draft'
);
-- ...and is enforced at the database level, not just by RPC logic -- a raw
-- insert of a second active version for the same list is rejected outright.
-- price_list_versions has no insert policy at all ("admin_* RPCs only"), so
-- (same reasoning as the immutability-trigger writes above) this needs the
-- unrestricted connecting role to actually reach the unique index rather
-- than being turned away by RLS first.
reset role;
select throws_ok(
  $$ insert into price_list_versions (price_list_id, version_number, status, created_by)
       values ((select id from price_lists where name = 'Test PL 6'), 99, 'active', 'eeeeeeee-0000-0000-0000-000000000001') $$,
  '23505', 'duplicate key value violates unique constraint "price_list_versions_one_active"',
  'raw insert: a second active version for the same list violates price_list_versions_one_active'
);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);

-- The draft's new price never leaks into "today's real prices" -- neither
-- the invoker-security resolution function nor the library table's count.
select is(
  (select count(*)::int from current_price_list_prices((select id from price_lists where name = 'Test PL 6'))),
  0, 'current_price_list_prices() excludes an unpublished draft''s prices'
);
select is(
  (select product_count from admin_list_price_lists() where id = (select id from price_lists where name = 'Test PL 6')),
  0::bigint, 'admin_list_price_lists() product_count reflects only the active version, not a draft in progress'
);

-- admin_delete_draft_price() has the same draft-only guard as
-- admin_set_draft_price() -- rejected against PL1's active-version row...
select throws_ok(
  $$ select admin_delete_draft_price(
       (select plp.id from price_list_prices plp join price_list_versions plv on plv.id = plp.price_list_version_id
          where plv.status = 'active' and plv.price_list_id = (select id from price_lists where is_default) limit 1)) $$,
  'P0001', 'Prices can only be deleted from a draft version',
  'admin_delete_draft_price() rejects a row belonging to an active version'
);
-- ...but succeeds against the real draft row set earlier.
select lives_ok(
  $$ select admin_delete_draft_price(
       (select id from price_list_prices where price_list_version_id =
         (select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 6') and status = 'draft'))) $$,
  'super_admin: admin_delete_draft_price() succeeds against a real draft row'
);

-- dispatch has no price_lists.create_draft/price_lists.set_price grant
-- (both new/reused keys, zero seeded role_permissions rows for dispatch --
-- super_admin grandfather bypass only, same posture every other price_lists.*
-- key already has).
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select throws_ok(
  $$ select admin_create_draft_version('00000000-0000-0000-0000-000000000000'::uuid) $$,
  'P0001', 'Not authorized',
  'dispatch: admin_create_draft_version() denied -- no price_lists.create_draft grant'
);
select throws_ok(
  $$ select admin_set_draft_price('00000000-0000-0000-0000-000000000000'::uuid, 'panel', '00000000-0000-0000-0000-000000000000'::uuid, 1) $$,
  'P0001', 'Not authorized',
  'dispatch: admin_set_draft_price() denied -- no price_lists.set_price grant'
);

-- Company A's own owner (sub 0007, non-staff) can see their assigned list's
-- ACTIVE version metadata but not its draft-in-progress -- the real gap
-- Phase 6's rewritten "Company members can read their assigned list's
-- prices" policy (and the new price_list_versions policies) closes: before
-- this migration there was only ever one version per list, so this
-- distinction didn't exist yet.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000007')::text, true);
select is(
  (select count(*)::int from price_list_versions where price_list_id = (select price_list_id from companies where id = 'eeeeeeee-0000-0000-0001-000000000001') and status = 'draft'),
  0, 'company owner: their assigned list''s draft version metadata is not visible via RLS'
);
select is(
  (select count(*)::int from price_list_versions where price_list_id = (select price_list_id from companies where id = 'eeeeeeee-0000-0000-0001-000000000001') and status = 'active'),
  1, 'company owner: their assigned list''s active version metadata IS visible'
);
select ok(
  (select count(*)::int from price_list_prices plp join price_list_versions plv on plv.id = plp.price_list_version_id
     where plv.price_list_id = (select id from price_lists where is_default) and plv.status = 'active') > 0,
  'company owner: can still read the default list''s active-version prices (fallback path unaffected)'
);

select * from finish();
rollback;
