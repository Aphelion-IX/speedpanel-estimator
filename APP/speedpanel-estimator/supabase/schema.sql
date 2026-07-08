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

-- Trigger execution doesn't require EXECUTE privilege on the function, so
-- revoking it from anon/authenticated closes off direct RPC calls
-- (POST /rest/v1/rpc/handle_new_user) without affecting the trigger above.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

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

-- =============================================================================
-- Saved projects: builder + stage tracker
-- =============================================================================
-- Authenticated users (see profiles above) save/reopen named estimator
-- projects here. `data` is the wallStore.ts PersistedProject snapshot extended
-- with the view-state fields from appShell/session.ts (system/mode/dimUnit),
-- stored as-is/unvalidated with its own "v" field for forward compatibility --
-- same convention as requests.project_snapshot above.
--
-- Stage is a simple linear state machine: draft -> install_review ->
-- technical_review -> approved. Customers request a review from draft; admins
-- approve (advances the stage) or request changes (bounces back to draft with
-- a note). Unlike requests.status (a flat 3-value enum with no history), this
-- needs an audit trail (who requested/actioned what, when, with what note --
-- see project_stage_events) and transition ordering that a plain check
-- constraint or RLS policy can't express, since RLS only ever sees the new
-- row, not the old one. Every transition therefore goes through one of the
-- four security definer functions below rather than a raw client-side update
-- -- the "Owners and admins can update projects" policy intentionally covers
-- name/data/deleted_at edits only; the functions bypass it (as security
-- definer) after validating the transition themselves.
-- =============================================================================

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
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
  actor_id uuid references auth.users (id),
  event_type text not null check (event_type in (
    'install_review_requested', 'install_review_approved', 'install_review_changes_requested',
    'technical_review_requested', 'technical_review_approved', 'technical_review_changes_requested'
  )),
  note text,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
alter table project_stage_events enable row level security;

-- Shared admin check -- DRYs up the "exists (select 1 from profiles ...)"
-- subquery the requests policies above repeat inline. Security definer so it
-- reliably evaluates against the profiles table regardless of the calling
-- context (e.g. nested inside another table's RLS policy).
create or replace function public.is_admin() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "Owners and admins can read projects" on projects
  for select using (auth.uid() = owner_id or public.is_admin());

create policy "Owners can create their own projects" on projects
  for insert with check (auth.uid() = owner_id);

create policy "Owners and admins can update projects" on projects
  for update using (auth.uid() = owner_id or public.is_admin())
  with check (auth.uid() = owner_id or public.is_admin());

create policy "Owners and admins can read project stage events" on project_stage_events
  for select using (
    exists (select 1 from projects where projects.id = project_id and (projects.owner_id = auth.uid() or public.is_admin()))
  );

-- No insert/update/delete policy on project_stage_events -- rows are only
-- ever created by the security definer functions below, which bypass RLS.

-- --- Stage-transition functions -----------------------------------------------
-- Each is security definer so it can (a) validate the CURRENT stage
-- server-side before allowing a transition -- which a plain RLS policy can't
-- express, since it only ever sees the new row -- and (b) force
-- actor_id = auth.uid() rather than trust a client-supplied value.

create or replace function public.request_install_review(p_project_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_stage text;
begin
  select owner_id, stage into v_owner, v_stage from projects where id = p_project_id for update;
  if v_owner is null then raise exception 'Project not found'; end if;
  if v_owner <> auth.uid() then raise exception 'Not authorized'; end if;
  if v_stage <> 'draft' then raise exception 'Install review can only be requested from Draft'; end if;

  update projects set stage = 'install_review', install_review_status = 'pending', updated_at = now()
    where id = p_project_id;
  insert into project_stage_events (project_id, actor_id, event_type)
    values (p_project_id, auth.uid(), 'install_review_requested');
end;
$$;

create or replace function public.review_install(p_project_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  -- p_decision is a plain function argument (no NOT NULL enforced at the SQL
  -- level) -- coalesce guards a null argument the same way the "is distinct
  -- from" fix above guards a nullable column, so this rejects rather than
  -- silently falls through to the "changes_requested" branch below.
  if coalesce(p_decision, '') not in ('approved', 'changes_requested') then raise exception 'Invalid decision'; end if;

  select stage into v_stage from projects where id = p_project_id for update;
  if v_stage is null then raise exception 'Project not found'; end if;
  if v_stage <> 'install_review' then raise exception 'Project is not awaiting install review'; end if;

  if p_decision = 'approved' then
    -- Back to draft, NOT straight to technical_review -- approving install
    -- review only clears the way for the customer to request a technical
    -- review next (see request_technical_review's own stage='draft' check
    -- below); it doesn't request it on their behalf. Two explicit customer
    -- actions (request install review, request technical review), not one
    -- auto-chained on approval.
    update projects set stage = 'draft', install_review_status = 'approved', updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, auth.uid(), 'install_review_approved', p_note);
  else
    update projects set stage = 'draft', install_review_status = 'changes_requested', install_review_note = p_note, updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, auth.uid(), 'install_review_changes_requested', p_note);
  end if;
end;
$$;

create or replace function public.request_technical_review(p_project_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_stage text;
  v_install_status text;
begin
  select owner_id, stage, install_review_status into v_owner, v_stage, v_install_status
    from projects where id = p_project_id for update;
  if v_owner is null then raise exception 'Project not found'; end if;
  if v_owner <> auth.uid() then raise exception 'Not authorized'; end if;
  if v_stage <> 'draft' then raise exception 'Technical review can only be requested from Draft'; end if;
  -- install_review_status is nullable (never requested yet) -- "is distinct
  -- from" (not "<>") is required here so a null value is correctly treated
  -- as "not approved" rather than making the whole comparison null, which
  -- plpgsql's `if` silently treats as false (i.e. <> would let this through).
  if v_install_status is distinct from 'approved' then raise exception 'Install review must be approved first'; end if;

  update projects set stage = 'technical_review', technical_review_status = 'pending', updated_at = now()
    where id = p_project_id;
  insert into project_stage_events (project_id, actor_id, event_type)
    values (p_project_id, auth.uid(), 'technical_review_requested');
end;
$$;

create or replace function public.review_technical(p_project_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  -- p_decision is a plain function argument (no NOT NULL enforced at the SQL
  -- level) -- coalesce guards a null argument the same way the "is distinct
  -- from" fix above guards a nullable column, so this rejects rather than
  -- silently falls through to the "changes_requested" branch below.
  if coalesce(p_decision, '') not in ('approved', 'changes_requested') then raise exception 'Invalid decision'; end if;

  select stage into v_stage from projects where id = p_project_id for update;
  if v_stage is null then raise exception 'Project not found'; end if;
  if v_stage <> 'technical_review' then raise exception 'Project is not awaiting technical review'; end if;

  if p_decision = 'approved' then
    update projects set stage = 'approved', technical_review_status = 'approved', updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, auth.uid(), 'technical_review_approved', p_note);
  else
    update projects set stage = 'draft', technical_review_status = 'changes_requested', technical_review_note = p_note, updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, auth.uid(), 'technical_review_changes_requested', p_note);
  end if;
end;
$$;

revoke execute on function public.request_install_review(uuid) from public;
revoke execute on function public.review_install(uuid, text, text) from public;
revoke execute on function public.request_technical_review(uuid) from public;
revoke execute on function public.review_technical(uuid, text, text) from public;
grant execute on function public.request_install_review(uuid) to authenticated;
grant execute on function public.review_install(uuid, text, text) to authenticated;
grant execute on function public.request_technical_review(uuid) to authenticated;
grant execute on function public.review_technical(uuid, text, text) to authenticated;
