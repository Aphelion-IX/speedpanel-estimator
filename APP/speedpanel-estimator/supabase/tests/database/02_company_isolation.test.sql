-- =============================================================================
-- is_company_admin() / company membership / staff_assignments / invitations /
-- audit_logs -- cross-company isolation
-- =============================================================================
-- company-admin@e2e.test and member@e2e.test belong to Company A only;
-- outsider@e2e.test belongs to Company B only. Neither should ever see the
-- other company's rows on any of these tables.
-- =============================================================================
begin;
select plan(10);

set local role authenticated;

-- Company A's own admin sees exactly Company A.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000007')::text, true);
select results_eq(
  $$ select legal_name from companies order by legal_name $$,
  $$ values ('E2E Test Co A Pty Ltd'::text) $$,
  'company-admin sees exactly Company A'
);
select ok( is_company_admin('eeeeeeee-0000-0000-0001-000000000001'), 'company-admin: is_company_admin(A) true' );
select ok( not is_company_admin('eeeeeeee-0000-0000-0001-000000000002'), 'company-admin: is_company_admin(B) false' );
select is( (select count(*)::int from company_memberships where company_id = 'eeeeeeee-0000-0000-0001-000000000002'), 0, 'company-admin: zero rows reading Company B memberships' );
select is( (select count(*)::int from staff_assignments where company_id = 'eeeeeeee-0000-0000-0001-000000000001'), 5, 'company-admin: sees all 5 Company A staff assignments' );

-- Outsider (Company B only) sees exactly Company B, nothing from A.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000009')::text, true);
select results_eq(
  $$ select legal_name from companies order by legal_name $$,
  $$ values ('E2E Test Co B Pty Ltd'::text) $$,
  'outsider sees exactly Company B'
);
select ok( not is_company_admin('eeeeeeee-0000-0000-0001-000000000001'), 'outsider: is_company_admin(A) false' );
select is( (select count(*)::int from company_memberships where company_id = 'eeeeeeee-0000-0000-0001-000000000001'), 0, 'outsider: zero rows reading Company A memberships' );
select is( (select count(*)::int from staff_assignments where company_id = 'eeeeeeee-0000-0000-0001-000000000001'), 0, 'outsider: zero rows reading Company A staff assignments' );

-- unassigned (no company at all) sees nothing from either company.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-00000000000a')::text, true);
select is( (select count(*)::int from companies), 0, 'unassigned: sees zero companies' );
select is( (select count(*)::int from company_memberships), 0, 'unassigned: sees zero membership rows anywhere' );

select * from finish();
rollback;
