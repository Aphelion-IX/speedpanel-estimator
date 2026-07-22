-- =============================================================================
-- Show-and-tell demo seed -- large-scale synthetic dataset
-- =============================================================================
-- Generates 200 companies, 50 Speedpanel staff accounts, and 2000 customer
-- users, plus the projects/orders/invitations/etc. that go with them, at a
-- volume meant for demoing the Admin/Company Accounts & Pricing UIs with
-- realistic scale -- NOT for CI/RLS assertions (that's supabase/seed.sql's
-- job; this file is much bigger and coarser-grained by design). Deliberately
-- includes error/edge-case states throughout (suspended/closed companies,
-- companies with zero users, expired/stale-pending invitations, cancelled
-- orders, orders on hold, "changes requested" reviews) rather than only
-- happy-path rows, so the demo can show off how the app handles those
-- states too. Targets the schema as actually deployed on the live project,
-- not schema.sql's full history -- see the two "NOTE ON SCHEMA DRIFT"
-- comments below (companies.status, invitations.failure_reason) for two
-- migrations confirmed live-but-not-applied that this works around.
--
-- Idempotent-ish: guarded by a check for its own fixed marker company id
-- below (raises instead of double-seeding). Not safe to re-run after a
-- partial failure without first running teardown-demo.sql.
--
-- All emails are under the IANA-reserved `.test` TLD (RFC 2606), never a
-- real domain -- same convention supabase/seed.sql already uses for its own
-- `.test` fixtures.
--
-- Every id this file creates is a deterministic 'dddddddd-0000-0000-SSSS-*'
-- uuid (SSSS = a fixed per-entity-type segment, mirroring seed.sql's own
-- 'eeeeeeee-...' fixture convention) specifically so supabase/
-- teardown-demo.sql can find and remove every row this file creates by a
-- simple prefix/domain match, without keeping a separate id manifest.
-- Segments: 0000=people (auth.users), 0001=companies, 0002=projects,
-- 0003=orders, 0004=order_deliveries, 0006=requests, 0007=company_memberships,
-- 0008=staff_assignments, 0009=invitations, 000a=order_holds.
--
-- Run via psql (needs a real DEMO_SEED_PASSWORD -- shared by every "key
-- persona" account meant to actually sign in during a demo; every other
-- seeded account gets an unusable random password, since 2000+ accounts
-- don't all need to log in):
--   export DEMO_SEED_PASSWORD='...'
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed-demo.sql
-- Applying via the Supabase MCP connector's execute_sql (which can't run
-- psql meta-commands) means substituting the real password directly into
-- the one `select set_config(...)` call instead -- never write it back into
-- this file. See supabase/teardown-demo.sql to remove everything below.
-- =============================================================================
\set demo_password `printf '%s' "${DEMO_SEED_PASSWORD:?Set DEMO_SEED_PASSWORD before running seed-demo.sql}"`
select set_config('app.demo_password', :'demo_password', false);

do $$
begin
  if exists (select 1 from companies where id = 'dddddddd-0000-0000-0001-000000000001') then
    raise exception 'Demo seed already applied -- run supabase/teardown-demo.sql first';
  end if;
end $$;

-- =============================================================================
-- Scratch tables -- carry generated values between the INSERT statements
-- below so random()-derived fields (company slug, membership role/status,
-- etc.) stay consistent across the several real tables that need to agree
-- on them. Dropped at the very end of this file; if a run aborts partway,
-- these are safe leftover debris to drop manually before retrying.
-- =============================================================================
create table _demo_seed_staff (
  seq int primary key, id uuid not null, staff_role text not null,
  first_name text not null, last_name text not null, email text not null
);
create table _demo_seed_companies (
  seq int primary key, id uuid not null, legal_name text not null, trading_name text not null,
  slug text not null, status text not null, addr_suburb text not null, addr_state text not null,
  addr_postcode text not null
);
create table _demo_seed_users (
  seq int primary key, id uuid not null, company_seq int not null, first_name text not null,
  last_name text not null, email text not null, membership_role text not null, membership_status text not null
);
create table _demo_seed_projects (
  id uuid primary key, company_seq int not null, company_id uuid not null, owner_id uuid not null, stage text not null
);
create table _demo_seed_orders (
  id uuid primary key, project_id uuid not null, company_seq int not null, owner_id uuid not null, stage text not null
);

-- =============================================================================
-- 1. Staff (50 total: 6 named "key personas" with a real shared demo
--    password so a live demo can sign in as each staff_role, plus 44 more
--    filling out realistic headcount per role with unusable passwords).
-- =============================================================================
insert into _demo_seed_staff (seq, id, staff_role, first_name, last_name, email) values
  (1, 'dddddddd-0000-0000-0000-000000000001', 'super_admin',        'Demo', 'Admin',      'demo-admin@speedpanel.demo.test'),
  (2, 'dddddddd-0000-0000-0000-000000000002', 'project_manager',    'Demo', 'PM',         'demo-pm@speedpanel.demo.test'),
  (3, 'dddddddd-0000-0000-0000-000000000003', 'bdm',                'Demo', 'BDM',        'demo-bdm@speedpanel.demo.test'),
  (4, 'dddddddd-0000-0000-0000-000000000004', 'internal_sales',     'Demo', 'Sales',      'demo-sales@speedpanel.demo.test'),
  (5, 'dddddddd-0000-0000-0000-000000000005', 'dispatch',           'Demo', 'Dispatch',   'demo-dispatch@speedpanel.demo.test'),
  (6, 'dddddddd-0000-0000-0000-000000000006', 'technical_services', 'Demo', 'Technical',  'demo-technical@speedpanel.demo.test');

with p as (
  select
    array['super_admin','super_admin','super_admin',
          'project_manager','project_manager','project_manager','project_manager','project_manager','project_manager','project_manager','project_manager',
          'bdm','bdm','bdm','bdm','bdm','bdm','bdm','bdm',
          'internal_sales','internal_sales','internal_sales','internal_sales','internal_sales','internal_sales','internal_sales','internal_sales',
          'dispatch','dispatch','dispatch','dispatch','dispatch','dispatch','dispatch','dispatch',
          'technical_services','technical_services','technical_services','technical_services','technical_services','technical_services','technical_services','technical_services','technical_services'
    ]::text[] as roles,
    array['James','Olivia','William','Charlotte','Benjamin','Amelia','Lucas','Mia','Henry','Isla','Alexander','Grace','Ethan','Chloe','Samuel','Ruby','Jack','Zoe','Daniel','Ava','Matthew','Ella','Noah','Sophie','Liam']::text[] as first_names,
    array['Nguyen','Smith','Patel','Chen','Williams','Kumar','Brown','Wilson','Taylor','Anderson','Thomas','Lee','Walker','White','Harris','Clark','Lewis','Young','King','Wright','Scott','Green','Baker','Adams','Nelson']::text[] as last_names
)
insert into _demo_seed_staff (seq, id, staff_role, first_name, last_name, email)
select
  6 + gs,
  ('dddddddd-0000-0000-0000-' || lpad((6 + gs)::text, 12, '0'))::uuid,
  p.roles[gs],
  p.first_names[1 + ((gs - 1) % array_length(p.first_names, 1))],
  p.last_names[1 + ((gs * 7 - 1) % array_length(p.last_names, 1))],
  lower(p.first_names[1 + ((gs - 1) % array_length(p.first_names, 1))] || '.' || p.last_names[1 + ((gs * 7 - 1) % array_length(p.last_names, 1))]) || gs || '@speedpanel.demo.test'
from generate_series(1, 44) as gs, p;

do $$
declare
  v_dummy_hash text := crypt(gen_random_uuid()::text, gen_salt('bf'));
  v_demo_hash text := crypt(current_setting('app.demo_password'), gen_salt('bf'));
  r record;
begin
  for r in select * from _demo_seed_staff order by seq loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated', r.email,
      case when r.seq <= 6 then v_demo_hash else v_dummy_hash end,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.id, r.id::text, jsonb_build_object('sub', r.id::text, 'email', r.email),
      'email', now(), now(), now()
    );
    update profiles set role = 'admin', staff_role = r.staff_role,
      display_name = r.first_name || ' ' || r.last_name,
      title = case r.staff_role
        when 'super_admin' then 'Platform Administrator'
        when 'project_manager' then 'Project Manager'
        when 'bdm' then 'Business Development Manager'
        when 'internal_sales' then 'Internal Sales'
        when 'dispatch' then 'Dispatch Coordinator'
        when 'technical_services' then 'Technical Services'
      end
      where id = r.id;
  end loop;
end $$;

-- =============================================================================
-- 2. Companies (200 total: 3 named "key persona" demo companies -- a fully
--    staffed active flagship, a suspended company for the account-status
--    error demo, and a brand-new near-empty company -- plus 197 bulk
--    companies spanning active/suspended/closed).
--
-- NOTE ON SCHEMA DRIFT: schema.sql (Company Accounts & Pricing Phase 2)
-- expands companies.status to a 5-state model (pending/active/on_hold/
-- suspended/archived) and adds payment_terms/internal_notes/hold_* columns
-- -- confirmed live against this project that migration was never applied
-- (companies_status_check is still the original 3-state
-- active/suspended/closed, and none of those columns exist). This section
-- targets the schema actually deployed here, not schema.sql's full history
-- -- see the PR description for this finding, it's a separate concern from
-- this seed data itself and shouldn't be silently patched as a side effect
-- of seeding.
-- =============================================================================
insert into _demo_seed_companies (seq, id, legal_name, trading_name, slug, status, addr_suburb, addr_state, addr_postcode) values
  (1, 'dddddddd-0000-0000-0001-000000000001', 'Ironbark Cold Storage Constructions Pty Ltd', 'Ironbark Cold Storage', 'ironbark', 'active',    'Parramatta', 'NSW', '2150'),
  (2, 'dddddddd-0000-0000-0001-000000000002', 'Redgum Regional Developments Pty Ltd',        'Redgum Regional Developments', 'redgum', 'suspended', 'Geelong',    'VIC', '3220'),
  (3, 'dddddddd-0000-0000-0001-000000000003', 'Frontier Panel Solutions Pty Ltd',            'Frontier Panel Solutions', 'frontier', 'active',   'Fortitude Valley', 'QLD', '4006');

with p as (
  select
    array['Redgum','Blackwood','Coastal','Highland','Riverside','Summit','Horizon','Bluegum','Northside','Precision','Titan','Vantage','Meridian','Anchor','Cornerstone','Skyline','Pinnacle','Vanguard','Solstice','Harbour','Outback','Woodlands','Metro','Grandview','Crestline','Ashwood','Silverline','Falcon','Ridgeline','Northgate']::text[] as roots,
    array['Constructions','Builders','Building Group','Developments','Contracting','Industries','Projects Group','Civil','Building Co','Construction Services','Commercial Builders','Fabrication']::text[] as suffixes,
    array['Parramatta','Chatswood','Geelong','Dandenong','Fortitude Valley','Toowoomba','Fremantle','Joondalup','Adelaide','Mount Gambier','Hobart','Launceston','Darwin','Alice Springs','Canberra','Wollongong','Newcastle','Ballarat','Bendigo','Cairns','Townsville','Rockhampton','Bunbury','Mandurah','Gold Coast']::text[] as suburbs,
    array['NSW','NSW','VIC','VIC','QLD','QLD','WA','WA','SA','SA','TAS','TAS','NT','NT','ACT','NSW','NSW','VIC','VIC','QLD','QLD','QLD','WA','WA','QLD']::text[] as states,
    array['2150','2067','3220','3175','4006','4350','6160','6027','5000','5290','7000','7250','0800','0870','2600','2500','2300','3350','3550','4870','4810','4700','6230','6210','4217']::text[] as postcodes
)
insert into _demo_seed_companies (seq, id, legal_name, trading_name, slug, status, addr_suburb, addr_state, addr_postcode)
select
  3 + gs,
  ('dddddddd-0000-0000-0001-' || lpad((3 + gs)::text, 12, '0'))::uuid,
  p.roots[1 + ((gs - 1) % array_length(p.roots, 1))] || ' ' || p.suffixes[1 + (((gs - 1) / array_length(p.roots, 1)) % array_length(p.suffixes, 1))] || ' Pty Ltd',
  p.roots[1 + ((gs - 1) % array_length(p.roots, 1))] || ' ' || p.suffixes[1 + (((gs - 1) / array_length(p.roots, 1)) % array_length(p.suffixes, 1))],
  lower(regexp_replace(p.roots[1 + ((gs - 1) % array_length(p.roots, 1))], '[^a-zA-Z0-9]', '', 'g')) || gs,
  case
    when gs <= 165 then 'active'
    when gs <= 187 then 'suspended'
    else 'closed'
  end,
  p.suburbs[1 + ((gs - 1) % 25)], p.states[1 + ((gs - 1) % 25)], p.postcodes[1 + ((gs - 1) % 25)]
from generate_series(1, 197) as gs, p;

with default_pl as (select id from price_lists where is_default limit 1),
  creators as (select array_agg(id order by seq) as ids from _demo_seed_staff where staff_role in ('internal_sales', 'bdm')),
  super_admin_id as (select id from _demo_seed_staff where staff_role = 'super_admin' and seq = 1)
insert into companies (
  id, legal_name, trading_name, abn, customer_account_number, billing_email, phone, address, status,
  created_by, price_list_id, created_at, updated_at
)
select
  c.id, c.legal_name, c.trading_name,
  lpad((trunc(random() * 99999999999))::bigint::text, 11, '0'),
  'CUST-' || lpad(c.seq::text, 5, '0'),
  'accounts@' || c.slug || '.demo.test',
  (case c.addr_state when 'NSW' then '02' when 'ACT' then '02' when 'VIC' then '03' when 'TAS' then '03' when 'QLD' then '07' else '08' end)
    || ' ' || lpad((trunc(random() * 9999))::int::text, 4, '0') || ' ' || lpad((trunc(random() * 9999))::int::text, 4, '0'),
  (10 + (c.seq % 90))::text || ' Industrial Ave, ' || c.addr_suburb || ' ' || c.addr_state || ' ' || c.addr_postcode,
  c.status,
  case when c.seq in (1, 2, 3) then (select id from super_admin_id)
    else (select ids[1 + (c.seq % array_length(ids, 1))] from creators) end,
  (select id from default_pl),
  now() - ((c.seq % 400) || ' days')::interval,
  now()
from _demo_seed_companies c;

-- =============================================================================
-- 3. Customer users (2000 total: 5 named "key persona" accounts with a real
--    shared demo password, the rest with unusable passwords). Company
--    assignment for the bulk pool is deliberately uneven -- companies 4..188
--    (local 1..185) get a skewed random member count (some large, some
--    tiny), companies 189..200 get NONE (12 companies with zero users --
--    combined with company 3 (Frontier, curated empty-state), 13 total --
--    a genuinely demonstrable "no users yet" queue/filter case).
-- =============================================================================
insert into _demo_seed_users (seq, id, company_seq, first_name, last_name, email, membership_role, membership_status) values
  (1, 'dddddddd-0000-0000-0000-009000000001', 1, 'Sarah', 'Whitfield', 'demo-owner@ironbark.demo.test', 'owner', 'active'),
  (2, 'dddddddd-0000-0000-0000-009000000002', 1, 'Tom', 'Bracken', 'demo-member@ironbark.demo.test', 'estimator', 'active'),
  (3, 'dddddddd-0000-0000-0000-009000000003', 1, 'Priya', 'Deshmukh', 'demo-viewer@ironbark.demo.test', 'viewer', 'active'),
  (4, 'dddddddd-0000-0000-0000-009000000004', 2, 'Marcus', 'Reyes', 'demo-owner@redgum.demo.test', 'owner', 'active'),
  (5, 'dddddddd-0000-0000-0000-009000000005', 3, 'Ella', 'Fairweather', 'demo-owner@frontier.demo.test', 'owner', 'active');

with p as (
  select
    array['James','Olivia','William','Charlotte','Benjamin','Amelia','Lucas','Mia','Henry','Isla','Alexander','Grace','Ethan','Chloe','Samuel','Ruby','Jack','Zoe','Daniel','Ava','Matthew','Ella','Noah','Sophie','Liam']::text[] as first_names,
    array['Nguyen','Smith','Patel','Chen','Williams','Kumar','Brown','Wilson','Taylor','Anderson','Thomas','Lee','Walker','White','Harris','Clark','Lewis','Young','King','Wright','Scott','Green','Baker','Adams','Nelson']::text[] as last_names,
    (select array_agg(seq order by seq) from _demo_seed_companies where seq between 4 and 188) as bulk_company_pool
)
insert into _demo_seed_users (seq, id, company_seq, first_name, last_name, email, membership_role, membership_status)
select
  5 + gs,
  ('dddddddd-0000-0000-0000-' || lpad((10000 + gs)::text, 12, '0'))::uuid,
  comp.seq,
  fn, ln,
  lower(fn || '.' || ln) || gs || '@' || comp.slug || '.demo.test',
  -- weighted single-pick arrays, not a threshold CASE over a separately
  -- drawn random() -- a `lateral (select random())` with no reference to
  -- any preceding FROM item isn't actually correlated, so Postgres is free
  -- to hoist it into ONE evaluation shared by every generated row despite
  -- the LATERAL keyword (confirmed live: every one of 1980 generated users
  -- landed the exact same role/status before this fix). A single random()
  -- called directly in the SELECT list has no such hazard.
  (array['owner','admin','admin','project_manager','project_manager','project_manager','estimator','estimator','estimator','estimator','estimator','estimator','estimator','estimator','site_user','site_user','site_user','viewer','viewer'])[1 + floor(random() * 19)::int],
  (array['active','active','active','active','active','active','active','active','active','suspended','removed'])[1 + floor(random() * 11)::int]
from generate_series(1, 1995) as gs, p,
  lateral (select p.first_names[1 + ((gs * 3 - 1) % array_length(p.first_names, 1))] as fn) fnx,
  lateral (select p.last_names[1 + ((gs * 11 - 1) % array_length(p.last_names, 1))] as ln) lnx,
  -- pick the target company_seq exactly ONCE per row (a single random()
  -- draw, pinned via this lateral) and join to get its slug -- computing
  -- the pick twice (once for company_seq, once for the email's slug) would
  -- draw two different random values and desync the two.
  lateral (
    select case when gs <= 15 then 1 when gs <= 18 then 2
      else p.bulk_company_pool[1 + floor(power(random(), 2) * array_length(p.bulk_company_pool, 1))::int]
    end as picked_seq
  ) pick
  join _demo_seed_companies comp on comp.seq = pick.picked_seq;

do $$
declare
  v_dummy_hash text := crypt(gen_random_uuid()::text, gen_salt('bf'));
  v_demo_hash text := crypt(current_setting('app.demo_password'), gen_salt('bf'));
  r record;
begin
  for r in select * from _demo_seed_users order by seq loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated', r.email,
      case when r.seq <= 5 then v_demo_hash else v_dummy_hash end,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.id, r.id::text, jsonb_build_object('sub', r.id::text, 'email', r.email),
      'email', now(), now(), now()
    );
  end loop;
end $$;

insert into company_memberships (id, company_id, user_id, role, status, joined_at)
select
  ('dddddddd-0000-0000-0007-' || lpad(u.seq::text, 12, '0'))::uuid,
  c.id, u.id, u.membership_role, u.membership_status,
  now() - ((u.seq % 540) || ' days')::interval
from _demo_seed_users u join _demo_seed_companies c on c.seq = u.company_seq;

-- =============================================================================
-- 4. Staff assignments -- flagship (company 1) gets a full 5-role team;
--    every other company with members gets a PM+BDM (and, for ~70% of
--    them, internal_sales/dispatch/technical_services too) EXCEPT roughly
--    15%, deliberately left with no Speedpanel team assigned at all -- an
--    "unassigned company" gap for the BDM/PM queue views to show.
-- =============================================================================
with pools as (
  select
    (select array_agg(id order by seq) from _demo_seed_staff where staff_role = 'project_manager') as pm,
    (select array_agg(id order by seq) from _demo_seed_staff where staff_role = 'bdm') as bdm,
    (select array_agg(id order by seq) from _demo_seed_staff where staff_role = 'internal_sales') as is_,
    (select array_agg(id order by seq) from _demo_seed_staff where staff_role = 'dispatch') as dispatch,
    (select array_agg(id order by seq) from _demo_seed_staff where staff_role = 'technical_services') as tech,
    (select id from _demo_seed_staff where staff_role = 'super_admin' and seq = 1) as super_admin_id
),
eligible as (
  -- company 2 (Redgum, the suspended demo company) is always staffed
  -- deliberately -- a fully-staffed-but-suspended account is a more
  -- useful demo point than an unstaffed suspended company.
  select c.seq, c.id from _demo_seed_companies c
  where c.seq in (1, 2) or (c.status = 'active' and random() > 0.15)
),
rows as (
  select
    e.seq, e.id as company_id, role_name, staff_id, is_primary
  from eligible e, pools,
    lateral (values
      ('project_manager', pools.pm[1 + (e.seq % array_length(pools.pm, 1))], true),
      ('bdm', pools.bdm[1 + (e.seq % array_length(pools.bdm, 1))], true)
    ) as core(role_name, staff_id, is_primary)
  union all
  select e.seq, e.id, 'internal_sales', pools.is_[1 + (e.seq % array_length(pools.is_, 1))], false
  from eligible e, pools where e.seq in (1, 2) or random() < 0.7
  union all
  select e.seq, e.id, 'dispatch', pools.dispatch[1 + (e.seq % array_length(pools.dispatch, 1))], false
  from eligible e, pools where e.seq in (1, 2) or random() < 0.7
  union all
  select e.seq, e.id, 'technical_services', pools.tech[1 + (e.seq % array_length(pools.tech, 1))], false
  from eligible e, pools where e.seq in (1, 2) or random() < 0.7
)
insert into staff_assignments (id, company_id, staff_user_id, role, is_primary, active, created_by, created_at)
select
  ('dddddddd-0000-0000-0008-' || lpad(row_number() over (order by seq, role_name)::text, 12, '0'))::uuid,
  company_id, staff_id, role_name, is_primary, true,
  (select super_admin_id from pools limit 1),
  now() - ((seq % 300) || ' days')::interval
from rows;

-- =============================================================================
-- 5. Invitations -- pending/accepted/expired/cancelled across ~140
--    companies, including some genuinely expired-but-still-'pending' rows
--    (a real, demonstrable staleness gap) alongside properly 'expired'
--    ones. NOTE ON SCHEMA DRIFT: schema.sql (Company Accounts & Pricing
--    Phase 5) adds a 'delivery_failed' status + failure_reason column --
--    confirmed live against this project that migration was never applied
--    (invitations_status_check is still the original 4-state
--    pending/accepted/expired/cancelled, no failure_reason column), so
--    this section targets the schema actually deployed here. Same
--    out-of-scope-for-a-seed-task reasoning as the companies section above.
-- =============================================================================
with targets as (
  select c.seq, c.id as company_id, gs
  from _demo_seed_companies c, generate_series(1, 2) gs
  where c.status = 'active' and (c.seq + gs) % 3 <> 0
),
p as (
  select
    array['James','Olivia','William','Charlotte','Benjamin','Amelia','Lucas','Mia','Henry','Isla']::text[] as first_names,
    array['Nguyen','Smith','Patel','Chen','Williams','Kumar','Brown','Wilson','Taylor','Anderson']::text[] as last_names,
    (select array_agg(id order by seq) from _demo_seed_staff) as staff_pool
),
rowsrc as (
  select
    row_number() over () as rn, t.company_id,
    p.first_names[1 + ((t.seq * 5 + gs) % array_length(p.first_names, 1))] || ' ' || p.last_names[1 + ((t.seq * 3 + gs) % array_length(p.last_names, 1))] as invitee_name,
    lower(p.first_names[1 + ((t.seq * 5 + gs) % array_length(p.first_names, 1))]) || '.invite' || t.seq || gs || '@example.demo.test' as email,
    (array['owner', 'admin', 'project_manager', 'estimator', 'site_user', 'viewer'])[1 + ((t.seq + gs) % 6)] as role,
    (t.seq + gs) % 9 as bucket,
    p.staff_pool[1 + ((t.seq * 7 + gs) % array_length(p.staff_pool, 1))] as invited_by
  from targets t, p
)
insert into invitations (id, company_id, email, invitee_name, role, status, invited_by, created_at, expires_at, accepted_at)
select
  ('dddddddd-0000-0000-0009-' || lpad(rn::text, 12, '0'))::uuid,
  company_id, email, invitee_name, role,
  case when bucket < 4 then 'pending' when bucket < 6 then 'accepted' when bucket < 8 then 'expired' else 'cancelled' end,
  invited_by,
  now() - ((bucket + 1) || ' days')::interval,
  -- bucket=3 (still 'pending') deliberately gets a past expires_at too --
  -- nothing in this app auto-transitions a stale invitation to 'expired',
  -- so a real "sat past its own expiry, still shows as pending" gap is a
  -- genuinely demonstrable edge case alongside the properly-'expired' rows.
  case when bucket in (6, 7) then now() - '1 day'::interval when bucket = 3 then now() - '3 days'::interval else now() + '5 days'::interval end,
  case when bucket in (4, 5) then now() - ((bucket) || ' hours')::interval else null end
from rowsrc;

-- =============================================================================
-- 6. Projects -- one to ten per company that has an active member (flagship
--    gets 10, the on-hold company gets 3, the brand-new company gets 0),
--    with a realistic stage/review-outcome spread including
--    'changes_requested' outcomes.
-- =============================================================================
insert into projects (id, owner_id, company_id, name, data, stage, install_review_status, technical_review_status, created_at, updated_at)
select
  ('dddddddd-0000-0000-0002-' || lpad(row_number() over ()::text, 12, '0'))::uuid,
  owner_id, company_id, proj_name, proj_data, stage, install_status, tech_status, created_at, created_at
from (
  select
    c.id as company_id, owner.id as owner_id,
    (array['Cool Room Fitout','Warehouse Extension','Freezer Panel Upgrade','Site Office Refurbishment','New Build -- Distribution Shed','Loading Dock Upgrade','Processing Facility Fitout','Cold Storage Expansion','Panel Wall Replacement','Insulated Ceiling Retrofit','Abattoir Panel Install','Food Processing Plant Fitout','Clean Room Construction','Bulk Storage Facility','Manufacturing Plant Extension'])[1 + ((c.seq + gsx.gs) % 15)] || ' -- ' || c.trading_name as proj_name,
    jsonb_build_object(
      'v', 1, 'walls', '[]'::jsonb, 'activeId', 1, 'nextId', 1, 'projectStock', '', 'projectLock', false,
      'customLengthInput', '', 'customActive', false, 'system', 'speedpanel',
      'mode', case when (c.seq + gsx.gs) % 2 = 0 then 'internal' else 'external' end, 'dimUnit', 'mm'
    ) as proj_data,
    case when rsx.rs < 0.45 then 'draft' when rsx.rs < 0.68 then 'install_review' when rsx.rs < 0.85 then 'technical_review' else 'approved' end as stage,
    case
      when rsx.rs < 0.45 then null
      when rsx.rs < 0.68 then (case when random() < 0.6 then 'pending' when random() < 0.85 then 'approved' else 'changes_requested' end)
      else 'approved'
    end as install_status,
    case
      when rsx.rs < 0.68 then null
      when rsx.rs < 0.85 then (case when random() < 0.6 then 'pending' when random() < 0.85 then 'approved' else 'changes_requested' end)
      else 'approved'
    end as tech_status,
    now() - ((c.seq * 3 + gsx.gs * 11) % 365 || ' days')::interval as created_at
  from _demo_seed_companies c
  cross join lateral generate_series(1,
    case when c.seq = 1 then 10 when c.seq = 2 then 3 when c.seq = 3 then 0 else 1 + floor(random() * 5)::int end
  ) as gsx(gs)
  -- pinned once per (company, gs) row so stage/install_status/tech_status
  -- all agree on the same stage bucket -- install_status/tech_status's own
  -- CASE branches each reference random() only once, so those don't need
  -- separate pinning the way rs (referenced 3x above) does. The `+ (gsx.gs
  -- * 0)` is load-bearing, not decorative: a LATERAL subquery with NO
  -- reference to any preceding FROM item isn't actually correlated, so
  -- Postgres is free to hoist it into a single evaluation shared by every
  -- generated row regardless of the LATERAL keyword (confirmed live: every
  -- one of 543 generated projects landed 'draft' before this fix) -- this
  -- forces genuine per-row re-evaluation.
  cross join lateral (select random() + (gsx.gs * 0) as rs) rsx
  cross join lateral (
    select id from _demo_seed_users u where u.company_seq = c.seq and u.membership_status = 'active' order by random() limit 1
  ) owner
) gen;

insert into _demo_seed_projects (id, company_seq, company_id, owner_id, stage)
select p.id, cs.seq, p.company_id, p.owner_id, p.stage
from projects p
join _demo_seed_companies cs on cs.id = p.company_id
where p.id::text like 'dddddddd-0000-0000-0002-%';

-- =============================================================================
-- 7. Orders -- roughly 55% of non-draft projects get one, with a stage mix
--    that includes cancelled orders (error scenario) and a batch of
--    proforma_requested orders deliberately dated weeks in the past (a
--    stale/stuck-in-the-queue error scenario).
-- =============================================================================
with candidates as (
  select p.*, random() as pick, random() as os, random() as staleness
  from _demo_seed_projects p where p.stage <> 'draft'
),
chosen as (
  select * from candidates where pick < 0.55
),
line_item_src as (
  select
    row_number() over () as rn, c.*,
    (2 + floor(random() * 4))::int as item_count
  from chosen c
)
insert into orders (id, project_id, owner_id, stage, line_items, subtotal_ex_gst, gst_rate, gst_amount, total_inc_gst, unpriced_item_count, submitted_at, proforma_requested_at, proforma_issued_at, cancelled_at, created_at, updated_at)
select
  ('dddddddd-0000-0000-0003-' || lpad(l.rn::text, 12, '0'))::uuid,
  l.id, l.owner_id,
  case when l.os < 0.30 then 'draft' when l.os < 0.50 then 'submitted' when l.os < 0.70 then 'proforma_requested' when l.os < 0.90 then 'proforma_issued' else 'cancelled' end,
  items.line_items, items.subtotal, 0.10, round(items.subtotal * 0.10, 2), round(items.subtotal * 1.10, 2), 0,
  case when l.os >= 0.30 then now() - ((l.rn % 90) || ' days')::interval else null end,
  case when l.os >= 0.50 and l.staleness < 0.25 then now() - ((45 + l.rn % 60) || ' days')::interval when l.os >= 0.50 then now() - ((l.rn % 30) || ' days')::interval else null end,
  case when l.os >= 0.70 then now() - ((l.rn % 20) || ' days')::interval else null end,
  case when l.os >= 0.90 then now() - ((l.rn % 15) || ' days')::interval else null end,
  now() - ((l.rn % 120) || ' days')::interval,
  now()
from line_item_src l
cross join lateral (
  select
    jsonb_agg(jsonb_build_object(
      'id', gen_random_uuid()::text, 'category', (array['panel', 'track', 'fixing', 'sealant'])[1 + (n % 4)],
      'label', (array['SP100 Panel', 'C-Track 75mm', 'Z-Flash 150mm', 'Fixing Bolt M10', 'Sealant Cartridge', 'J-Track 50mm'])[1 + (n % 6)],
      'qty', 5 + n * 3, 'unit', 'ea', 'unitPriceExGst', round((45 + n * 12.5)::numeric, 2),
      'lineTotalExGst', round(((5 + n * 3) * (45 + n * 12.5))::numeric, 2), 'matched', true
    )) as line_items,
    sum(round(((5 + n * 3) * (45 + n * 12.5))::numeric, 2)) as subtotal
  from generate_series(1, l.item_count) as n
) items;

insert into _demo_seed_orders (id, project_id, company_seq, owner_id, stage)
select o.id, o.project_id, p.company_seq, o.owner_id, o.stage
from orders o
join _demo_seed_projects p on p.id = o.project_id
where o.id::text like 'dddddddd-0000-0000-0003-%';

-- =============================================================================
-- 8. Order holds -- ~10% of non-draft/non-cancelled orders get a hold (a
--    genuine "why is this order stuck" error state), skewed toward
--    submitted/proforma_requested orders. ~65% resolved, 35% still open.
-- =============================================================================
with pools as (select (select array_agg(id order by seq) from _demo_seed_staff) as staff_pool),
candidates as (
  select o.*, row_number() over () as rn, random() as pick, random() as resolve_pick, random() as type_pick
  from _demo_seed_orders o where o.stage in ('submitted', 'proforma_requested', 'proforma_issued')
)
insert into order_holds (id, order_id, hold_type, status, title, reason, customer_visible, customer_message, created_by, created_at, resolved_by, resolved_at)
select
  ('dddddddd-0000-0000-000a-' || lpad(rn::text, 12, '0'))::uuid,
  c.id,
  (case when type_pick < 0.2 then 'technical' when type_pick < 0.4 then 'pricing' when type_pick < 0.6 then 'delivery' when type_pick < 0.8 then 'credit' when type_pick < 0.9 then 'customer_information' else 'other' end)::order_hold_type,
  (case when resolve_pick < 0.65 then 'resolved' else 'open' end)::order_hold_status,
  case when type_pick < 0.2 then 'Technical review required' when type_pick < 0.4 then 'Pricing discrepancy flagged' when type_pick < 0.6 then 'Delivery address unconfirmed' when type_pick < 0.8 then 'Credit hold pending finance sign-off' when type_pick < 0.9 then 'Missing customer information' else 'General hold' end,
  'Auto-flagged for staff review before proceeding -- demo data.',
  resolve_pick < 0.3,
  case when resolve_pick < 0.3 then 'Your order is temporarily on hold -- our team will be in touch shortly.' else null end,
  pools.staff_pool[1 + (rn % array_length(pools.staff_pool, 1))],
  now() - ((rn % 40) || ' days')::interval,
  case when resolve_pick < 0.65 then pools.staff_pool[1 + ((rn * 3) % array_length(pools.staff_pool, 1))] else null end,
  case when resolve_pick < 0.65 then now() - ((rn % 10) || ' days')::interval else null end
from candidates c, pools
where c.pick < 0.10;

-- =============================================================================
-- 9. Order deliveries -- one per ~60% of proforma_issued orders, at a
--    realistic status spread including in-transit/delivered.
-- =============================================================================
with candidates as (
  select o.*, cs.addr_suburb, cs.addr_state, cs.addr_postcode, row_number() over () as rn, random() as pick, random() as status_pick
  from _demo_seed_orders o join _demo_seed_companies cs on cs.seq = o.company_seq
  where o.stage = 'proforma_issued'
)
insert into order_deliveries (id, order_id, sequence_no, address_line1, suburb, state, postcode, requested_date, status, item_allocations, created_at, updated_at)
select
  ('dddddddd-0000-0000-0004-' || lpad(rn::text, 12, '0'))::uuid,
  id, 1, (10 + (rn % 90))::text || ' Site Access Rd', addr_suburb, addr_state, addr_postcode,
  (current_date + ((rn % 21) || ' days')::interval)::date,
  case when status_pick < 0.3 then 'planned' when status_pick < 0.55 then 'scheduled' when status_pick < 0.8 then 'in_transit' else 'delivered' end,
  '[]'::jsonb,
  now() - ((rn % 10) || ' days')::interval, now()
from candidates
where pick < 0.6;

-- =============================================================================
-- 10. Quote requests -- a mix of project-linked and fully anonymous leads.
-- =============================================================================
with linked as (
  select p.*, row_number() over () as rn from _demo_seed_projects p where random() < 0.03
),
p as (
  select array['James','Olivia','William','Charlotte','Benjamin','Amelia','Lucas','Mia']::text[] as first_names,
         array['Nguyen','Smith','Patel','Chen','Williams','Kumar','Brown','Wilson']::text[] as last_names
)
insert into requests (id, created_at, name, email, phone, message, status, project_id)
select
  ('dddddddd-0000-0000-0006-' || lpad(rn::text, 12, '0'))::uuid,
  now() - ((rn % 60) || ' days')::interval,
  p.first_names[1 + (rn % 8)] || ' ' || p.last_names[1 + (rn % 8)],
  lower(p.first_names[1 + (rn % 8)]) || '.lead' || rn || '@example.demo.test',
  '04' || lpad((10000000 + rn * 137)::text, 8, '0'),
  'Interested in a quote for an upcoming project -- demo lead.',
  (array['new', 'contacted', 'closed'])[1 + (rn % 3)],
  id
from linked, p;

with p as (
  select array['Daniel','Ava','Matthew','Ella','Noah','Sophie','Liam','Grace']::text[] as first_names,
         array['Taylor','Anderson','Thomas','Lee','Walker','White','Harris','Clark']::text[] as last_names
)
insert into requests (id, created_at, name, email, phone, message, status, project_id)
select
  ('dddddddd-0000-0000-0006-' || lpad((5000 + gs)::text, 12, '0'))::uuid,
  now() - ((gs % 90) || ' days')::interval,
  p.first_names[1 + (gs % 8)] || ' ' || p.last_names[1 + (gs % 8)],
  lower(p.first_names[1 + (gs % 8)]) || '.anon' || gs || '@example.demo.test',
  '04' || lpad((20000000 + gs * 211)::text, 8, '0'),
  'General enquiry via public quote form -- demo lead, no account.',
  (array['new', 'contacted', 'closed'])[1 + (gs % 3)],
  null
from generate_series(1, 25) as gs, p;

-- =============================================================================
-- 11. Cleanup -- drop scratch tables, leaving only the real seeded rows.
-- =============================================================================
drop table _demo_seed_orders;
drop table _demo_seed_projects;
drop table _demo_seed_users;
drop table _demo_seed_companies;
drop table _demo_seed_staff;
