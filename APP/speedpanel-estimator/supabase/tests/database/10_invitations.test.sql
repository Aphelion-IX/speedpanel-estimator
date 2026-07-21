-- =============================================================================
-- Company Accounts & Pricing Phase 5 -- admin_list_invitations() cross-company
-- read + admin_fix_invitation_email()'s delivery_failed -> pending transition
-- =============================================================================
-- Same set_config('request.jwt.claims', ...) session-simulation technique as
-- 02_company_isolation.test.sql/08_company_status.test.sql/
-- 09_company_addresses.test.sql -- real RLS, no service-role bypass.
-- Everything here runs inside one transaction, rolled back at the end.
-- =============================================================================
begin;
select plan(10);

-- Fixtures: invitations has no insert/update RLS policy at all (writes only
-- ever go through the company-invite-member Edge Function or the RPCs
-- above) -- inserted here as the unrestricted connecting role, before the
-- `set local role authenticated` switch, same convention
-- 07_delivery_allocation.test.sql already establishes for fixture writes
-- that would otherwise be blocked by RLS.
insert into invitations (id, company_id, email, invitee_name, role, status, invited_by)
values ('eeeeeeee-0000-0000-0009-000000000001', 'eeeeeeee-0000-0000-0001-000000000001', 'broken@e2e.test', 'Broken Delivery', 'estimator', 'delivery_failed', 'eeeeeeee-0000-0000-0000-000000000001');
update invitations set failure_reason = 'SMTP rejected the address' where id = 'eeeeeeee-0000-0000-0009-000000000001';
insert into invitations (id, company_id, email, invitee_name, role, status, invited_by)
values ('eeeeeeee-0000-0000-0009-000000000002', 'eeeeeeee-0000-0000-0001-000000000002', 'pendingb@e2e.test', 'Pending B', 'viewer', 'pending', 'eeeeeeee-0000-0000-0000-000000000001');

set local role authenticated;

-- super_admin: cross-company read sees both companies' invitations, and the
-- status filter narrows correctly.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true);
select is(
  (select count(*)::int from admin_list_invitations(null, null)),
  2, 'super_admin: admin_list_invitations() sees both companies'' invitations'
);
select is(
  (select count(*)::int from admin_list_invitations(null, 'delivery_failed')),
  1, 'super_admin: status filter narrows to the delivery_failed row'
);
select is(
  (select status from invitations where id = 'eeeeeeee-0000-0000-0009-000000000001'),
  'delivery_failed', 'fixture invitation is delivery_failed'
);

-- admin_fix_invitation_email() only accepts a currently delivery_failed row.
select throws_ok(
  $$ select admin_fix_invitation_email('eeeeeeee-0000-0000-0009-000000000002', 'new@e2e.test') $$,
  'P0001', 'Only a delivery-failed invitation can be fixed',
  'super_admin: admin_fix_invitation_email() rejected for a pending invitation'
);

-- Fixing the delivery_failed one resets status/email/failure_reason.
select lives_ok(
  $$ select admin_fix_invitation_email('eeeeeeee-0000-0000-0009-000000000001', 'fixed@e2e.test') $$,
  'super_admin: admin_fix_invitation_email() succeeds for the delivery_failed invitation'
);
select is(
  (select status from invitations where id = 'eeeeeeee-0000-0000-0009-000000000001'),
  'pending', 'invitation reset to pending after fix'
);
select is(
  (select email from invitations where id = 'eeeeeeee-0000-0000-0009-000000000001'),
  'fixed@e2e.test', 'invitation email updated to the corrected address'
);
select is(
  (select failure_reason from invitations where id = 'eeeeeeee-0000-0000-0009-000000000001'),
  null, 'failure_reason cleared after a successful fix'
);

-- Cross-company isolation: outsider (Company B only) has no invitations.list
-- grant -- admin_list_invitations() returns zero rows, not just Company B's.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000009')::text, true);
select is(
  (select count(*)::int from admin_list_invitations(null, null)),
  0, 'outsider: admin_list_invitations() returns zero rows -- no grant'
);

-- dispatch has no membership in (or manage_all bypass for) Company B --
-- admin_fix_invitation_email() denies it regardless of invitations.list.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000005')::text, true);
select throws_ok(
  $$ select admin_fix_invitation_email('eeeeeeee-0000-0000-0009-000000000002', 'x@e2e.test') $$,
  'P0001', 'Not authorized',
  'dispatch: admin_fix_invitation_email() denied -- not is_company_admin for Company B'
);

select * from finish();
rollback;
