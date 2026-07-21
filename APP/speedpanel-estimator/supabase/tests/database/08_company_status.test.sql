-- =============================================================================
-- Company Accounts & Pricing Phase 2 -- admin_set_company_status() /
-- admin_create_company()'s new default status
-- =============================================================================
-- Same set_config('request.jwt.claims', ...) session-simulation technique as
-- 02_company_isolation.test.sql/06_dynamic_permissions.test.sql -- real RLS,
-- no service-role bypass. Everything here runs inside one transaction,
-- rolled back at the end.
-- =============================================================================
begin;
select plan(6);

set local role authenticated;

-- super_admin: status change succeeds, and is actually persisted.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select lives_ok(
  $$ select admin_set_company_status('eeeeeeee-0000-0000-0001-000000000001', 'on_hold', 'Overdue invoice') $$,
  'super_admin: admin_set_company_status() succeeds'
);
select is(
  (select status from companies where id = 'eeeeeeee-0000-0000-0001-000000000001'),
  'on_hold', 'company status actually updated to on_hold'
);

-- The transition is recorded on audit_logs with old/new/reason -- same
-- log_audit() convention every other company-workspace mutation follows.
select ok(
  exists(
    select 1 from audit_logs
    where company_id = 'eeeeeeee-0000-0000-0001-000000000001'
      and event_type = 'company_status_changed'
      and detail->>'from' = 'active' and detail->>'to' = 'on_hold' and detail->>'reason' = 'Overdue invoice'
  ),
  'audit log recorded the status change with old/new/reason'
);

-- Invalid status value rejected even for a super_admin -- defence in depth
-- alongside the table's own check constraint.
select throws_ok(
  $$ select admin_set_company_status('eeeeeeee-0000-0000-0001-000000000001', 'bogus', null) $$,
  'P0001', 'Invalid status',
  'super_admin: invalid status value rejected'
);

-- dispatch has no companies.set_status grant (new permission key, zero
-- seeded role_permissions rows -- super_admin grandfather bypass only,
-- same pattern as companies.create in 06_dynamic_permissions.test.sql).
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select throws_ok(
  $$ select admin_set_company_status('eeeeeeee-0000-0000-0001-000000000001', 'active', null) $$,
  'P0001', 'Not authorized',
  'dispatch: admin_set_company_status() denied -- no grant, no super_admin bypass'
);

-- admin_create_company (the only insert path into companies) now defaults
-- new companies to 'pending', per the backend spec's 5-state model. Split
-- into two statements (\gset, then a separate select) rather than nesting
-- the call inside `where id = admin_create_company(...)` -- the row a
-- volatile function inserts as a side effect isn't visible to a `from
-- companies` scan sharing the same query's snapshot, so the single-query
-- form silently returns null instead of the new row.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select admin_create_company('pgTAP status test co') as new_company_id \gset
select is(
  (select status from companies where id = :'new_company_id'),
  'pending', 'admin_create_company: new company starts pending'
);

select * from finish();
rollback;
