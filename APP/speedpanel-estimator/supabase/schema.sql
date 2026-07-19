-- =============================================================================
-- Speedpanel estimator -- auth-only schema
-- =============================================================================
-- The product catalog tables (panels/tracks/fixings/sealants/colours),
-- Admin Systems/Maths backing stores (system_locked_rows/math_constants/
-- system_tables) and everything before them (Projects, Orders, Deliveries,
-- Companies, Support/Service Requests, Admin Users/Companies/Roles/
-- Permissions, Requests, Documents, Price Lists, Audit Log) have all been
-- deleted, both here and on the live database. This was deliberate and
-- explicitly confirmed, not an accident -- see the PR/session history if
-- any of it needs to be reconstructed later.
--
-- The catalog tables in particular turned out to be genuinely disconnected
-- from the live calculator despite the name: the Estimator/Selector's real
-- panel/track/fixing/sealant/colour specs live in src/data.ts (a hardcoded,
-- bundled TypeScript module -- "single source of truth", edited by hand,
-- never read from Supabase), and its math constants/system tables are read
-- from localStorage synchronously at load, not fetched live either. The
-- now-deleted tables only ever backed the Admin > Products/Systems/Maths
-- pages' own cross-device persistence -- dropping them has zero effect on
-- what an estimate actually computes.
--
-- What's left is the minimal auth scaffolding required for sign-in to keep
-- working -- the whole app is sign-in-gated with no anonymous access
-- anywhere (see App.tsx: `if (!auth.session) return <LandingPage />`), so
-- accounts have to keep working with no business layer or catalog behind
-- them at all.
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- Minimal auth -- profiles
-- =============================================================================
-- One row per auth.users row. `role` is kept (rather than dropped entirely)
-- since it's the cheapest possible no-op -- nothing currently reads it, but
-- removing it buys nothing either.
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
