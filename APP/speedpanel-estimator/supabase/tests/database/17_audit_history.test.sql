-- =============================================================================
-- Company Accounts & Pricing Phase 13 -- cross-company Audit History:
-- admin_list_audit_log()'s audit.list_all gate + company/event_type
-- filters, and the two previously-missing log_audit() call sites
-- (price_list_assigned on admin_set_company_price_list(), pricing_used_in_order
-- on create_order()).
-- =============================================================================
-- Same set_config('request.jwt.claims', ...) session-simulation technique as
-- every other numbered file in this suite -- real RLS, no service-role
-- bypass. Everything here runs inside one transaction, rolled back at the
-- end.
-- =============================================================================
begin;
select plan(12);

-- Fixture, run as the unrestricted connecting role -- panels has no seed
-- data in this repo at all, same reasoning every prior phase's own fixture
-- comment already documents.
insert into panels (id, type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack, price_per_panel)
values ('eeeeeeee-0000-0000-0006-000000000010', 60, 'Test P60 (Phase 13)', '150mm', '-/60/60', 10, 1, '64x38', '64x38', 3000, 6000, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 88)
on conflict (id) do nothing;

-- No seeded solo (company_id null) project exists in this suite's fixture
-- data -- every seeded project belongs to Company A or B -- so a dedicated
-- one is inserted here, owned by the same member@e2e.test seed user other
-- files already use.
insert into projects (id, owner_id, company_id, name, data, stage, created_at, updated_at)
values ('eeeeeeee-0000-0000-0002-000000000099', 'eeeeeeee-0000-0000-0000-000000000008', null, 'Solo project (Phase 13 fixture)',
  '{"v":1,"walls":[],"activeId":1,"nextId":1,"projectStock":"","projectLock":false,"customLengthInput":"","customActive":false,"system":"speedpanel","mode":"external","dimUnit":"mm"}'::jsonb,
  'draft', now(), now())
on conflict (id) do nothing;

set local role authenticated;

-- =============================================================================
-- audit.list_all: super_admin-only by default, same as companies.list --
-- no role_permissions row for it, so a non-staff caller's own
-- admin_list_audit_log() call returns zero rows, not an error.
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member (non-staff)
select is(
  (select count(*)::int from admin_list_audit_log()),
  0, 'non-staff member: admin_list_audit_log() returns zero rows -- has_permission(''audit.list_all'') gate, not an exception'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin

-- =============================================================================
-- price_list_assigned -- previously-missing log_audit() call on
-- admin_set_company_price_list().
-- =============================================================================
select lives_ok(
  $$ select admin_set_company_price_list('eeeeeeee-0000-0000-0001-000000000001', (select id from price_lists where is_default)) $$,
  'super_admin: admin_set_company_price_list() succeeds'
);
select is(
  (select count(*)::int from admin_list_audit_log('eeeeeeee-0000-0000-0001-000000000001', 'price_list_assigned')),
  1, 'price_list_assigned was logged for Company A'
);
select is(
  (select (detail->>'price_list_id')::uuid from admin_list_audit_log('eeeeeeee-0000-0000-0001-000000000001', 'price_list_assigned') limit 1),
  (select id from price_lists where is_default), 'price_list_assigned detail carries the assigned price_list_id'
);

-- =============================================================================
-- pricing_used_in_order -- previously-missing log_audit() call on
-- create_order(), backing the Transaction Price Trace.
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member, owns project 0001 (Company A)
select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-audit', 'category', 'panel', 'label', 'Audit trail test', 'qty', 1, 'unit', 'panel',
         'productId', 'eeeeeeee-0000-0000-0006-000000000010', 'unitPriceExGst', 1, 'lineTotalExGst', 1, 'matched', true)
     ), null) $$,
  'member: create_order() succeeds'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin
select is(
  (select count(*)::int from admin_list_audit_log('eeeeeeee-0000-0000-0001-000000000001', 'pricing_used_in_order')),
  1, 'pricing_used_in_order was logged for Company A''s new order'
);
select is(
  (select detail->>'subtotal_ex_gst' from admin_list_audit_log('eeeeeeee-0000-0000-0001-000000000001', 'pricing_used_in_order') limit 1),
  '88.00', 'pricing_used_in_order detail carries the resolved subtotal (88 = catalog price x qty 1)'
);
select ok(
  (select detail->>'order_id' from admin_list_audit_log('eeeeeeee-0000-0000-0001-000000000001', 'pricing_used_in_order') limit 1) is not null,
  'pricing_used_in_order detail carries an order_id -- what the Transaction Price Trace keys off'
);

-- log_audit() itself no-ops when company_id is null (see its own comment in
-- schema.sql) -- a solo/no-company project's order never gets a
-- pricing_used_in_order row, since there's no company to attribute it to.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member, owns the solo fixture project directly
select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000099', jsonb_build_array(
       jsonb_build_object('id', 'li-solo', 'category', 'panel', 'label', 'Solo order test', 'qty', 1, 'unit', 'panel',
         'productId', 'eeeeeeee-0000-0000-0006-000000000010', 'unitPriceExGst', 1, 'lineTotalExGst', 1, 'matched', true)
     ), null) $$,
  'member: create_order() succeeds on their own company-less project'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin
select is(
  (select count(*)::int from audit_logs where event_type = 'pricing_used_in_order'),
  1, 'the solo project''s order did NOT add a 2nd pricing_used_in_order row anywhere -- log_audit() silently no-ops on a null company_id'
);

-- =============================================================================
-- Cross-company scoping: super_admin without a company filter sees both
-- companies' events; with a filter, only the named company's.
-- =============================================================================
select ok(
  (select count(*)::int from admin_list_audit_log()) >= 2,
  'super_admin: admin_list_audit_log() with no company filter sees events across companies'
);
select is(
  (select count(*)::int from admin_list_audit_log(p_company_id => 'eeeeeeee-0000-0000-0001-000000000002', p_event_type => 'pricing_used_in_order')),
  0, 'super_admin: filtering by Company B returns none of Company A''s pricing_used_in_order event logged in this file'
);

select * from finish();
rollback;
