-- =============================================================================
-- Dynamic RBAC -- has_permission()/role_permissions seed preservation,
-- grandfather clause, and the admin_set_role_permission()/
-- admin_list_permission_matrix() editing surface
-- =============================================================================
-- Run via `supabase test db` (requires local Docker) or pg_prove against any
-- Supabase project with supabase/seed.sql applied. Same
-- set_config('request.jwt.claims', ...) session-simulation technique as
-- 01_staff_role_and_admin.test.sql/04_security_definer_rpcs.test.sql -- no
-- bypassing RLS, no service-role client. Everything here runs inside one
-- transaction, rolled back at the end -- the smoke test's grant/revoke never
-- persists.
-- =============================================================================
begin;
select plan(12);

-- Seed-preservation: exactly the 31 rows supabase/schema.sql's Dynamic RBAC
-- section seeds, reproducing the old hardcoded SECTION_ROLES/
-- has_staff_role(array[...]) call-site behavior with zero net change. See
-- that migration's own seed comment for the full list this count covers.
select is((select count(*) from role_permissions)::int, 31, 'role_permissions has exactly the 31 seeded grants');
select ok(
  exists(select 1 from role_permissions where role = 'bdm' and permission_key = 'requests.triage_update'),
  'seed: bdm has requests.triage_update (was has_staff_role([bdm]))'
);
select ok(
  not exists(select 1 from role_permissions where role = 'dispatch' and permission_key = 'requests.triage_update'),
  'seed: dispatch does NOT have requests.triage_update -- role-specific, not blanket'
);

set local role authenticated;

-- Grandfather clause: has_permission() composes has_staff_role(array[]::text[])
-- for this, never reimplements it (see supabase/schema.sql's has_permission()
-- comment) -- a super_admin passes for literally any key, made-up or real.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select ok(has_permission('literally.any.made.up.key'), 'super_admin: has_permission() passes for any key, even a nonexistent one');

-- Denial for an ungranted role: dispatch has no companies.create grant by
-- seed (that permission_key has zero role_permissions rows at all --
-- super_admin/null-staff_role only, matching today's behavior exactly).
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select ok(not has_permission('companies.create'), 'dispatch: has_permission(companies.create) false -- not granted, no super_admin bypass');

-- admin_list_permission_matrix() is has_staff_role(array[])-gated directly
-- (never has_permission()) -- a non-super_admin gets an empty result set,
-- not an exception (it's a plain `where` clause on a `language sql` function,
-- same style as admin_list_users() etc).
select is((select count(*) from admin_list_permission_matrix())::int, 0, 'dispatch: admin_list_permission_matrix() returns nothing -- super_admin only');

-- admin_set_role_permission() is the SAME meta-gate -- a role can never grant
-- itself (or any other role) anything, even one it might otherwise think it
-- has via some future misconfiguration. This is what stops RBAC editing from
-- ever self-escalating.
select throws_ok(
  $$ select admin_set_role_permission('dispatch', 'companies.create', true) $$,
  'P0001', 'Not authorized',
  'dispatch: admin_set_role_permission() denied -- super_admin only, not has_permission()-gated'
);

-- Smoke test: a super_admin's grant/revoke via admin_set_role_permission()
-- actually flips has_permission() for that role, live -- proving the
-- checkbox in Admin > Roles (AdminRolesPage.tsx) really controls access, not
-- just the matrix's own display. Rolled back at the end of this transaction
-- along with everything else, never persisted.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select ok((select count(*) from admin_list_permission_matrix()) > 0, 'super_admin: admin_list_permission_matrix() returns the full catalog');
select lives_ok(
  $$ select admin_set_role_permission('dispatch', 'companies.create', true) $$,
  'super_admin: admin_set_role_permission() grant succeeds'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select ok(has_permission('companies.create'), 'dispatch: has_permission(companies.create) now true after the grant');

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select lives_ok(
  $$ select admin_set_role_permission('dispatch', 'companies.create', false) $$,
  'super_admin: admin_set_role_permission() revoke succeeds'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select ok(not has_permission('companies.create'), 'dispatch: has_permission(companies.create) back to false after the revoke');

select * from finish();
rollback;
