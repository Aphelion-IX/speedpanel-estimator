-- =============================================================================
-- Company Accounts & Pricing Phase 8 -- admin_publish_price_list_version():
-- the one-active-version invariant surviving a publish, the draft-only
-- precondition, the no-concurrent-scheduled-publish guard, and the lazy
-- on-read scheduled-activation resolution (current_price_list_version_id()/
-- current_price_list_prices() correctly picking up a 'scheduled' version
-- once its effective_date has passed, with no cron job / background sweep).
-- =============================================================================
-- Same set_config('request.jwt.claims', ...) session-simulation technique as
-- 02_company_isolation.test.sql/11_price_list_versions.test.sql/etc -- real
-- RLS, no service-role bypass. Everything here runs inside one transaction,
-- rolled back at the end.
-- =============================================================================
begin;
select plan(19);

-- Fixture, run as the unrestricted connecting role (before the
-- `set local role authenticated` switch below) -- panels has no seed data
-- in this repo at all, same reasoning 11_price_list_versions.test.sql's own
-- fixture comment already documents.
insert into panels (id, type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack)
values ('eeeeeeee-0000-0000-0006-000000000002', 51, 'Test P51 (Phase 8)', '150mm', '-/60/60', 10, 1, '64x38', '64x38', 3000, 6000, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin

select lives_ok(
  $$ select admin_create_price_list('Test PL 8') $$,
  'super_admin: admin_create_price_list() succeeds'
);
select lives_ok(
  $$ select admin_set_company_price_list('eeeeeeee-0000-0000-0001-000000000001', (select id from price_lists where name = 'Test PL 8')) $$,
  'super_admin: assigns Test PL 8 to Company A'
);

-- v1 (active, from creation) can't itself be published -- only a draft can.
select throws_ok(
  $$ select admin_publish_price_list_version((select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and status = 'active'), null, null) $$,
  'P0001', 'Only a draft version can be published',
  'admin_publish_price_list_version() rejects a non-draft version'
);

select lives_ok(
  $$ select admin_create_draft_version((select id from price_lists where name = 'Test PL 8')) $$,
  'super_admin: admin_create_draft_version() succeeds (v2)'
);
select lives_ok(
  $$ select admin_set_draft_price((select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and status = 'draft'), 'panel', 'eeeeeeee-0000-0000-0006-000000000002', 42) $$,
  'super_admin: prices v2''s draft'
);

-- Immediate publish: v1 -> expired, v2 -> active, exactly one active
-- remains (the partial unique index's own invariant, exercised for real
-- here rather than by a raw insert).
select lives_ok(
  $$ select admin_publish_price_list_version((select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and status = 'draft'), null, 'Looks good') $$,
  'super_admin: admin_publish_price_list_version() publishes v2 immediately'
);
select is(
  (select status from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and version_number = 1),
  'expired', 'v1 (the outgoing version) is now expired'
);
select is(
  (select status from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and version_number = 2),
  'active', 'v2 (the published draft) is now active'
);
select is(
  (select count(*)::int from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and status = 'active'),
  1, 'exactly one active version remains after publishing'
);

-- A fresh draft (v3), scheduled for tomorrow -- the currently-active v2
-- must be left alone (not expired) since it isn't due to change yet.
select lives_ok(
  $$ select admin_create_draft_version((select id from price_lists where name = 'Test PL 8')) $$,
  'super_admin: admin_create_draft_version() succeeds (v3)'
);
select lives_ok(
  $$ select admin_publish_price_list_version((select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and status = 'draft'), current_date + 1, null) $$,
  'super_admin: admin_publish_price_list_version() schedules v3 for tomorrow'
);
select is(
  (select status from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and version_number = 3),
  'scheduled', 'v3 is now scheduled'
);
select is(
  (select status from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and version_number = 2),
  'active', 'v2 stays active -- scheduling v3 doesn''t touch it early'
);

-- No concurrent publish: a 4th draft can't be published (immediate or
-- scheduled) while v3 is still pending.
select lives_ok(
  $$ select admin_create_draft_version((select id from price_lists where name = 'Test PL 8')) $$,
  'super_admin: admin_create_draft_version() succeeds (v4)'
);
select throws_ok(
  $$ select admin_publish_price_list_version((select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and status = 'draft'), null, null) $$,
  'P0001', 'This price list already has a scheduled publish pending -- resolve it before publishing another',
  'admin_publish_price_list_version() rejects a second publish while v3 is still scheduled'
);

-- Lazy on-read resolution: simulate v3's effective_date having arrived (raw
-- update as the unrestricted role -- price_list_versions has no update
-- policy at all, so this can't be done through RLS-scoped authenticated
-- writes, only the RPCs above or, here, direct fixture manipulation to
-- fast-forward time without actually waiting).
reset role;
update price_list_versions set effective_date = current_date - 1
  where price_list_id = (select id from price_lists where name = 'Test PL 8') and version_number = 3;
-- v3 was created via admin_create_draft_version() with no explicit source,
-- which defaults to copying from the list's then-current active version
-- (v2, already priced at $42 for this same product from earlier) -- so v3
-- already has a row here, update it rather than insert a second one (which
-- would violate price_list_prices_unique).
update price_list_prices set price = 99
  where price_list_version_id = (select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and version_number = 3)
    and category = 'panel' and panel_id = 'eeeeeeee-0000-0000-0006-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);

select is(
  (select current_price_list_version_id((select id from price_lists where name = 'Test PL 8'))),
  (select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 8') and version_number = 3),
  'current_price_list_version_id() resolves to the now-due scheduled v3, not the stale active v2'
);
select is(
  (select price from current_price_list_prices((select id from price_lists where name = 'Test PL 8')) where category = 'panel' and panel_id = 'eeeeeeee-0000-0000-0006-000000000002'),
  99::numeric, 'current_price_list_prices() serves v3''s (the now-due version''s) price, not v2''s'
);

-- Company A's own member (non-staff) can now read v3 directly too --
-- confirms the RLS OR-clause, not just the invoker-security function above.
-- Resolves the list id via companies.price_list_id (readable by the
-- company's own owner) rather than price_lists.name -- price_lists itself
-- only exposes a non-default list's row to staff, so a name lookup as a
-- non-staff company owner would silently resolve to nothing and make every
-- assertion below vacuously true for the wrong reason. Same pattern
-- 11_price_list_versions.test.sql's own company-owner checks already use.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000007')::text, true); -- Company A owner
select is(
  (select count(*)::int from price_list_versions where price_list_id = (select price_list_id from companies where id = 'eeeeeeee-0000-0000-0001-000000000001') and version_number = 3),
  1, 'company owner: can read the now-due scheduled version''s metadata via RLS'
);
select is(
  (select count(*)::int from price_list_prices where price_list_version_id = (select id from price_list_versions where price_list_id = (select price_list_id from companies where id = 'eeeeeeee-0000-0000-0001-000000000001') and version_number = 3)),
  1, 'company owner: can read the now-due scheduled version''s prices via RLS'
);

select * from finish();
rollback;
