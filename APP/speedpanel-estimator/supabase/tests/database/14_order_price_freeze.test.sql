-- =============================================================================
-- Company Accounts & Pricing Phase 10 -- order price freeze:
-- create_order() re-resolving every line item's price server-side
-- (ignoring a fabricated client-sent unitPriceExGst entirely), all 4
-- pricing tiers (override/assigned list/PL1 default/deprecated catalog
-- column), cross-company isolation of that resolution, the authorization
-- check replacing the old bare-insert RLS policy, and revise_order()'s new
-- metadata-stamping-without-overriding-price behavior.
-- =============================================================================
-- Same set_config('request.jwt.claims', ...) session-simulation technique as
-- every other numbered file in this suite -- real RLS, no service-role
-- bypass. Everything here runs inside one transaction, rolled back at the
-- end.
-- =============================================================================
begin;
select plan(36);

-- Fixtures, run as the unrestricted connecting role -- panels has no seed
-- data in this repo at all, same reasoning every prior phase's own fixture
-- comment already documents. panel_a has a deprecated catalog price (the
-- 4th/final fallback tier); panel_b/panel_c have none (they're only ever
-- priced via a price list in this file, to isolate the assigned-list/PL1
-- tiers from the catalog-fallback tier cleanly).
select ok(
  not has_function_privilege('authenticated', 'public.resolve_effective_price(uuid, text, uuid)'::regprocedure, 'EXECUTE'),
  'resolve_effective_price() is NOT directly callable by authenticated -- it takes an arbitrary company_id with no membership check of its own, so a direct grant would let any signed-in user probe another company''s override pricing'
);

insert into panels (id, type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack, price_per_panel)
values
  ('eeeeeeee-0000-0000-0006-000000000005', 55, 'Test P55 (Phase 10 A)', '150mm', '-/60/60', 10, 1, '64x38', '64x38', 3000, 6000, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 77),
  ('eeeeeeee-0000-0000-0006-000000000006', 56, 'Test P56 (Phase 10 B)', '150mm', '-/60/60', 10, 1, '64x38', '64x38', 3000, 6000, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null),
  ('eeeeeeee-0000-0000-0006-000000000007', 57, 'Test P57 (Phase 10 C)', '150mm', '-/60/60', 10, 1, '64x38', '64x38', 3000, 6000, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null)
on conflict (id) do nothing;

set local role authenticated;

-- =============================================================================
-- Tier 4 (deprecated catalog column) + the core "server ignores the
-- client's fabricated price" guarantee, as Company A's own project owner
-- (member@e2e.test, who directly owns project ...0001).
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member, owns project 0001

select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-a', 'category', 'panel', 'label', 'Fabricated price test', 'qty', 2, 'unit', 'panel',
         'productId', 'eeeeeeee-0000-0000-0006-000000000005', 'unitPriceExGst', 1, 'lineTotalExGst', 2, 'matched', true)
     ), null) $$,
  'member: create_order() succeeds against their own project'
);
select is(
  (select (line_items->0->>'unitPriceExGst')::numeric from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-a'),
  77::numeric, 'the server-resolved catalog price (77) replaces the client''s fabricated price (1) entirely'
);
select is(
  (select subtotal_ex_gst from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-a'),
  154::numeric, 'subtotal is recomputed server-side from the resolved price (77 x 2), not the client''s fabricated total'
);
select is(
  (select (line_items->0->>'priceSource') from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-a'),
  null, 'priceSource is null for the deprecated-catalog-column tier -- no price list or override was involved'
);

-- =============================================================================
-- Tier 1 (company override) -- wins over the catalog column above.
-- company_price_overrides has no insert policy for authenticated at all
-- (every write goes through admin_set_company_price_override()) -- reset to
-- the unrestricted connecting role for this raw fixture insert, same
-- technique 13_company_price_overrides.test.sql's own guard-trigger tests
-- use, then switch back.
-- =============================================================================
reset role;
insert into company_price_overrides (company_id, category, panel_id, override_price, effective_date, created_by)
values ('eeeeeeee-0000-0000-0001-000000000001', 'panel', 'eeeeeeee-0000-0000-0006-000000000005', 50, current_date, 'eeeeeeee-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member again

select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-override', 'category', 'panel', 'label', 'Override test', 'qty', 1, 'unit', 'panel',
         'productId', 'eeeeeeee-0000-0000-0006-000000000005', 'unitPriceExGst', 1, 'lineTotalExGst', 1, 'matched', true)
     ), null) $$,
  'member: create_order() succeeds with a current override in effect'
);
select is(
  (select (line_items->0->>'unitPriceExGst')::numeric from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-override'),
  50::numeric, 'the override price (50) wins over the catalog column (77)'
);
select is(
  (select (line_items->0->>'priceSource') from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-override'),
  'override', 'priceSource is tagged "override"'
);
select is(
  (select (line_items->0->>'overrideId') from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-override'),
  (select id::text from company_price_overrides where company_id = 'eeeeeeee-0000-0000-0001-000000000001' and panel_id = 'eeeeeeee-0000-0000-0006-000000000005'),
  'overrideId correctly identifies which override row was used'
);

-- =============================================================================
-- Tiers 2/3 (assigned list vs. PL1 default) -- reassign Company A off PL1
-- onto its own list, price panel_b there (assigned-list tier) but only
-- price panel_c on PL1 (default tier, since panel_c has no row on the
-- newly-assigned list at all).
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin

select lives_ok( $$ select admin_create_price_list('Test PL 10') $$, 'super_admin: creates Test PL 10' );
select lives_ok(
  $$ select admin_set_company_price_list('eeeeeeee-0000-0000-0001-000000000001', (select id from price_lists where name = 'Test PL 10')) $$,
  'super_admin: assigns Test PL 10 to Company A'
);
-- admin_create_price_list() creates v1 already ACTIVE (not draft) -- a
-- price can only ever be set on a draft version, so a fresh list needs
-- admin_create_draft_version() first, same as every version-editing pgTAP
-- fixture in this suite already does (see 11_price_list_versions.test.sql/
-- 12_publish_price_list_version.test.sql).
select lives_ok(
  $$ select admin_create_draft_version((select id from price_lists where name = 'Test PL 10')) $$,
  'super_admin: admin_create_draft_version() succeeds for Test PL 10 (v2)'
);
select lives_ok(
  $$ select admin_set_draft_price((select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 10') and status = 'draft'), 'panel', 'eeeeeeee-0000-0000-0006-000000000006', 60) $$,
  'super_admin: prices panel_b on Test PL 10''s draft'
);
select lives_ok(
  $$ select admin_publish_price_list_version((select id from price_list_versions where price_list_id = (select id from price_lists where name = 'Test PL 10') and status = 'draft'), null, null) $$,
  'super_admin: publishes Test PL 10 immediately'
);
select lives_ok(
  $$ select admin_create_draft_version((select id from price_lists where is_default)) $$,
  'super_admin: admin_create_draft_version() succeeds for PL1 -- Standard'
);
select lives_ok(
  $$ select admin_set_draft_price((select id from price_list_versions where price_list_id = (select id from price_lists where is_default) and status = 'draft'), 'panel', 'eeeeeeee-0000-0000-0006-000000000007', 35) $$,
  'super_admin: prices panel_c on PL1''s draft (NOT on Test PL 10)'
);
select lives_ok(
  $$ select admin_publish_price_list_version((select id from price_list_versions where price_list_id = (select id from price_lists where is_default) and status = 'draft'), null, null) $$,
  'super_admin: publishes PL1''s new draft immediately'
);

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member again

select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-assigned', 'category', 'panel', 'label', 'Assigned-list test', 'qty', 1, 'unit', 'panel',
         'productId', 'eeeeeeee-0000-0000-0006-000000000006', 'unitPriceExGst', 1, 'lineTotalExGst', 1, 'matched', true)
     ), null) $$,
  'member: create_order() resolves panel_b via the assigned list'
);
select is(
  (select (line_items->0->>'unitPriceExGst')::numeric from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-assigned'),
  60::numeric, 'panel_b prices at 60 -- Test PL 10''s (the assigned list''s) price'
);
select is(
  (select (line_items->0->>'priceSource') from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-assigned'),
  'price_list', 'priceSource is tagged "price_list" for the assigned-list tier'
);
-- Resolves Test PL 10's id via companies.price_list_id (readable by the
-- company's own member) rather than price_lists.name -- that table's own
-- RLS only exposes a non-default list's row to staff, so a name lookup as
-- non-staff member here would silently resolve to NULL and make this
-- assertion vacuously pass for the wrong reason. Same pitfall
-- 12_publish_price_list_version.test.sql's own fixture comment documents.
select is(
  (select price_list_version_id from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-assigned'),
  (select current_price_list_version_id((select price_list_id from companies where id = 'eeeeeeee-0000-0000-0001-000000000001'))),
  'the order''s own price_list_version_id column records the assigned list''s currently-effective version'
);

select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-default', 'category', 'panel', 'label', 'PL1-default test', 'qty', 1, 'unit', 'panel',
         'productId', 'eeeeeeee-0000-0000-0006-000000000007', 'unitPriceExGst', 1, 'lineTotalExGst', 1, 'matched', true)
     ), null) $$,
  'member: create_order() resolves panel_c via PL1 (not on the assigned list at all)'
);
select is(
  (select (line_items->0->>'unitPriceExGst')::numeric from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-default'),
  35::numeric, 'panel_c prices at 35 -- PL1''s price, since Test PL 10 has no row for it'
);
select is(
  (select (line_items->0->>'priceSource') from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-default'),
  'default', 'priceSource is tagged "default" for the PL1 fallback tier'
);

-- =============================================================================
-- Cross-company isolation: Company B's own override on panel_b must never
-- leak into Company A's resolution, even though both companies reference
-- the exact same product id.
-- =============================================================================
reset role;
insert into company_price_overrides (company_id, category, panel_id, override_price, effective_date, created_by)
values ('eeeeeeee-0000-0000-0001-000000000002', 'panel', 'eeeeeeee-0000-0000-0006-000000000006', 999, current_date, 'eeeeeeee-0000-0000-0000-000000000001');
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member (Company A) again
select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-isolation', 'category', 'panel', 'label', 'Isolation test', 'qty', 1, 'unit', 'panel',
         'productId', 'eeeeeeee-0000-0000-0006-000000000006', 'unitPriceExGst', 1, 'lineTotalExGst', 1, 'matched', true)
     ), null) $$,
  'member: create_order() unaffected by a same-product override belonging to a different company'
);
select is(
  (select (line_items->0->>'unitPriceExGst')::numeric from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-isolation'),
  60::numeric, 'Company A still resolves its own assigned-list price (60), never Company B''s override (999)'
);

-- =============================================================================
-- Unmatched item -- a productId that doesn't exist anywhere resolves to
-- unpriced ($0, matched false), never an error.
-- =============================================================================
select lives_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-unmatched', 'category', 'panel', 'label', 'No such product', 'qty', 3, 'unit', 'panel',
         'productId', '00000000-0000-0000-0000-000000000000', 'unitPriceExGst', 500, 'lineTotalExGst', 1500, 'matched', true)
     ), null) $$,
  'member: create_order() accepts a line item referencing a nonexistent product'
);
select is(
  (select unpriced_item_count from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-unmatched'),
  1, 'the unmatched item is correctly counted, at $0 -- the client''s fabricated $500 is discarded, not trusted'
);

-- =============================================================================
-- Authorization: Company B's own owner cannot create an order on Company
-- A's project (no membership, no ownership, not admin).
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000009')::text, true); -- outsider, Company B owner
select throws_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-x', 'category', 'panel', 'label', 'x', 'qty', 1, 'unit', 'panel', 'productId', null, 'unitPriceExGst', null, 'lineTotalExGst', 0, 'matched', false)
     ), null) $$,
  'P0001', 'Not authorized',
  'a Company B outsider cannot create_order() against Company A''s project'
);

-- =============================================================================
-- Validation.
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000008')::text, true); -- member again
select throws_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', '[]'::jsonb, null) $$,
  'P0001', 'Order must have at least one line item',
  'create_order() rejects an empty line-item array'
);
select throws_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-y', 'category', 'not_a_real_category', 'label', 'y', 'qty', 1, 'unit', 'panel', 'productId', null, 'unitPriceExGst', null, 'lineTotalExGst', 0, 'matched', false)
     ), null) $$,
  'P0001', 'Every line item needs an id and a recognized category, and quantity must be positive',
  'create_order() rejects an invalid category'
);
select throws_ok(
  $$ select create_order('eeeeeeee-0000-0000-0002-000000000001', jsonb_build_array(
       jsonb_build_object('id', 'li-z', 'category', 'panel', 'label', 'z', 'qty', -5, 'unit', 'panel', 'productId', null, 'unitPriceExGst', null, 'lineTotalExGst', 0, 'matched', false)
     ), null) $$,
  'P0001', 'Every line item needs an id and a recognized category, and quantity must be positive',
  'create_order() rejects a non-positive quantity'
);

-- =============================================================================
-- The old bare-insert path is genuinely closed -- no RLS policy grants
-- `authenticated` INSERT on orders anymore, only the SECURITY DEFINER RPCs.
-- =============================================================================
select throws_ok(
  $$ insert into orders (project_id, owner_id, line_items) values ('eeeeeeee-0000-0000-0002-000000000001', 'eeeeeeee-0000-0000-0000-000000000008', '[]'::jsonb) $$,
  '42501', 'new row violates row-level security policy for table "orders"',
  'a direct raw insert into orders is rejected -- no insert policy remains for authenticated'
);

-- =============================================================================
-- revise_order() stamps priceSource/priceListVersionId/overrideId for
-- traceability but never overwrites the staff-supplied price itself.
-- =============================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001')::text, true); -- super_admin
update orders set stage = 'submitted' where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-assigned';

select lives_ok(
  $$ select revise_order(
       (select id from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-assigned'),
       jsonb_build_array(
         jsonb_build_object('id', 'li-assigned', 'category', 'panel', 'label', 'Assigned-list test', 'qty', 1, 'unit', 'panel',
           'productId', 'eeeeeeee-0000-0000-0006-000000000006', 'unitPriceExGst', 12345, 'lineTotalExGst', 12345, 'matched', true)
       ),
       'Negotiated one-off price correction'
     ) $$,
  'super_admin (internal_sales-equivalent): revise_order() succeeds with a manually-corrected price'
);
select is(
  (select (line_items->0->>'unitPriceExGst')::numeric from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-assigned'),
  12345::numeric, 'the staff-supplied price (12345) is preserved verbatim -- revise_order() never force-recomputes it'
);
select is(
  (select (line_items->0->>'priceSource') from orders where project_id = 'eeeeeeee-0000-0000-0002-000000000001' and (line_items->0->>'id') = 'li-assigned'),
  'price_list', 'revise_order() still stamps priceSource (traceability metadata) even though it left the price itself alone'
);

select * from finish();
rollback;
