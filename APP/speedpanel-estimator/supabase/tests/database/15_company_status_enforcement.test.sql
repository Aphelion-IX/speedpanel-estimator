-- =============================================================================
-- Company Accounts & Pricing Phase 11 -- companies.status enforcement:
-- On Hold/Suspended blocking new order creation (can_submit_orders() +
-- create_order()), the is_admin() staff bypass, admin_set_company_status()
-- setting/clearing the hold_* columns, and company_onboarding_progress()'s
-- Pending Setup checklist.
-- =============================================================================
-- Same set_config('request.jwt.claims', ...) session-simulation technique as
-- every other numbered file in this suite -- real RLS, no service-role
-- bypass. Everything here runs inside one transaction, rolled back at the
-- end, so temporarily putting Company A on hold here can't leak into any
-- other test file's own assumptions about its status.
-- =============================================================================
begin;
select plan(25);

-- Fixture, run as the unrestricted connecting role -- panels has no seed
-- data in this repo at all, same reasoning every prior phase's own fixture
-- comment already documents.
insert into panels (id, type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack)
values ('eeeeeeee-0000-0000-0006-000000000008', 58, 'Test P58 (Phase 11)', '150mm', '-/60/60', 10, 1, '64x38', '64x38', 3000, 6000, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

set local role authenticated;

-- =============================================================================
-- Pending Setup checklist -- baseline (Company A, fresh transaction: no
-- abn, no company_addresses row, no override, PL1's own default assignment
-- untouched) then each condition flipped on individually.
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin

select is(
  (select has_legal_details from company_onboarding_progress('eeeeeeee-0000-0000-0001-000000000001')),
  false, 'baseline: has_legal_details false -- Company A has no abn on file'
);
select is(
  (select has_owner from company_onboarding_progress('eeeeeeee-0000-0000-0001-000000000001')),
  true, 'baseline: has_owner true -- company-admin is an active owner member'
);
select is(
  (select has_default_address from company_onboarding_progress('eeeeeeee-0000-0000-0001-000000000001')),
  false, 'baseline: has_default_address false -- no company_addresses row exists yet'
);
select is(
  (select has_pricing_setup from company_onboarding_progress('eeeeeeee-0000-0000-0001-000000000001')),
  false, 'baseline: has_pricing_setup false -- still on PL1''s automatic default, no override'
);

reset role;
update companies set abn = '12345678901' where id = 'eeeeeeee-0000-0000-0001-000000000001';
insert into company_addresses (company_id, type, is_default, line1, created_by)
values ('eeeeeeee-0000-0000-0001-000000000001', 'office', true, '1 Test St', 'eeeeeeee-0000-0000-0000-000000000001');
insert into company_price_overrides (company_id, category, panel_id, override_price, effective_date, created_by)
values ('eeeeeeee-0000-0000-0001-000000000001', 'panel', 'eeeeeeee-0000-0000-0006-000000000008', 42, current_date, 'eeeeeeee-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin

select is(
  (select has_legal_details from company_onboarding_progress('eeeeeeee-0000-0000-0001-000000000001')),
  true, 'after setting abn: has_legal_details true'
);
select is(
  (select has_default_address from company_onboarding_progress('eeeeeeee-0000-0000-0001-000000000001')),
  true, 'after adding a default address: has_default_address true'
);
select is(
  (select has_pricing_setup from company_onboarding_progress('eeeeeeee-0000-0000-0001-000000000001')),
  true, 'after adding an item override: has_pricing_setup true even though the assigned list is still PL1'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member (non-staff)
select is(
  (select count(*)::int from company_onboarding_progress('eeeeeeee-0000-0000-0001-000000000001')),
  0, 'non-staff member: company_onboarding_progress() returns zero rows -- has_permission(''companies.list'') gate, not an exception'
);

-- =============================================================================
-- admin_set_company_status(): the hold_* columns.
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin

select lives_ok(
  $$ select admin_set_company_status('eeeeeeee-0000-0000-0001-000000000001', 'on_hold', 'Overdue invoice', current_date + 14) $$,
  'super_admin: admin_set_company_status() puts Company A on hold with a reason and review date'
);
select is(
  (select status from companies where id = 'eeeeeeee-0000-0000-0001-000000000001'), 'on_hold', 'Company A status is now on_hold'
);
-- hold_reason/hold_applied_by/hold_placed_at/hold_review_date are column-
-- grant-restricted on companies as of Phase 12 (see
-- 16_companies_column_grant.test.sql) -- read them back the same way real
-- staff UI does, through admin_list_companies() (security definer, bypasses
-- the column grant same as it bypasses RLS), not a raw table select.
select is(
  (select hold_reason from admin_list_companies() where id = 'eeeeeeee-0000-0000-0001-000000000001'), 'Overdue invoice', 'hold_reason recorded'
);
select is(
  (select hold_applied_by_name from admin_list_companies() where id = 'eeeeeeee-0000-0000-0001-000000000001'), 'admin@e2e.test', 'hold_applied_by_name recorded'
);
select ok(
  (select hold_placed_at from admin_list_companies() where id = 'eeeeeeee-0000-0000-0001-000000000001') is not null, 'hold_placed_at recorded'
);
select is(
  (select hold_review_date from admin_list_companies() where id = 'eeeeeeee-0000-0000-0001-000000000001'), (current_date + 14), 'hold_review_date recorded'
);

-- =============================================================================
-- can_submit_orders()/create_order(): blocked for a non-staff caller while
-- on hold, but never for Speedpanel staff (is_admin() bypass), and never
-- for a solo/no-company project regardless of any company's status.
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member again (not super_admin -- is_admin() must not short-circuit these checks)
select ok(
  not can_submit_orders('eeeeeeee-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000001'),
  'member: can_submit_orders() is false while Company A is on hold'
);
select ok(
  can_submit_orders('eeeeeeee-0000-0000-0000-000000000008', null, 'eeeeeeee-0000-0000-0002-000000000001'),
  'a solo/no-company project is never blocked by the on-hold check, regardless of any other company''s status'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member (Company A, owns project 1)
select throws_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-blocked', 'category', 'panel', 'label', 'Blocked test', 'qty', 1, 'unit', 'panel', 'productId', null, 'unitPriceExGst', null, 'lineTotalExGst', 0, 'matched', false)
     ), null) $$,
  'P0001', 'This company''s account is currently on_hold -- new orders can''t be created until it''s reactivated',
  'member: create_order() rejects a new order while Company A is on hold'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin
select ok(
  can_submit_orders('eeeeeeee-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000001'),
  'super_admin: can_submit_orders() stays true even while Company A is on hold -- staff bypass'
);
select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-staff-bypass', 'category', 'panel', 'label', 'Staff bypass test', 'qty', 1, 'unit', 'panel', 'productId', null, 'unitPriceExGst', null, 'lineTotalExGst', 0, 'matched', false)
     ), null) $$,
  'super_admin: create_order() still succeeds on a held company -- staff bypass'
);

-- =============================================================================
-- Reactivating clears the hold_* columns entirely and un-blocks ordering.
-- =============================================================================
select lives_ok(
  $$ select admin_set_company_status('eeeeeeee-0000-0000-0001-000000000001', 'active', null, null) $$,
  'super_admin: admin_set_company_status() reactivates Company A'
);
select is( (select hold_reason from admin_list_companies() where id = 'eeeeeeee-0000-0000-0001-000000000001'), null, 'hold_reason cleared on reactivation' );
select is( (select hold_applied_by_name from admin_list_companies() where id = 'eeeeeeee-0000-0000-0001-000000000001'), null, 'hold_applied_by_name cleared on reactivation' );
select is( (select hold_placed_at from admin_list_companies() where id = 'eeeeeeee-0000-0000-0001-000000000001'), null, 'hold_placed_at cleared on reactivation' );
select is( (select hold_review_date from admin_list_companies() where id = 'eeeeeeee-0000-0000-0001-000000000001'), null, 'hold_review_date cleared on reactivation' );

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member again
select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-reactivated', 'category', 'panel', 'label', 'Reactivated test', 'qty', 1, 'unit', 'panel', 'productId', null, 'unitPriceExGst', null, 'lineTotalExGst', 0, 'matched', false)
     ), null) $$,
  'member: create_order() succeeds again once Company A is back to active'
);

select * from finish();
rollback;
