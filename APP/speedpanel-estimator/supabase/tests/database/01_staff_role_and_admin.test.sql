-- =============================================================================
-- is_admin() / has_staff_role() -- including the staff_role IS NULL
-- "grandfather" nuance
-- =============================================================================
-- Run via `supabase test db` (requires local Docker) or pg_prove against any
-- Supabase project with supabase/seed.sql applied. Simulates each seeded
-- user's session with `set local role authenticated` + `request.jwt.claims`
-- (the technique basejump/supabase_test_helpers uses) -- no bypassing RLS,
-- no service-role client.
-- =============================================================================
begin;
select plan(8);

-- Temporarily null out admin@e2e.test's staff_role to exercise
-- has_staff_role()'s documented "grandfather" behavior: staff_role IS NULL
-- on a role='admin' account grants the SAME access as super_admin. This is
-- rolled back at the end of this transaction, never persisted -- and is a
-- distinct case from unassigned@e2e.test below, whose profiles.role is
-- 'user', not 'admin', so it gets none of this.
update profiles set staff_role = null where id = 'eeeeeeee-0000-0000-0000-000000000001';

set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select ok( has_staff_role(array[]::text[]), 'grandfather: role=admin + staff_role=null still passes has_staff_role([])' );
select ok( has_staff_role(array['dispatch']), 'grandfather: also passes has_staff_role([dispatch]) -- full access, any array' );

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select ok( is_admin(), 'dispatch: is_admin() true (profiles.role=admin)' );
select ok( not has_staff_role(array[]::text[]), 'dispatch: has_staff_role([]) false -- specific role, not super_admin/null' );
select ok( has_staff_role(array['dispatch']), 'dispatch: has_staff_role([dispatch]) true -- own role is in the array' );
select ok( not has_staff_role(array['bdm']), 'dispatch: has_staff_role([bdm]) false -- wrong specific role' );

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-00000000000a')::text, true);
select ok( not is_admin(), 'unassigned: is_admin() false (profiles.role=user, not admin)' );
select ok( not has_staff_role(array[]::text[]), 'unassigned: has_staff_role([]) false -- genuinely no staff access' );

select * from finish();
rollback;
