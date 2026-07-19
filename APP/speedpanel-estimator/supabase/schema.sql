-- =============================================================================
-- Speedpanel estimator -- calculator-only schema
-- =============================================================================
-- Rebuilt from scratch to hold ONLY what the Estimator/Selector calculator
-- itself needs: the read-only product catalog it prices against, the admin
-- catalog-editing tables (Products/Systems/Maths), and the minimal auth
-- scaffolding required for sign-in to keep working (the whole app is
-- sign-in-gated, no exceptions -- see App.tsx/SignInGate.tsx).
--
-- Everything else that previously lived in this file -- Projects, Orders,
-- Deliveries, Companies, Support/Service Requests, Admin Users/Companies/
-- Roles/Permissions, Requests (quote inbox), Documents, Price Lists,
-- Audit Log -- has been deleted, both here and on the live database. That
-- was a deliberate, explicitly-confirmed decision, not an accident; see the
-- PR/session history if this needs to be reconstructed later.
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- Product catalog -- panels/tracks/fixings/sealants/colours
-- =============================================================================
-- Mirrors the five entity shapes in src/pages/admin/products/productTypes.ts
-- (AdminPanel/AdminTrack/AdminFixing/AdminSealant/AdminColour). Nested/array
-- fields are kept as jsonb rather than normalized into join tables.
--
-- RLS is enabled with public read AND public write -- the anon/publishable
-- key is inherently world-readable, and Admin > Products has no separate
-- auth check of its own (matches AdminGate.tsx, which doesn't gate catalog
-- writes either).
-- =============================================================================

create table if not exists panels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  type int not null,
  label text not null,
  depth text not null,
  frl text not null,
  pack int not null,
  ctrack_stock numeric not null,
  ctrack_dim text not null,
  jtrack_dim text not null,
  max_h_vert numeric not null,
  max_h_horiz numeric not null,
  span_vert jsonb not null,
  span_horiz jsonb not null,
  corner_post jsonb not null,
  horiz_ctrack jsonb not null
);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  kind text not null, -- 'c-track' | 'j-track' | 'head-flash' | 'z-flash' | 'horiz-cover'
  system text not null, -- 'internal' | 'external' | 'both'
  label text not null,
  dim text not null,
  bmt text,
  panel_type int,
  stock_lengths jsonb not null default '[]'::jsonb
);

create table if not exists fixings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  code text not null,
  gauge text not null,
  length_mm numeric not null,
  use text not null,
  per_box int not null
);

create table if not exists sealants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  system text not null, -- 'internal' | 'external'
  product text not null,
  m2_per_sausage numeric not null,
  per_box int not null
);

create table if not exists colours (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  label text not null,
  code text not null,
  hex text not null
);

alter table panels   enable row level security;
alter table tracks   enable row level security;
alter table fixings  enable row level security;
alter table sealants enable row level security;
alter table colours  enable row level security;

create policy "Public read access" on panels   for select using (true);
create policy "Public read access" on tracks   for select using (true);
create policy "Public read access" on fixings  for select using (true);
create policy "Public read access" on sealants for select using (true);
create policy "Public read access" on colours  for select using (true);

create policy "Public write access"  on panels   for insert with check (true);
create policy "Public update access" on panels   for update using (true) with check (true);
create policy "Public delete access" on panels   for delete using (true);

create policy "Public write access"  on tracks   for insert with check (true);
create policy "Public update access" on tracks   for update using (true) with check (true);
create policy "Public delete access" on tracks   for delete using (true);

create policy "Public write access"  on fixings  for insert with check (true);
create policy "Public update access" on fixings  for update using (true) with check (true);
create policy "Public delete access" on fixings  for delete using (true);

create policy "Public write access"  on sealants for insert with check (true);
create policy "Public update access" on sealants for update using (true) with check (true);
create policy "Public delete access" on sealants for delete using (true);

create policy "Public write access"  on colours  for insert with check (true);
create policy "Public update access" on colours  for update using (true) with check (true);
create policy "Public delete access" on colours  for delete using (true);

-- =============================================================================
-- Per-unit pricing fields (nullable)
-- =============================================================================
-- Feeds the Estimator's own pricing/report computation directly (see
-- src/export/priceEstimateReportData.ts's catalog.panels.find(...).
-- pricePerPanel reads) -- calculator-relevant, unlike the (now-deleted)
-- Orders/Price-Lists layer that used to sit on top of these same columns as
-- a per-company override. Null means "not priced yet", not a deliberate $0.
-- Priced per how each item is actually counted: panels per panel, tracks
-- per linear metre, fixings/sealant per box. colours intentionally
-- untouched -- a colour is a finish attribute, never its own orderable line
-- item.
-- =============================================================================
alter table panels   add column if not exists price_per_panel numeric;
alter table tracks   add column if not exists price_per_metre numeric;
alter table fixings  add column if not exists price_per_box numeric;
alter table sealants add column if not exists price_per_box numeric;

-- =============================================================================
-- Admin Systems -- "Locked system data" rows
-- =============================================================================
-- One row per system (exactly 2: 'internal'/'external'), rows stored as a
-- single jsonb array matching LockedRow[] verbatim.
-- =============================================================================
create table if not exists system_locked_rows (
  system text primary key check (system in ('internal', 'external')),
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table system_locked_rows enable row level security;

create policy "Public read access" on system_locked_rows for select using (true);
create policy "Public update access" on system_locked_rows
  for update using (true) with check (true);

insert into system_locked_rows (system, rows) values
  ('internal', '[]'::jsonb),
  ('external', '[]'::jsonb)
on conflict (system) do nothing;

-- =============================================================================
-- Admin Maths -- durable cross-device copy of MathConstants
-- =============================================================================
-- Exactly one row (fixed id below). Durable, cross-device backing store that
-- the Admin > Maths page refreshes localStorage FROM in the background --
-- src/data.ts's own module-load read stays synchronous/localStorage-based.
-- =============================================================================
create table if not exists math_constants (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  values jsonb not null,
  updated_at timestamptz not null default now(),
  check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

alter table math_constants enable row level security;

create policy "Public read access" on math_constants for select using (true);
create policy "Public update access" on math_constants
  for update using (true) with check (true);

-- =============================================================================
-- Admin Maths -- durable cross-device copy of SystemTables (per-panel-type
-- corner-post / horizontal-C-track / shaft-track decision tables)
-- =============================================================================
create table if not exists system_tables (
  id uuid primary key default '00000000-0000-0000-0000-000000000002'::uuid,
  values jsonb not null,
  updated_at timestamptz not null default now(),
  check (id = '00000000-0000-0000-0000-000000000002'::uuid)
);

alter table system_tables enable row level security;

create policy "Public read access" on system_tables for select using (true);
create policy "Public update access" on system_tables
  for update using (true) with check (true);

insert into system_tables (id, values) values (
  '00000000-0000-0000-0000-000000000002',
  '{
    "cornerPost": {
      "51": [
        { "maxW": 3.0, "rows": [{ "maxH": 3.0, "section": "55 x 56 x 1.15" }, { "maxH": 4.0, "section": "55 x 57 x 1.50" }, { "maxH": 5.0, "section": "55 x 58 x 1.95" }] },
        { "maxW": 4.5, "rows": [{ "maxH": 3.0, "section": "55 x 57 x 1.50" }, { "maxH": 4.0, "section": "55 x 58 x 1.95" }, { "maxH": 5.0, "section": "55 x 58 x 1.95" }] }
      ],
      "64": [
        { "maxW": 3.0, "rows": [{ "maxH": 3.0, "section": "55 x 68 x 1.15" }, { "maxH": 4.0, "section": "55 x 69 x 1.50" }, { "maxH": 5.0, "section": "55 x 70 x 1.95" }] },
        { "maxW": 4.5, "rows": [{ "maxH": 3.0, "section": "55 x 69 x 1.50" }, { "maxH": 4.0, "section": "55 x 70 x 1.95" }, { "maxH": 5.0, "section": "55 x 70 x 1.95" }] }
      ],
      "78": [
        { "maxW": 3.0, "rows": [{ "maxH": 3.0, "section": "90 x 82 x 1.15" }, { "maxH": 4.5, "section": "90 x 83 x 1.50" }] },
        { "maxW": 4.5, "rows": [{ "maxH": 3.0, "section": "90 x 83 x 1.50" }, { "maxH": 4.5, "section": "90 x 84 x 1.95" }] }
      ]
    },
    "horizCtrack": {
      "51": [
        { "wMax": 3.0, "hMax": 3.0, "section": "55 x 56 x 1.15", "fix": 1 },
        { "wMax": 4.5, "hMax": 3.0, "section": "55 x 57 x 1.50", "fix": 1 },
        { "wMax": 3.0, "hMax": 4.0, "section": "55 x 57 x 1.50", "fix": 1 },
        { "wMax": 4.5, "hMax": 4.0, "section": "55 x 58 x 1.95", "fix": 1 },
        { "wMax": 4.5, "hMax": 5.0, "section": "55 x 58 x 1.95", "fix": 1 },
        { "wMax": 4.5, "hMax": null, "section": "55 x 58 x 1.95", "fix": 1, "outsideTable": true }
      ],
      "64": [
        { "wMax": 3.0, "hMax": 3.0, "section": "55 x 68 x 1.15", "fix": 1 },
        { "wMax": 4.5, "hMax": 3.0, "section": "55 x 69 x 1.50", "fix": 1 },
        { "wMax": 3.0, "hMax": 4.0, "section": "55 x 69 x 1.50", "fix": 1 },
        { "wMax": 4.5, "hMax": 4.0, "section": "55 x 70 x 1.95", "fix": 1 },
        { "wMax": 4.5, "hMax": 5.0, "section": "55 x 70 x 1.95", "fix": 1 },
        { "wMax": 4.5, "hMax": null, "section": "55 x 70 x 1.95", "fix": 1, "outsideTable": true }
      ],
      "78": [
        { "wMax": 3.0, "hMax": 3.0, "section": "90 x 82 x 1.15", "fix": 1 },
        { "wMax": 4.5, "hMax": 3.0, "section": "90 x 83 x 1.50", "fix": 1 },
        { "wMax": 3.0, "hMax": 4.5, "section": "90 x 83 x 1.50", "fix": 1 },
        { "wMax": 4.5, "hMax": 4.5, "section": "90 x 84 x 1.95", "fix": 1 },
        { "wMax": 3.5, "hMax": 6.0, "section": "90 x 84 x 1.95", "fix": 1 },
        { "wMax": 4.5, "hMax": 6.0, "section": "90 x 84 x 1.95", "fix": 2 },
        { "wMax": 4.5, "hMax": null, "section": "90 x 84 x 1.95", "fix": 2, "outsideTable": true }
      ]
    },
    "shaftTrack": [
      { "maxF": 3.0, "section": "90 x 82 x 1.50", "fixPerCourse": 1 },
      { "maxF": 4.5, "section": "90 x 84 x 1.95", "fixPerCourse": 1 },
      { "maxF": 6.0, "section": "90 x 84 x 1.95", "fixPerCourse": 2 }
    ]
  }'::jsonb
) on conflict (id) do nothing;

-- =============================================================================
-- Minimal auth -- profiles
-- =============================================================================
-- One row per auth.users row. The app is sign-in-gated everywhere (no
-- anonymous access to the Estimator/Selector), so accounts must keep
-- working even with no admin/business layer behind them. `role` is kept
-- (rather than dropped entirely) since it's the cheapest possible no-op --
-- nothing currently reads it, but removing it buys nothing either.
-- =============================================================================

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile" on profiles
  for select using (auth.uid() = id);

-- Auto-provision a profile for every new auth user, so there's never a
-- signed-in user with no matching profiles row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- =============================================================================
-- Foreign key indexes
-- =============================================================================
create index if not exists idx_profiles_id on profiles (id);
