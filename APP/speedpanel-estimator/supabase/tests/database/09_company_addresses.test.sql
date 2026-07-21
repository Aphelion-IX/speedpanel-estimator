-- =============================================================================
-- Company Accounts & Pricing Phase 3 -- company_addresses one-default-per-type
-- invariant, cross-company isolation, and the write RPCs' permission gate
-- =============================================================================
-- Same set_config('request.jwt.claims', ...) session-simulation technique as
-- 02_company_isolation.test.sql/08_company_status.test.sql -- real RLS, no
-- service-role bypass. Everything here runs inside one transaction, rolled
-- back at the end.
-- =============================================================================
begin;
select plan(11);

set local role authenticated;

-- super_admin: create a default billing address for Company A.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select lives_ok(
  $$ select admin_set_company_address(null, 'eeeeeeee-0000-0000-0001-000000000001', 'billing', 'Head Office', '22 Example Street', null, 'Melbourne', 'VIC', '3000', null, null, true) $$,
  'super_admin: admin_set_company_address() creates a default billing address'
);
select is(
  (select is_default from company_addresses where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and type = 'billing' order by created_at limit 1),
  true, 'first billing address is the default'
);

-- Creating a second default billing address clears the first's default --
-- proving the RPC's "clear old default first" step actually works, not
-- just that the unique index exists.
select lives_ok(
  $$ select admin_set_company_address(null, 'eeeeeeee-0000-0000-0001-000000000001', 'billing', 'New Head Office', '99 Other Street', null, 'Melbourne', 'VIC', '3001', null, null, true) $$,
  'super_admin: admin_set_company_address() creates a second default billing address'
);
select is(
  (select count(*)::int from company_addresses where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and type = 'billing' and is_default),
  1, 'exactly one default billing address after the second is created'
);
select is(
  (select is_default from company_addresses where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and label = 'Head Office'),
  false, 'the original address is no longer the default'
);

-- Defence in depth: a raw insert that bypasses the RPC's own "clear the old
-- default first" step still gets rejected by the unique index itself.
select throws_ok(
  $$ insert into company_addresses (company_id, type, line1, is_default) values ('eeeeeeee-0000-0000-0001-000000000001', 'billing', 'Bypass Street', true) $$,
  '23505', 'duplicate key value violates unique constraint "company_addresses_one_default_per_type"',
  'raw insert: a second default billing address for the same company violates the one-default-per-type unique index'
);

-- Cross-company isolation: outsider (Company B only) reads zero rows for
-- Company A via company_list_addresses(), same pattern
-- 02_company_isolation.test.sql already establishes for other tables.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000009')::text, true);
select is(
  (select count(*)::int from company_list_addresses('eeeeeeee-0000-0000-0001-000000000001')),
  0, 'outsider: company_list_addresses(Company A) returns zero rows'
);
select is(
  (select count(*)::int from company_addresses where company_id = 'eeeeeeee-0000-0000-0001-000000000001'),
  0, 'outsider: zero rows reading Company A addresses directly (RLS)'
);

-- dispatch has no company_addresses.write grant (new permission key, zero
-- seeded role_permissions rows -- super_admin grandfather bypass only).
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select throws_ok(
  $$ select admin_set_company_address(null, 'eeeeeeee-0000-0000-0001-000000000001', 'delivery', 'Warehouse', '1 Industry Drive', null, 'Truganina', 'VIC', '3029', null, null, false) $$,
  'P0001', 'Not authorized',
  'dispatch: admin_set_company_address() denied -- no grant, no super_admin bypass'
);

-- super_admin can delete an address.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select lives_ok(
  $$ select admin_delete_company_address((select id from company_addresses where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and label = 'Head Office')) $$,
  'super_admin: admin_delete_company_address() succeeds'
);
select is(
  (select count(*)::int from company_addresses where company_id = 'eeeeeeee-0000-0000-0001-000000000001'),
  1, 'one address remains for Company A after the delete'
);

select * from finish();
rollback;
