-- =============================================================================
-- can_view_project() / can_edit_project() / can_submit_orders() -- role
-- tiers, ownership, explicit project_memberships, and cross-company denial
-- =============================================================================
-- Notable, worth-documenting finding this file pins down explicitly: any
-- Speedpanel staff account (profiles.role='admin', which is_admin() checks)
-- gets blanket read access to EVERY project/order across EVERY company via
-- can_view_project()'s is_admin() clause -- staff_assignments does NOT
-- itself gate RLS-level visibility, it's a UI-side query-scoping
-- convenience only (see shared/useMyQueueScope.ts). Per-role write
-- restrictions are enforced separately, at the RPC layer
-- (has_staff_role(array['dispatch']) etc.), not by narrowing SELECT access.
-- =============================================================================
begin;
select plan(10);

set local role authenticated;

-- member owns Project A1 (Draft) -- ownership grants full view+edit.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true);
select ok( can_view_project('eeeeeeee-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000001'), 'member: can_view_project(owned A1) true' );
select ok( can_edit_project('eeeeeeee-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000001'), 'member: can_edit_project(owned A1) true' );

-- member has an explicit VIEWER project_memberships row on A2 (owned by
-- company-admin) -- view yes, edit no (viewer != editor).
select ok( can_view_project('eeeeeeee-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000002'), 'member: can_view_project(viewer-membership A2) true' );
select ok( not can_edit_project('eeeeeeee-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000002'), 'member: can_edit_project(viewer-membership A2) false -- viewer, not editor' );

-- member has NO relationship to A3 -- estimator company role alone grants
-- no implicit access, and there's no project_memberships row either.
select ok( not can_view_project('eeeeeeee-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000003'), 'member: can_view_project(no relation A3) false' );

-- can_submit_orders: ownership grants it (A1); mere viewer access does not (A2).
select ok( can_submit_orders('eeeeeeee-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000001'), 'member: can_submit_orders(owned A1) true' );
select ok( not can_submit_orders('eeeeeeee-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000002'), 'member: can_submit_orders(viewer-only A2) false' );

-- company-admin (company role='owner') implicitly reaches every Company A
-- project, including A1 which they don't own.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000007')::text, true);
select ok( can_edit_project('eeeeeeee-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0002-000000000001'), 'company-admin: can_edit_project(A1, not owned) true -- company owner tier' );

-- outsider (Company B only) cannot view any Company A project.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000009')::text, true);
select is( (select count(*)::int from projects where company_id = 'eeeeeeee-0000-0000-0001-000000000001'), 0, 'outsider: sees zero Company A projects' );

-- Any Speedpanel staff account (here: dispatch, who has no company
-- relationship at all to either company) still sees every project via
-- is_admin() -- documented finding, not a bug: staff RLS read access is
-- intentionally broad, narrowed only at the UI/RPC layer.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select is( (select count(*)::int from projects where id::text like 'eeeeeeee-%'), 5, 'dispatch (staff): sees all 5 seeded projects across both companies via is_admin()' );

select * from finish();
rollback;
