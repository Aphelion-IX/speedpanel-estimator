-- =============================================================================
-- guard_order_delivery_allocation() -- server-side trigger enforcing that a
-- delivery split (customer direct insert/update, admin_create_delivery,
-- admin_update_delivery) never allocates more of a line item than the
-- order actually contains. See supabase/schema.sql's "Delivery
-- request/approval workflow" section for the trigger itself.
-- =============================================================================
begin;
select plan(8);

-- Reuses seeded orders (see supabase/seed.sql) purely as FK anchors --
-- line_items is overwritten here with fixture data scoped to each scenario
-- so the checks below are self-contained and order-independent. Run as the
-- unrestricted connecting role (before the `set local role authenticated`
-- switch below), since these are plain fixture writes, not part of what's
-- under test, and orders' own RLS UPDATE policy would otherwise require a
-- matching owner/admin JWT claim that hasn't been set yet at this point.
update orders set line_items = '[{"id":"aaaaaaaa-0000-0000-0000-000000000001","category":"panel","label":"L1","qty":20,"unit":"ea","unitPriceExGst":10,"lineTotalExGst":200,"matched":true}]'::jsonb
  where id = 'eeeeeeee-0000-0000-0003-000000000001';
update orders set line_items = '[{"id":"aaaaaaaa-0000-0000-0000-000000000002","category":"panel","label":"L2","qty":5,"unit":"ea","unitPriceExGst":10,"lineTotalExGst":50,"matched":true}]'::jsonb
  where id = 'eeeeeeee-0000-0000-0003-000000000002';
update orders set line_items = '[
  {"id":"aaaaaaaa-0000-0000-0000-000000000003","category":"panel","label":"L3","qty":10,"unit":"ea","unitPriceExGst":10,"lineTotalExGst":100,"matched":true},
  {"id":"aaaaaaaa-0000-0000-0000-000000000004","category":"panel","label":"L4","qty":10,"unit":"ea","unitPriceExGst":10,"lineTotalExGst":100,"matched":true}
]'::jsonb where id = 'eeeeeeee-0000-0000-0003-000000000003';

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Scenario A: a legitimate split -- two deliveries summing to EXACTLY the
-- ordered qty -- succeeds on both admin_create_delivery calls.
-- Order eeeeeeee-...0003-...0001 (draft, owned by member 0008); staff RPCs
-- don't gate on order stage, only has_permission().
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000004')::text, true); -- internal_sales
select lives_ok(
  $$ select admin_create_delivery('eeeeeeee-0000-0000-0003-000000000001', '1 A St', null, 'Sub', 'NSW', '2000', 'Contact', '0400000000', null, null, null, null, '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000001","qty":12}]'::jsonb) $$,
  'legitimate split: first delivery (12 of 20) succeeds'
);
select lives_ok(
  $$ select admin_create_delivery('eeeeeeee-0000-0000-0003-000000000001', '1 A St', null, 'Sub', 'NSW', '2000', 'Contact', '0400000000', null, null, null, null, '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000001","qty":8}]'::jsonb) $$,
  'legitimate split: second delivery (8 of 20, exactly exhausting it) succeeds'
);

-- ---------------------------------------------------------------------------
-- Scenario B: a customer direct INSERT that would over-allocate is rejected.
-- Order eeeeeeee-...0003-...0002 (proforma_requested, owned by company-admin
-- 0007) -- satisfies the customer INSERT policy's stage check.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000007')::text, true); -- company-admin, owner
select throws_ok(
  $$ insert into order_deliveries (order_id, sequence_no, address_line1, suburb, state, postcode, approval_status, item_allocations)
     values ('eeeeeeee-0000-0000-0003-000000000002', 99, '1 B St', 'Sub', 'NSW', '2000', 'pending', '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000002","qty":6}]'::jsonb) $$,
  'P0001',
  'Over-allocated: line item aaaaaaaa-0000-0000-0000-000000000002 requests 6 but only 5 remain (of 5 ordered)',
  'customer direct insert requesting 6 of a 5-qty line item is rejected'
);

-- ---------------------------------------------------------------------------
-- Scenario C: admin_create_delivery() over-allocating is rejected.
-- Order eeeeeeee-...0003-...0003 (proforma_issued) already has a seeded
-- delivery row (eeeeeeee-...0004-...0001, item_allocations '[]') that
-- shouldn't interfere -- confirms the trigger correctly excludes empty
-- sibling allocations from the running total.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000004')::text, true); -- internal_sales
select lives_ok(
  $$ select admin_create_delivery('eeeeeeee-0000-0000-0003-000000000003', '1 C St', null, 'Sub', 'NSW', '2000', 'Contact', '0400000000', null, null, null, null, '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000003","qty":10}]'::jsonb) $$,
  'admin_create_delivery: allocating exactly the full 10-qty line item succeeds'
);
select throws_ok(
  $$ select admin_create_delivery('eeeeeeee-0000-0000-0003-000000000003', '1 C St', null, 'Sub', 'NSW', '2000', 'Contact', '0400000000', null, null, null, null, '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000003","qty":1}]'::jsonb) $$,
  'P0001',
  'Over-allocated: line item aaaaaaaa-0000-0000-0000-000000000003 requests 1 but only 0 remain (of 10 ordered)',
  'admin_create_delivery: a further allocation once the line item is exhausted is rejected'
);

-- ---------------------------------------------------------------------------
-- Scenario D/E: admin_update_delivery() -- increasing an existing delivery's
-- allocation past what's remaining (given a sibling delivery's existing
-- allocation) is rejected; reducing it always succeeds regardless of
-- siblings. Uses L4 (qty 10) on the same order -- two deliveries split 6/3.
-- Switches to super_admin (0001): the lookup below does a plain SELECT on
-- order_deliveries, which internal_sales can't see via RLS for a
-- project/company they have no membership row on (see "Owners, company,
-- and admins can read order deliveries" -- can_view_project()) -- staff
-- normally read deliveries only through admin_list_delivery_requests()'s
-- own security-definer bypass. super_admin satisfies has_permission() via
-- has_staff_role() and is_admin() via the same route, so it's a stand-in
-- that clears both gates at once, purely for this test's own bookkeeping.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin
select admin_create_delivery('eeeeeeee-0000-0000-0003-000000000003', '1 D St', null, 'Sub', 'NSW', '2000', 'Contact', '0400000000', null, null, null, null, '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000004","qty":6}]'::jsonb);
select admin_create_delivery('eeeeeeee-0000-0000-0003-000000000003', '1 D St', null, 'Sub', 'NSW', '2000', 'Contact', '0400000000', null, null, null, null, '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000004","qty":3}]'::jsonb);

-- Locate the qty-3 delivery by content rather than capturing its returned id
-- (no existing test file in this suite uses psql's \gset, so this stays
-- consistent with the rest of the pgTAP conventions here).
select throws_ok(
  $$ select admin_update_delivery(
       (select id from order_deliveries where order_id = 'eeeeeeee-0000-0000-0003-000000000003' and item_allocations @> '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000004","qty":3}]'::jsonb),
       '1 D St', null, 'Sub', 'NSW', '2000', 'Contact', '0400000000', null, null, null,
       '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000004","qty":5}]'::jsonb) $$,
  'P0001',
  'Over-allocated: line item aaaaaaaa-0000-0000-0000-000000000004 requests 5 but only 4 remain (of 10 ordered)',
  'admin_update_delivery: bumping past what remains (given a sibling''s 6) is rejected'
);
select lives_ok(
  $$ select admin_update_delivery(
       (select id from order_deliveries where order_id = 'eeeeeeee-0000-0000-0003-000000000003' and item_allocations @> '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000004","qty":3}]'::jsonb),
       '1 D St', null, 'Sub', 'NSW', '2000', 'Contact', '0400000000', null, null, null,
       '[{"lineItemId":"aaaaaaaa-0000-0000-0000-000000000004","qty":1}]'::jsonb) $$,
  'admin_update_delivery: reducing an allocation always succeeds regardless of siblings'
);

-- ---------------------------------------------------------------------------
-- Scenario F: an allocation referencing a lineItemId not present on the
-- order at all is rejected.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000004')::text, true); -- internal_sales
select throws_ok(
  $$ select admin_create_delivery('eeeeeeee-0000-0000-0003-000000000003', '1 E St', null, 'Sub', 'NSW', '2000', 'Contact', '0400000000', null, null, null, null, '[{"lineItemId":"ffffffff-0000-0000-0000-000000000099","qty":1}]'::jsonb) $$,
  'P0001',
  'Line item ffffffff-0000-0000-0000-000000000099 is not part of order eeeeeeee-0000-0000-0003-000000000003',
  'an allocation against a lineItemId absent from the order is rejected'
);

select * from finish();
rollback;
