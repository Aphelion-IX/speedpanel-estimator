-- =============================================================================
-- Company Accounts & Pricing Phase 9 -- company_price_overrides: the
-- no-overlap guard trigger (substituted for the plan's own literal partial-
-- unique-index sketch, which Postgres rejects -- current_date isn't
-- IMMUTABLE, see supabase/schema.sql's own comment on the trigger),
-- admin_set_company_price_override()'s upsert-by-lookup behavior,
-- admin_delete_company_price_override(), the staff-vs-customer RLS/RPC
-- read split, and cross-company isolation.
-- =============================================================================
-- Same set_config('request.jwt.claims', ...) session-simulation technique as
-- 02_company_isolation.test.sql/11_price_list_versions.test.sql/
-- 12_publish_price_list_version.test.sql -- real RLS, no service-role
-- bypass. Everything here runs inside one transaction, rolled back at the
-- end.
-- =============================================================================
begin;
select plan(29);

-- Fixtures, run as the unrestricted connecting role (before the
-- `set local role authenticated` switch below) -- panels has no seed data
-- in this repo at all, same reasoning 11_price_list_versions.test.sql's own
-- fixture comment already documents. Two distinct panels: one to exercise
-- the no-overlap guard against, one to prove a genuinely different product
-- is untouched by it.
insert into panels (id, type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack)
values
  ('eeeeeeee-0000-0000-0006-000000000003', 53, 'Test P53 (Phase 9)', '150mm', '-/60/60', 10, 1, '64x38', '64x38', 3000, 6000, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),
  ('eeeeeeee-0000-0000-0006-000000000004', 54, 'Test P54 (Phase 9)', '150mm', '-/60/60', 10, 1, '64x38', '64x38', 3000, 6000, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

-- =============================================================================
-- The no-overlap guard trigger, exercised via a raw insert as the
-- unrestricted role -- company_price_overrides has no INSERT/UPDATE/DELETE
-- policy for `authenticated` at all (every write goes through the
-- SECURITY DEFINER RPCs below), so a raw insert as `authenticated` would be
-- rejected by RLS before ever reaching the trigger. This is the only way to
-- exercise the trigger directly, mirroring 12_publish_price_list_version.
-- test.sql's own reset-role fixture-manipulation technique.
-- =============================================================================
select lives_ok(
  $$ insert into company_price_overrides (company_id, category, panel_id, override_price, effective_date, expiry_date, created_by)
     values ('eeeeeeee-0000-0000-0001-000000000001', 'panel', 'eeeeeeee-0000-0000-0006-000000000003', 20, current_date - 30, current_date - 1, 'eeeeeeee-0000-0000-0000-000000000001') $$,
  'an EXPIRED override for Company A / test panel inserts cleanly (nothing current to conflict with yet)'
);
select lives_ok(
  $$ insert into company_price_overrides (company_id, category, panel_id, override_price, effective_date, created_by)
     values ('eeeeeeee-0000-0000-0001-000000000001', 'panel', 'eeeeeeee-0000-0000-0006-000000000003', 30, current_date, 'eeeeeeee-0000-0000-0000-000000000001') $$,
  'a CURRENT override for the same company+product inserts cleanly -- the only existing row for it is already expired, so the guard does not see a conflict'
);
select throws_ok(
  $$ insert into company_price_overrides (company_id, category, panel_id, override_price, effective_date, created_by)
     values ('eeeeeeee-0000-0000-0001-000000000001', 'panel', 'eeeeeeee-0000-0000-0006-000000000003', 40, current_date + 5, 'eeeeeeee-0000-0000-0000-000000000001') $$,
  'P0001', 'This company already has a current or upcoming override for this product -- edit or remove it first',
  'a second current-or-upcoming override for the SAME company+product is rejected by the guard trigger'
);
select lives_ok(
  $$ insert into company_price_overrides (company_id, category, panel_id, override_price, effective_date, created_by)
     values ('eeeeeeee-0000-0000-0001-000000000002', 'panel', 'eeeeeeee-0000-0000-0006-000000000003', 25, current_date, 'eeeeeeee-0000-0000-0000-000000000001') $$,
  'the SAME product for a DIFFERENT company (Company B) inserts cleanly -- the guard is company-scoped, not global'
);
-- Clean up Company B's fixture row -- this test only needed it to prove
-- company-scoping above, and it would otherwise interfere with the
-- cross-company isolation checks near the end of this file.
delete from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000002' and panel_id = 'eeeeeeee-0000-0000-0006-000000000003';

-- =============================================================================
-- admin_set_company_price_override(): upsert-by-lookup, super_admin.
-- =============================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin

select is(
  (select count(*)::int from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and panel_id = 'eeeeeeee-0000-0000-0006-000000000003'),
  2, 'sanity check: Company A has 2 rows (1 expired, 1 current) for the test panel before the RPC touches anything'
);
select lives_ok(
  $$ select admin_set_company_price_override('eeeeeeee-0000-0000-0001-000000000001', 'panel', 'eeeeeeee-0000-0000-0006-000000000003', 77, current_date, null, 'Volume discount') $$,
  'super_admin: admin_set_company_price_override() succeeds against the product with a current override'
);
select is(
  (select count(*)::int from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and panel_id = 'eeeeeeee-0000-0000-0006-000000000003'),
  2, 'the RPC UPDATED the existing current row in place rather than inserting a duplicate -- still exactly 2 rows (1 expired, 1 current)'
);
select is(
  (select override_price from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and panel_id = 'eeeeeeee-0000-0000-0006-000000000003' and expiry_date is null),
  77::numeric, 'the current row''s price was updated to 77 by the upsert'
);
-- internal_reason itself can't be checked via a raw select here, even as
-- super_admin -- the column-level grant restriction below applies to the
-- `authenticated` Postgres role regardless of which JWT claims/has_permission()
-- says about the CALLING user, so a direct select naming that column is
-- rejected for every authenticated session, staff included. Verified
-- instead via company_list_price_overrides() (SECURITY DEFINER, reads as
-- the table owner) further down.

select lives_ok(
  $$ select admin_set_company_price_override('eeeeeeee-0000-0000-0001-000000000001', 'panel', 'eeeeeeee-0000-0000-0006-000000000004', 15, current_date, null, null) $$,
  'super_admin: admin_set_company_price_override() succeeds against a genuinely different product (a real insert this time)'
);
select is(
  (select count(*)::int from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001'),
  3, 'Company A now has 3 rows total -- the new product''s override was a real insert, not another upsert-in-place'
);

select throws_ok(
  $$ select admin_set_company_price_override('eeeeeeee-0000-0000-0001-000000000001', 'widget', 'eeeeeeee-0000-0000-0006-000000000004', 15, current_date, null, null) $$,
  'P0001', 'Invalid category',
  'admin_set_company_price_override() rejects an unrecognized category'
);
select throws_ok(
  $$ select admin_set_company_price_override('eeeeeeee-0000-0000-0001-000000000001', 'panel', 'eeeeeeee-0000-0000-0006-000000000004', 15, current_date, current_date - 1, null) $$,
  'P0001', 'Expiry date can''t be before the effective date',
  'admin_set_company_price_override() rejects an expiry date before the effective date'
);

-- =============================================================================
-- Non-staff permission gate.
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000007')::text, true); -- Company A owner (non-staff)
select throws_ok(
  $$ select admin_set_company_price_override('eeeeeeee-0000-0000-0001-000000000001', 'panel', 'eeeeeeee-0000-0000-0006-000000000004', 99, current_date, null, null) $$,
  'P0001', 'Not authorized',
  'a non-staff company owner cannot call admin_set_company_price_override()'
);
select throws_ok(
  $$ select admin_delete_company_price_override((select id from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and panel_id = 'eeeeeeee-0000-0000-0006-000000000004')) $$,
  'P0001', 'Not authorized',
  'a non-staff company owner cannot call admin_delete_company_price_override()'
);

-- =============================================================================
-- Staff-facing full history RPC (company_list_price_overrides): sees every
-- row regardless of status, including internal_reason/created_by_name --
-- but returns EMPTY (not an error) for a caller lacking the permission,
-- since it's SECURITY DEFINER with the has_permission() check folded into
-- its own WHERE clause rather than an early raise.
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin
select is(
  (select count(*)::int from company_list_price_overrides('eeeeeeee-0000-0000-0001-000000000001')),
  3, 'super_admin: company_list_price_overrides() sees all 3 of Company A''s rows (expired + 2 current)'
);
select is(
  (select internal_reason from company_list_price_overrides('eeeeeeee-0000-0000-0001-000000000001') where panel_id = 'eeeeeeee-0000-0000-0006-000000000003' and expiry_date is null),
  'Volume discount', 'super_admin: company_list_price_overrides() surfaces internal_reason (staff-only column)'
);
select ok(
  (select created_by_name from company_list_price_overrides('eeeeeeee-0000-0000-0001-000000000001') where panel_id = 'eeeeeeee-0000-0000-0006-000000000004') is not null,
  'super_admin: company_list_price_overrides() resolves created_by into a display name'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000007')::text, true); -- Company A owner (non-staff)
select is(
  (select count(*)::int from company_list_price_overrides('eeeeeeee-0000-0000-0001-000000000001')),
  0, 'non-staff company owner: company_list_price_overrides() returns zero rows (has_permission() check folded into its WHERE, not an exception)'
);

-- =============================================================================
-- Customer-facing narrow function (current_company_price_overrides): only
-- currently-active rows, narrow columns only (no internal_reason/
-- created_by/approved_*), and cross-company isolation.
-- =============================================================================
select is(
  (select count(*)::int from current_company_price_overrides('eeeeeeee-0000-0000-0001-000000000001')),
  2, 'company owner: current_company_price_overrides() sees exactly the 2 currently-active overrides, not the expired one'
);
select is(
  (select override_price from current_company_price_overrides('eeeeeeee-0000-0000-0001-000000000001') where panel_id = 'eeeeeeee-0000-0000-0006-000000000003'),
  77::numeric, 'company owner: current_company_price_overrides() surfaces the correct (post-upsert) price'
);

-- Column-level grant: internal_reason/created_by/approved_* are hidden from
-- a direct authenticated select entirely (revoke select on the table,
-- narrow grant re-added), same technique as order_deliveries.internal_note
-- -- a raw select naming that column errors before RLS is even consulted.
select throws_ok(
  $$ select internal_reason from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001' limit 1 $$,
  '42501', 'permission denied for table company_price_overrides',
  'company owner: a direct select naming internal_reason is rejected -- that column was never granted to authenticated'
);
select lives_ok(
  $$ select id, override_price from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001' $$,
  'company owner: a direct select on the narrow granted columns (id, override_price, ...) still works'
);
select is(
  (select count(*)::int from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001'),
  2, 'company owner: RLS on a direct table read also narrows to the 2 currently-active rows, matching current_company_price_overrides()'
);

-- Cross-company isolation: Company B's owner reading Company A's overrides.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000009')::text, true); -- Company B owner (outsider)
select is(
  (select count(*)::int from current_company_price_overrides('eeeeeeee-0000-0000-0001-000000000001')),
  0, 'Company B owner: current_company_price_overrides(Company A) returns zero rows'
);
select is(
  (select count(*)::int from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001'),
  0, 'Company B owner: a direct select against Company A''s overrides returns zero rows via RLS'
);
select is(
  (select count(*)::int from company_list_price_overrides('eeeeeeee-0000-0000-0001-000000000001')),
  0, 'Company B owner (non-staff): company_list_price_overrides(Company A) also returns zero rows'
);

-- =============================================================================
-- admin_delete_company_price_override().
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin
select lives_ok(
  $$ select admin_delete_company_price_override((select id from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and panel_id = 'eeeeeeee-0000-0000-0006-000000000004')) $$,
  'super_admin: admin_delete_company_price_override() succeeds'
);
select is(
  (select count(*)::int from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and panel_id = 'eeeeeeee-0000-0000-0006-000000000004'),
  0, 'the deleted override is genuinely gone'
);
select throws_ok(
  $$ select admin_delete_company_price_override('00000000-0000-0000-0000-000000000000') $$,
  'P0001', 'Override not found',
  'admin_delete_company_price_override() rejects a nonexistent id'
);

select * from finish();
rollback;
