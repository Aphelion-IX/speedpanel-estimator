-- =============================================================================
-- Speedpanel admin product catalog -- starter schema (foundation only)
-- =============================================================================
-- Mirrors the five entity shapes in src/pages/admin/products/productTypes.ts
-- (AdminPanel/AdminTrack/AdminFixing/AdminSealant/AdminColour) as the intended
-- 1:1 target for a future migration. NOT wired to the app yet -- Admin >
-- Products still reads/writes localStorage only (see productStore.ts). Nested/
-- array fields are kept as jsonb rather than normalized into join tables; that
-- decision belongs to the actual migration phase, not this foundation.
--
-- RLS is enabled on every table with a public read-only SELECT policy and no
-- write policy. The anon/publishable key is inherently world-readable, and
-- there's no auth yet to gate writes -- safe defaults for a schema nothing
-- calls yet, not a scope change.
-- =============================================================================

create extension if not exists pgcrypto;

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

-- --- Row Level Security -------------------------------------------------------
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

-- No insert/update/delete policies yet -- writes are blocked for the anon/
-- publishable key until an authenticated admin role exists.

-- =============================================================================
-- Admin auth: profiles + role
-- =============================================================================
-- One row per auth.users row, holding the admin/user role that
-- src/lib/useAuth.ts checks to gate the Admin section (see AdminGate.tsx).
-- Unlike the catalog tables above, this is NOT publicly readable -- a user may
-- only read their own row, which is all the client-side role check needs.
-- There is no signup UI; every account (and its role) is created/promoted
-- manually, e.g.:
--   update profiles set role = 'admin' where id = '<user-uuid>';
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

-- No insert/update/delete policy -- rows are created only by the trigger
-- below (as security definer) and promoted to admin only via the SQL editor/
-- service-role, never by the signed-in user themselves.

-- Auto-provision a profile (default role 'user') for every new auth user, so
-- there's never a signed-in user with no matching profiles row.
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

-- =============================================================================
-- Customer quote requests
-- =============================================================================
-- Public (anonymous, no auth) customers submit via the "Request a Quote" form
-- at src/pages/ProjectsPage.tsx. Only an authenticated admin (profiles.role =
-- 'admin') may read or update rows. project_snapshot, when present, is the
-- raw wallStore.ts PersistedProject payload the customer opted to attach --
-- stored as-is, never recomputed/validated server-side.
--
-- These are the first insert/update policies in this file (every table above
-- only has "for select"). Public write access is intentional -- this is the
-- one table anonymous visitors must be able to write to.
-- =============================================================================

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  message text,
  project_snapshot jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed'))
);

alter table requests enable row level security;

create policy "Public insert access" on requests
  for insert with check (true);

create policy "Admins can read requests" on requests
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update requests" on requests
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
