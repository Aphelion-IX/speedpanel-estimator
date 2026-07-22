-- =============================================================================
-- Supabase SQL audit finding -- log_audit() direct-call actor/company forgery
-- =============================================================================
-- log_audit(p_company_id, p_actor_id, p_event_type, ...) takes p_actor_id as
-- a plain parameter, not derived from auth.uid() -- AuditHistoryPage.tsx's
-- own "What every audit entry captures" panel advertises actor_id/
-- actor_email as "resolved from a real signed-in session, never
-- client-supplied", a guarantee a direct authenticated call to log_audit()
-- would break (forge any actor, any company, any event_type/detail).
-- schema.sql now revokes EXECUTE on log_audit() from authenticated (see its
-- own comment there) -- every legitimate call site is itself inside another
-- security definer function, which runs as that function's owner, not as
-- the original caller's `authenticated` role, so real audit logging
-- (already covered by 08_company_status.test.sql's and
-- 17_audit_history.test.sql's own assertions) is unaffected by this revoke.
-- =============================================================================
begin;
select plan(2);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member (Company A, non-staff)

select throws_ok(
  $$ select log_audit('eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'forged_event') $$,
  '42501', 'permission denied for function log_audit',
  'company member: a direct log_audit() call is rejected -- can no longer forge an actor/company/event_type'
);
select is(
  (select count(*)::int from audit_logs where event_type = 'forged_event'),
  0, 'no forged audit_logs row was inserted by the rejected call'
);

select * from finish();
rollback;
