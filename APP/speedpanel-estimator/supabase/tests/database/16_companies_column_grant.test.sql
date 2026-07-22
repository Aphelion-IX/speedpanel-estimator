-- =============================================================================
-- Company Accounts & Pricing Phase 12 -- companies column-grant restriction
-- =============================================================================
-- Security-review finding (Phase 12's own mandated review pass, see
-- schema.sql's "Phase 12 -- companies column-grant restriction" section):
-- companies had row-level RLS ("Company members can read their own
-- company") but no column-level restriction, unlike order_deliveries and
-- company_price_overrides -- meaning a company member's own raw select
-- could read internal_notes/hold_* for their own company row. Same
-- throws_ok/lives_ok pattern as 13_company_price_overrides.test.sql's own
-- column-grant assertions.
-- =============================================================================
begin;
select plan(4);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member (Company A, non-staff)

select throws_ok(
  $$ select internal_notes from companies where id = 'eeeeeeee-0000-0000-0001-000000000001' $$,
  '42501', 'permission denied for table companies',
  'company member: a direct select naming internal_notes is rejected -- that column was never granted to authenticated'
);
select throws_ok(
  $$ select hold_reason from companies where id = 'eeeeeeee-0000-0000-0001-000000000001' $$,
  '42501', 'permission denied for table companies',
  'company member: a direct select naming hold_reason is rejected -- that column was never granted to authenticated'
);
select lives_ok(
  $$ select id, legal_name, trading_name, status, price_list_id from companies where id = 'eeeeeeee-0000-0000-0001-000000000001' $$,
  'company member: a direct select on the narrow granted columns still works'
);
select is(
  (select status from companies where id = 'eeeeeeee-0000-0000-0001-000000000001'),
  'active', 'company member: narrow-column select returns real data, RLS + column grant compose correctly'
);

select * from finish();
rollback;
