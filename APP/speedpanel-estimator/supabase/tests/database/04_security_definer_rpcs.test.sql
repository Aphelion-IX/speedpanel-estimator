-- =============================================================================
-- Security-definer RPC role gating -- spot-checks across the app's write
-- surface, confirming the wrong role is denied (not just the right role
-- allowed)
-- =============================================================================
begin;
select plan(8);

set local role authenticated;

-- admin_* RPCs (has_staff_role(array[]::text[]) -- super_admin/grandfather
-- only): a specific-role staff account (dispatch) must be denied.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select throws_ok(
  $$ select admin_create_company('E2E Should Fail Co') $$,
  'P0001',
  'Not authorized',
  'dispatch: admin_create_company() denied -- super_admin only'
);
select throws_ok(
  $$ select admin_set_staff_role('eeeeeeee-0000-0000-0000-000000000006', 'bdm') $$,
  'P0001', 'Not authorized',
  'dispatch: admin_set_staff_role() denied -- super_admin only'
);

-- super_admin succeeds on the same admin_create_company call.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select lives_ok(
  $$ select admin_create_company('E2E Throwaway Co (deleted by rollback)') $$,
  'admin: admin_create_company() succeeds for super_admin'
);

-- company_set_member_role / company_remove_member: company admin only,
-- and only for THEIR OWN company -- outsider (Company B) must be denied
-- acting on Company A's membership.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000009')::text, true);
select throws_ok(
  $$ select company_set_member_role('eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0000-000000000008', 'viewer') $$,
  'P0001', 'Not authorized',
  'outsider: company_set_member_role() on Company A denied -- not that company''s admin'
);

-- review_install / review_technical: PM/technical_services only --
-- internal_sales must be denied even though they're valid staff.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000004')::text, true);
select throws_ok(
  $$ select review_install('eeeeeeee-0000-0000-0002-000000000002', 'approved', null) $$,
  'P0001', 'Not authorized',
  'internal_sales: review_install() denied -- project_manager/technical_services only'
);

-- issue_proforma_invoice: internal_sales only -- dispatch must be denied.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select throws_ok(
  $$ select issue_proforma_invoice('eeeeeeee-0000-0000-0003-000000000002', null) $$,
  'P0001', 'Not authorized',
  'dispatch: issue_proforma_invoice() denied -- internal_sales only'
);

-- admin_update_manufacturing: dispatch only -- internal_sales must be denied.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000004')::text, true);
select throws_ok(
  $$ select admin_update_manufacturing('eeeeeeee-0000-0000-0003-000000000003', 5, null) $$,
  'P0001', 'Not authorized',
  'internal_sales: admin_update_manufacturing() denied -- dispatch only'
);

select * from finish();
rollback;
