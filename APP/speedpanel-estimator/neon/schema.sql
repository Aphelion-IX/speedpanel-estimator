-- =============================================================================
-- Speedpanel schema -- Neon (Postgres, no Supabase-specific features)
-- =============================================================================
-- Ported from supabase/schema.sql. RLS, Supabase's anon/authenticated roles,
-- and the auth.users-linked trigger are all gone -- there is no anonymous
-- Postgres role here and the browser never talks to this database directly.
-- The Vercel serverless API layer (api/) is the only holder of the
-- connection string and is responsible for authorization in code (verify the
-- caller's Neon Auth session, then apply the same owner/admin checks that
-- used to live in RLS policies) before running any of the statements below.
--
-- id columns that used to reference auth.users(id) (profiles.id,
-- projects.owner_id, project_stage_events.actor_id) are now plain `text`
-- columns with no FK target -- Neon Auth's user id format isn't confirmed to
-- be uuid-shaped, and neon_auth.users_sync updates asynchronously (eventual,
-- not transactional), so a hard FK to it would be a correctness hazard, not
-- a safety net. These columns are trusted because only the serverless layer
-- (which has already verified the caller) ever writes them.
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

-- All catalog tables are fully public (no auth required) -- matches
-- AdminGate.tsx being a no-op and the api/*.ts routes for these tables
-- requiring no auth check. RLS is not enabled anywhere in this schema.

-- =============================================================================
-- Admin auth: profiles + role
-- =============================================================================
-- One row per authenticated user, holding the admin/user role that the
-- serverless API's requireAdmin()/is_admin() checks read. No signup UI for
-- promoting to admin -- every promotion is a manual
--   update profiles set role = 'admin' where id = '<user-id>';
-- against this database, same convention as before.
-- =============================================================================

create table if not exists profiles (
  id text primary key,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No trigger here -- there is no auth.users table to attach one to. A
-- profile row is instead created on demand by api/_lib/auth.ts's
-- getOrCreateProfile() the first time a given user id is seen on an
-- authenticated request.

create or replace function public.is_admin(p_caller_id text) returns boolean
language sql stable
as $$
  select exists (select 1 from profiles where id = p_caller_id and role = 'admin');
$$;

-- =============================================================================
-- Customer quote requests
-- =============================================================================
-- Public (anonymous, no auth) customers submit via the "Request a Quote"
-- form. Only an authenticated admin (profiles.role = 'admin') may read or
-- update rows -- enforced in api/requests.ts (GET/PATCH), not here.
-- project_snapshot, when present, is the raw wallStore.ts PersistedProject
-- payload the customer opted to attach -- stored as-is, never
-- recomputed/validated server-side beyond the submit-time Zod check.
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

-- =============================================================================
-- Saved projects: builder + stage tracker
-- =============================================================================
-- Authenticated users save/reopen named estimator projects here. `data` is
-- the wallStore.ts PersistedProject snapshot extended with the view-state
-- fields from appShell/session.ts (system/mode/dimUnit), stored as-is.
--
-- Stage is a simple linear state machine: draft -> install_review ->
-- technical_review -> approved. Every transition goes through one of the
-- four functions below, which validate the CURRENT stage server-side (RLS
-- can't do that -- it only ever sees the new row) inside one atomic
-- transaction with a `for update` row lock, same as before. The only change
-- from the Supabase version: the caller's id is now an explicit trusted
-- parameter (p_caller_id) passed by the serverless layer after it has
-- already verified the Neon Auth session, instead of being read from
-- auth.uid() inside the function.
-- =============================================================================

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null,
  data jsonb not null,
  stage text not null default 'draft' check (stage in ('draft', 'install_review', 'technical_review', 'approved')),
  install_review_status text check (install_review_status in ('pending', 'approved', 'changes_requested')),
  install_review_note text,
  technical_review_status text check (technical_review_status in ('pending', 'approved', 'changes_requested')),
  technical_review_note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert-only audit trail -- never updated, one row per stage transition.
create table if not exists project_stage_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  actor_id text,
  event_type text not null check (event_type in (
    'install_review_requested', 'install_review_approved', 'install_review_changes_requested',
    'technical_review_requested', 'technical_review_approved', 'technical_review_changes_requested'
  )),
  note text,
  created_at timestamptz not null default now()
);

-- --- Stage-transition functions -----------------------------------------------
-- Each takes p_caller_id as an explicit trusted argument -- safe because only
-- api/projects/[id]/request-*-review.ts and api/admin/projects/[id]/review-*.ts
-- (which have already verified the caller via Neon Auth) ever invoke these;
-- there is no anon/authenticated Postgres role that could call them directly.

create or replace function public.request_install_review(p_project_id uuid, p_caller_id text)
returns void
language plpgsql
as $$
declare
  v_owner text;
  v_stage text;
begin
  select owner_id, stage into v_owner, v_stage from projects where id = p_project_id for update;
  if v_owner is null then raise exception 'Project not found'; end if;
  if v_owner is distinct from p_caller_id then raise exception 'Not authorized'; end if;
  if v_stage <> 'draft' then raise exception 'Install review can only be requested from Draft'; end if;

  update projects set stage = 'install_review', install_review_status = 'pending', updated_at = now()
    where id = p_project_id;
  insert into project_stage_events (project_id, actor_id, event_type)
    values (p_project_id, p_caller_id, 'install_review_requested');
end;
$$;

create or replace function public.review_install(p_project_id uuid, p_decision text, p_note text, p_caller_id text)
returns void
language plpgsql
as $$
declare
  v_stage text;
begin
  if not public.is_admin(p_caller_id) then raise exception 'Not authorized'; end if;
  if coalesce(p_decision, '') not in ('approved', 'changes_requested') then raise exception 'Invalid decision'; end if;

  select stage into v_stage from projects where id = p_project_id for update;
  if v_stage is null then raise exception 'Project not found'; end if;
  if v_stage <> 'install_review' then raise exception 'Project is not awaiting install review'; end if;

  if p_decision = 'approved' then
    -- Back to draft, NOT straight to technical_review -- approving install
    -- review only clears the way for the customer to request a technical
    -- review next; it doesn't request it on their behalf.
    update projects set stage = 'draft', install_review_status = 'approved', updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, p_caller_id, 'install_review_approved', p_note);
  else
    update projects set stage = 'draft', install_review_status = 'changes_requested', install_review_note = p_note, updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, p_caller_id, 'install_review_changes_requested', p_note);
  end if;
end;
$$;

create or replace function public.request_technical_review(p_project_id uuid, p_caller_id text)
returns void
language plpgsql
as $$
declare
  v_owner text;
  v_stage text;
  v_install_status text;
begin
  select owner_id, stage, install_review_status into v_owner, v_stage, v_install_status
    from projects where id = p_project_id for update;
  if v_owner is null then raise exception 'Project not found'; end if;
  if v_owner is distinct from p_caller_id then raise exception 'Not authorized'; end if;
  if v_stage <> 'draft' then raise exception 'Technical review can only be requested from Draft'; end if;
  if v_install_status is distinct from 'approved' then raise exception 'Install review must be approved first'; end if;

  update projects set stage = 'technical_review', technical_review_status = 'pending', updated_at = now()
    where id = p_project_id;
  insert into project_stage_events (project_id, actor_id, event_type)
    values (p_project_id, p_caller_id, 'technical_review_requested');
end;
$$;

create or replace function public.review_technical(p_project_id uuid, p_decision text, p_note text, p_caller_id text)
returns void
language plpgsql
as $$
declare
  v_stage text;
begin
  if not public.is_admin(p_caller_id) then raise exception 'Not authorized'; end if;
  if coalesce(p_decision, '') not in ('approved', 'changes_requested') then raise exception 'Invalid decision'; end if;

  select stage into v_stage from projects where id = p_project_id for update;
  if v_stage is null then raise exception 'Project not found'; end if;
  if v_stage <> 'technical_review' then raise exception 'Project is not awaiting technical review'; end if;

  if p_decision = 'approved' then
    update projects set stage = 'approved', technical_review_status = 'approved', updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, p_caller_id, 'technical_review_approved', p_note);
  else
    update projects set stage = 'draft', technical_review_status = 'changes_requested', technical_review_note = p_note, updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, p_caller_id, 'technical_review_changes_requested', p_note);
  end if;
end;
$$;

-- =============================================================================
-- Admin Documents catalog (Education Hub metadata staging area)
-- =============================================================================
create table if not exists admin_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  title text not null,
  category text not null,
  tags jsonb not null default '[]'::jsonb,
  description text not null default '',
  edition text not null default '',
  date text not null default '',
  file_size text not null default '',
  file_type text not null default '',
  page_count int not null default 0,
  swatch text not null default '',
  sections jsonb not null default '[]'::jsonb,
  file_url text
);

-- =============================================================================
-- Admin Systems -- "Locked system data" rows
-- =============================================================================
create table if not exists system_locked_rows (
  system text primary key check (system in ('internal', 'external')),
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into system_locked_rows (system, rows) values
  ('internal', '[]'::jsonb),
  ('external', '[]'::jsonb)
on conflict (system) do nothing;

-- =============================================================================
-- Admin Maths -- durable cross-device copy of MathConstants
-- =============================================================================
create table if not exists math_constants (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  values jsonb not null,
  updated_at timestamptz not null default now(),
  check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);
