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
-- at src/pages/projects/QuoteRequestPage.tsx, nested under the Projects tab
-- (see ProjectsRouter.tsx). Only an authenticated admin (profiles.role =
-- 'admin') may read or update rows. project_snapshot, when present, is the
-- raw wallStore.ts PersistedProject payload the customer opted to attach --
-- stored as-is, never recomputed/validated server-side. See project_id below
-- for the real FK link used when the request is submitted from a specific
-- signed-in user's saved project instead.
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
-- "from public" alone is NOT sufficient on Supabase -- it grants EXECUTE to
-- anon/authenticated by default on every newly created function as its own
-- separate grant, unaffected by revoking from PUBLIC (confirmed via the
-- security advisor after first deploying this without the explicit "anon").
revoke execute on function public.is_admin() from public, anon;
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
  -- "is distinct from" (not "<>") -- auth.uid() is null for an anonymous
  -- caller, and "v_owner <> null" evaluates to null, which plpgsql's `if`
  -- silently treats as false, bypassing this check entirely. Caught via
  -- Supabase's security advisor after deploying: these functions are also
  -- explicitly revoked from `anon` below as defense in depth, but this check
  -- must be correct on its own regardless of grants.
  if v_owner is distinct from auth.uid() then raise exception 'Not authorized'; end if;
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
  -- Same "is distinct from" fix as request_install_review above -- <> against
  -- a null auth.uid() (anonymous caller) silently bypasses the check.
  if v_owner is distinct from auth.uid() then raise exception 'Not authorized'; end if;
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

-- Same "revoke from anon" reasoning as is_admin() above -- Supabase's
-- default privileges made all four of these callable by anon too.
revoke execute on function public.request_install_review(uuid) from public, anon;
revoke execute on function public.review_install(uuid, text, text) from public, anon;
revoke execute on function public.request_technical_review(uuid) from public, anon;
revoke execute on function public.review_technical(uuid, text, text) from public, anon;
grant execute on function public.request_install_review(uuid) to authenticated;
grant execute on function public.review_install(uuid, text, text) to authenticated;
grant execute on function public.request_technical_review(uuid) to authenticated;
grant execute on function public.review_technical(uuid, text, text) to authenticated;

-- =============================================================================
-- Admin catalog writes: panels/tracks/fixings/sealants/colours
-- =============================================================================
-- Public read was already granted above. Writes are ALSO public (no admin
-- role or login required) -- AdminGate.tsx has no auth check, matching this.
-- requests/projects are NOT part of this -- those hold customer PII (name/
-- email/phone/project data) and stay gated to auth.uid()/is_admin() below.
-- =============================================================================
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
-- Admin Documents catalog (Education Hub metadata staging area)
-- =============================================================================
-- Mirrors src/pages/admin/documents/documentTypes.ts's AdminDocument 1:1.
-- Named admin_documents, not documents -- this is the Admin staging catalog,
-- deliberately decoupled from the live Education Hub (see documentTypes.ts),
-- leaving `documents` free for a future customer-facing table.
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

alter table admin_documents enable row level security;

create policy "Public read access" on admin_documents for select using (true);
create policy "Public write access"  on admin_documents for insert with check (true);
create policy "Public update access" on admin_documents for update using (true) with check (true);
create policy "Public delete access" on admin_documents for delete using (true);

-- =============================================================================
-- Admin Systems -- "Locked system data" rows
-- =============================================================================
-- One row per system (exactly 2: 'internal'/'external'), rows stored as a
-- single jsonb array matching LockedRow[] verbatim. LockedRow has no id and
-- the admin UI always replaces the whole array for one system at a time, so
-- a normalized per-row table would need position bookkeeping and a delete-
-- then-insert sequence (needing its own atomic RPC to be safe); storing the
-- whole array as one jsonb column instead makes "replace this system's rows"
-- a single atomic UPDATE, with no RPC needed.
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
-- No insert/delete policy -- exactly 2 rows exist forever, seeded once below;
-- clients only ever update the `rows` column of an existing row.

insert into system_locked_rows (system, rows) values
  ('internal', '[]'::jsonb),
  ('external', '[]'::jsonb)
on conflict (system) do nothing;

-- =============================================================================
-- Admin Maths -- durable cross-device copy of MathConstants
-- =============================================================================
-- Exactly one row (fixed id below, enforced by the check constraint). This
-- table is a durable, cross-device backing store that the Admin > Maths page
-- refreshes localStorage FROM in the background -- src/data.ts's own
-- module-load read stays 100% synchronous/localStorage-based and unchanged
-- (see src/mathConstants.ts), since data.ts reads it once before React even
-- mounts and there's no safe way to make that read async.
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
-- No insert/delete policy -- the single row is seeded once (below/by the
-- one-time backfill) and the fixed default id + check constraint make a
-- second row structurally impossible even if insert were ever granted.

-- =============================================================================
-- Admin: user roster, role management, and stage-event audit log
-- =============================================================================
-- profiles has no email column and auth.users is never directly queryable
-- via PostgREST, so both listing users and changing roles go through these
-- security definer RPCs, same "is_admin() gated, empty/error for anyone else"
-- pattern as is_admin()/review_install/review_technical already establish.
-- Backs the Admin > Users and Admin > Audit Log pages.
-- =============================================================================

-- create or replace only overloads on an exact signature match -- dropping
-- the old zero-arg version first avoids ending up with both it and the new
-- paginated one callable side by side (PostgREST would then have two
-- same-named RPCs to disambiguate between).
drop function if exists public.admin_list_users();

-- Paginated (p_limit/p_offset, default page size 50) -- this roster grows
-- with the customer base and has no natural upper bound, unlike the
-- pending-review-style queues elsewhere in Admin that self-limit to
-- whatever's currently awaiting action. admin_count_users() below is the
-- companion total-count RPC (used by Admin > Analytics), so that page never
-- has to page through every row just to count them.
create or replace function public.admin_list_users(p_limit int default 50, p_offset int default 0)
returns table (id uuid, email text, role text, created_at timestamptz)
language sql security definer stable
set search_path = public
as $$
  select p.id, u.email, p.role, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at desc
  limit p_limit offset p_offset;
$$;
revoke execute on function public.admin_list_users(int, int) from public, anon;
grant execute on function public.admin_list_users(int, int) to authenticated;

create or replace function public.admin_count_users()
returns table (total bigint, admins bigint)
language sql security definer stable
set search_path = public
as $$
  select count(*), count(*) filter (where role = 'admin')
  from public.profiles
  where public.is_admin();
$$;
revoke execute on function public.admin_count_users() from public, anon;
grant execute on function public.admin_count_users() to authenticated;

create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_admin_count int;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if coalesce(p_role, '') not in ('user', 'admin') then raise exception 'Invalid role'; end if;

  -- Refuse to demote the only remaining admin -- would otherwise lock every
  -- admin (including the caller) out of role management/Requests/Projects
  -- with no SQL-free way back in.
  if p_role = 'user' then
    select count(*) into v_admin_count from public.profiles where role = 'admin';
    if v_admin_count <= 1 and exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
      raise exception 'Cannot demote the only remaining admin';
    end if;
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
end;
$$;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- Same "drop the old exact-zero-arg overload first" reasoning as
-- admin_list_users above.
drop function if exists public.admin_list_stage_events();

-- Paginated, same reasoning as admin_list_users above -- this audit trail
-- only ever grows, one row per install/technical review action, forever.
create or replace function public.admin_list_stage_events(p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, project_id uuid, project_name text,
  actor_id uuid, actor_email text,
  event_type text, note text, created_at timestamptz
)
language sql security definer stable
set search_path = public
as $$
  select e.id, e.project_id, pr.name, e.actor_id, u.email, e.event_type, e.note, e.created_at
  from public.project_stage_events e
  join public.projects pr on pr.id = e.project_id
  left join auth.users u on u.id = e.actor_id
  where public.is_admin()
  order by e.created_at desc
  limit p_limit offset p_offset;
$$;
revoke execute on function public.admin_list_stage_events(int, int) from public, anon;
grant execute on function public.admin_list_stage_events(int, int) to authenticated;

-- =============================================================================
-- Admin catalog: per-unit pricing fields (nullable -- foundation for Orders)
-- =============================================================================
-- Nullable, not "not null default 0": null means "not priced yet" (surfaced
-- to admins/customers as an explicit gap), distinct from a deliberate $0.
-- Priced per how each item is actually counted/ordered: panels per panel,
-- tracks per linear metre, fixings/sealant per box. colours intentionally
-- untouched -- no per-unit ordering concept (a colour is a finish attribute
-- of a panel, never its own orderable line item).
-- =============================================================================
alter table panels   add column price_per_panel numeric;
alter table tracks   add column price_per_metre numeric;
alter table fixings  add column price_per_box numeric;
alter table sealants add column price_per_box numeric;

-- =============================================================================
-- Quote requests: optional link to a saved project
-- =============================================================================
-- Added after the fact, once the projects table existed to link to -- same
-- append-only convention as the per-unit pricing columns above. Nullable +
-- "on delete set null" (NOT "not null"/"cascade" like orders.project_id):
-- anonymous, project-less quote requests must remain possible, and deleting
-- a project should detach, not delete, any request historically tied to it.
-- =============================================================================
alter table requests add column project_id uuid references projects (id) on delete set null;

-- =============================================================================
-- Customer Orders, delivery splitting, and pro forma invoice requests
-- =============================================================================
-- A customer, from any saved project (no stage gating), can create an Order:
-- a frozen priced snapshot of that project's estimate line items (see
-- src/estimate/computeProjectReportData.ts + src/export/priceEstimateReportData.ts),
-- split across one or more delivery batches (each with its own address and a
-- manual per-line-item quantity allocation), then submitted and, as a
-- SEPARATE later step, have a pro forma invoice requested against it. Same
-- ownership/RLS/RPC conventions as projects/project_stage_events above.
--
-- Lifecycle: draft -> submitted -> proforma_requested -> proforma_issued,
-- plus cancelled (from draft/submitted/proforma_requested).
-- =============================================================================

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  -- Duplicated directly (not joined through project_id) -- unlike
  -- project_stage_events (a pure audit trail), an order is itself a
  -- first-class, independently browsable resource the same way projects is,
  -- so it gets the same direct owner_id + simple RLS as projects.
  owner_id uuid not null references auth.users (id) on delete cascade,
  stage text not null default 'draft' check (stage in ('draft', 'submitted', 'proforma_requested', 'proforma_issued', 'cancelled')),
  -- Frozen priced snapshot, written/replaced wholesale while still 'draft' --
  -- same "whole array as one jsonb column" convention as system_locked_rows.rows,
  -- not a real per-row table like project_stage_events, since nothing here
  -- needs independent per-row query/identity.
  -- Each element: { id, category, label, qty, unit, unitPriceExGst, lineTotalExGst, matched }
  line_items jsonb not null default '[]'::jsonb,
  subtotal_ex_gst numeric not null default 0,
  gst_rate numeric not null default 0.10,
  gst_amount numeric not null default 0,
  total_inc_gst numeric not null default 0,
  -- Count of line items that couldn't be auto-priced (see
  -- priceEstimateReportData.ts) -- surfaced to both customer and admin
  -- rather than silently treated as $0.
  unpriced_item_count int not null default 0,
  customer_note text,
  submitted_at timestamptz,
  proforma_requested_at timestamptz,
  proforma_issued_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders enable row level security;

create policy "Owners and admins can read orders" on orders
  for select using (auth.uid() = owner_id or public.is_admin());

-- Plain insert policy, not an RPC -- order creation has no current-state
-- transition to validate (no stage gating, per the customer-facing decision
-- above), so the only two things needed (force owner_id, verify project
-- ownership) are both expressible directly in with check, same as
-- projects' own "Owners can create their own projects" policy.
create policy "Owners can create their own orders" on orders
  for insert with check (
    auth.uid() = owner_id and exists (select 1 from projects where id = project_id and owner_id = auth.uid())
  );

-- Same tradeoff as projects.stage: RLS allows the owner to update any column
-- (including stage/*_at), but the client only ever calls the RPCs below for
-- those -- frontend discipline, not column-level DB enforcement, consistent
-- with the existing limitation on projects itself.
create policy "Owners and admins can update orders" on orders
  for update using (auth.uid() = owner_id or public.is_admin())
  with check (auth.uid() = owner_id or public.is_admin());

create table if not exists order_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  sequence_no int not null,
  address_line1 text not null,
  address_line2 text,
  suburb text not null,
  state text not null,
  postcode text not null,
  requested_date date,
  contact_name text,
  contact_phone text,
  notes text,
  -- [{ lineItemId, qty }] -- bulk-edited alongside its parent delivery batch,
  -- never independently queried across deliveries, same jsonb-column
  -- reasoning as orders.line_items above.
  item_allocations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table order_deliveries enable row level security;

create policy "Owners and admins can read order deliveries" on order_deliveries
  for select using (
    exists (select 1 from orders where orders.id = order_id and (orders.owner_id = auth.uid() or public.is_admin()))
  );

-- Customer can only add/edit/remove delivery batches while the order is
-- still draft (pre-submission); admin can adjust anytime.
create policy "Owners can manage deliveries while draft, admins anytime" on order_deliveries
  for all using (
    (exists (select 1 from orders o where o.id = order_id and o.owner_id = auth.uid() and o.stage = 'draft'))
    or public.is_admin()
  )
  with check (
    (exists (select 1 from orders o where o.id = order_id and o.owner_id = auth.uid() and o.stage = 'draft'))
    or public.is_admin()
  );

-- Insert-only audit trail, mirrors project_stage_events exactly.
create table if not exists order_stage_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  actor_id uuid references auth.users (id),
  event_type text not null check (event_type in ('submitted', 'proforma_requested', 'proforma_issued', 'cancelled')),
  note text,
  created_at timestamptz not null default now()
);

alter table order_stage_events enable row level security;

create policy "Owners and admins can read order stage events" on order_stage_events
  for select using (
    exists (select 1 from orders where orders.id = order_id and (orders.owner_id = auth.uid() or public.is_admin()))
  );
-- No insert/update/delete policy -- rows are only ever created by the
-- security definer functions below, which bypass RLS.

-- --- Stage-transition functions -----------------------------------------------
-- Same conventions as request_install_review/review_install/etc.: for update
-- row lock, "is distinct from" (not "<>") for nullable/possibly-null-auth.uid()
-- comparisons, coalesce for text args, actor_id forced to auth.uid().

create or replace function public.submit_order(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_stage text;
begin
  select owner_id, stage into v_owner, v_stage from orders where id = p_order_id for update;
  if v_owner is null then raise exception 'Order not found'; end if;
  if v_owner is distinct from auth.uid() then raise exception 'Not authorized'; end if;
  if v_stage <> 'draft' then raise exception 'Order can only be submitted from Draft'; end if;
  if not exists (select 1 from order_deliveries where order_id = p_order_id) then
    raise exception 'Add at least one delivery before submitting';
  end if;

  update orders set stage = 'submitted', submitted_at = now(), updated_at = now() where id = p_order_id;
  insert into order_stage_events (order_id, actor_id, event_type) values (p_order_id, auth.uid(), 'submitted');
end;
$$;

create or replace function public.request_proforma_invoice(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_stage text;
begin
  select owner_id, stage into v_owner, v_stage from orders where id = p_order_id for update;
  if v_owner is null then raise exception 'Order not found'; end if;
  if v_owner is distinct from auth.uid() then raise exception 'Not authorized'; end if;
  if v_stage <> 'submitted' then raise exception 'A pro forma invoice can only be requested once the order is submitted'; end if;

  update orders set stage = 'proforma_requested', proforma_requested_at = now(), updated_at = now() where id = p_order_id;
  insert into order_stage_events (order_id, actor_id, event_type) values (p_order_id, auth.uid(), 'proforma_requested');
end;
$$;

create or replace function public.issue_proforma_invoice(p_order_id uuid, p_note text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select stage into v_stage from orders where id = p_order_id for update;
  if v_stage is null then raise exception 'Order not found'; end if;
  if v_stage <> 'proforma_requested' then raise exception 'Order is not awaiting a pro forma invoice'; end if;

  update orders set stage = 'proforma_issued', proforma_issued_at = now(), updated_at = now() where id = p_order_id;
  insert into order_stage_events (order_id, actor_id, event_type, note) values (p_order_id, auth.uid(), 'proforma_issued', p_note);
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_stage text;
begin
  select owner_id, stage into v_owner, v_stage from orders where id = p_order_id for update;
  if v_owner is null then raise exception 'Order not found'; end if;
  if v_owner is distinct from auth.uid() and not public.is_admin() then raise exception 'Not authorized'; end if;
  if v_stage not in ('draft', 'submitted', 'proforma_requested') then raise exception 'Order can no longer be cancelled'; end if;

  update orders set stage = 'cancelled', cancelled_at = now(), updated_at = now() where id = p_order_id;
  insert into order_stage_events (order_id, actor_id, event_type) values (p_order_id, auth.uid(), 'cancelled');
end;
$$;

-- Same "revoke from anon" reasoning as request_install_review etc. above --
-- Supabase's default privileges made all four of these callable by anon too.
revoke execute on function public.submit_order(uuid) from public, anon;
revoke execute on function public.request_proforma_invoice(uuid) from public, anon;
revoke execute on function public.issue_proforma_invoice(uuid, text) from public, anon;
revoke execute on function public.cancel_order(uuid) from public, anon;
grant execute on function public.submit_order(uuid) to authenticated;
grant execute on function public.request_proforma_invoice(uuid) to authenticated;
grant execute on function public.issue_proforma_invoice(uuid, text) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;

-- =============================================================================
-- Manufacturing & delivery tracking (admin-editable)
-- =============================================================================
-- Applies once an order is confirmed (stage = 'proforma_issued') -- there's
-- no later order stage representing "fulfilled", so this tracking data IS
-- the fulfillment record, not a transition into a new stage.
--
-- No new RLS policies or RPCs needed: orders' own "Owners and admins can
-- update orders" policy already lets an admin write any column (same
-- frontend-discipline tradeoff already noted on that policy above), and
-- order_deliveries' "Owners can manage deliveries while draft, admins
-- anytime" policy already gives admins unrestricted write access -- both
-- simply unused by any UI until now.
--
-- panels_manufactured is nullable ("not started/no data yet" vs a real 0).
-- Total panel count is deliberately NOT stored here -- it's computed
-- client-side from the order's own line_items (category in
-- ('panel','custom_panel'), summed qty -- see
-- src/export/priceEstimateReportData.ts's ORDER_LINE_ITEM_CATEGORIES) so it
-- can never drift out of sync with the order it's describing.
alter table orders add column panels_manufactured int;
alter table orders add column manufacturing_est_completion date;

-- planned -> scheduled -> in_transit -> delivered, admin-set per delivery
-- batch. Same check-constraint-as-enum convention as orders.stage/
-- projects.stage above.
alter table order_deliveries add column status text not null default 'planned'
  check (status in ('planned', 'scheduled', 'in_transit', 'delivered'));

-- =============================================================================
-- Project documents -- file storage (shop drawings, delivery dockets, etc.)
-- =============================================================================
-- This app's first real file-upload feature -- Education Hub's admin_documents
-- deliberately has no storage backend (fileUrl points at a static /docs path,
-- see AdminDocument's own schema comment), but per-project documents are
-- genuinely user-uploaded, so they need one. Same split as orders/
-- order_deliveries: a private Storage bucket holds the bytes, a plain table
-- holds the queryable metadata (who uploaded what, when, under what name) --
-- listing storage.objects directly would work too, but every other resource
-- in this app is a Postgres row with RLS, and this keeps that consistent
-- (e.g. lets the Activity feed or a future admin view join against it later).
--
-- Storage path convention: `${project_id}/${uuid}-${original filename}` --
-- the leading path segment is what storage.foldername() below keys off to
-- reach back to the owning project for its RLS check, same "encode the
-- parent in the path" trick Storage policies commonly use since
-- storage.objects has no project_id column of its own.
insert into storage.buckets (id, name, public) values ('project-documents', 'project-documents', false)
  on conflict (id) do nothing;

create table if not exists project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size int not null,
  content_type text,
  created_at timestamptz not null default now()
);

alter table project_documents enable row level security;

create policy "Owners and admins can read project documents" on project_documents
  for select using (
    exists (select 1 from projects where projects.id = project_id and (projects.owner_id = auth.uid() or public.is_admin()))
  );

create policy "Owners and admins can upload project documents" on project_documents
  for insert with check (
    uploaded_by = auth.uid()
    and exists (select 1 from projects where projects.id = project_id and (projects.owner_id = auth.uid() or public.is_admin()))
  );

create policy "Owners and admins can delete project documents" on project_documents
  for delete using (
    exists (select 1 from projects where projects.id = project_id and (projects.owner_id = auth.uid() or public.is_admin()))
  );

-- Mirror the same owner-or-admin check on the actual storage bytes -- without
-- these, the project_documents row could be readable while the file itself
-- is either unfetchable (no select policy) or, worse, editable/removable by
-- anyone (no policy at all defaults to allow nothing, but explicit beats
-- implicit here given this is the app's first bucket).
create policy "Owners and admins can read project document files" on storage.objects
  for select using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects
      where projects.id::text = (storage.foldername(name))[1]
        and (projects.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "Owners and admins can upload project document files" on storage.objects
  for insert with check (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects
      where projects.id::text = (storage.foldername(name))[1]
        and (projects.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "Owners and admins can delete project document files" on storage.objects
  for delete using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects
      where projects.id::text = (storage.foldername(name))[1]
        and (projects.owner_id = auth.uid() or public.is_admin())
    )
  );

-- =============================================================================
-- Foreign key indexes
-- =============================================================================
-- Postgres auto-indexes primary keys but NOT the referencing (foreign key)
-- side of a relationship -- every RLS policy in this schema that gates a
-- child table via "exists (select 1 from parent where parent.id = child.fk
-- and ...)" was, until now, doing a full sequential scan of the parent (or
-- child) table on every single query, on every row check. Harmless at the
-- row counts this app has had so far; not harmless once the customer base
-- (and therefore project/order/document/event counts) grows an order of
-- magnitude or two. Cheap and purely additive to add now while the tables
-- are still small enough that building the index is instant.
create index if not exists idx_projects_owner_id            on projects (owner_id);
create index if not exists idx_project_stage_events_project_id on project_stage_events (project_id);
create index if not exists idx_project_stage_events_actor_id   on project_stage_events (actor_id);
create index if not exists idx_requests_project_id           on requests (project_id);
create index if not exists idx_orders_project_id             on orders (project_id);
create index if not exists idx_orders_owner_id               on orders (owner_id);
create index if not exists idx_order_deliveries_order_id     on order_deliveries (order_id);
create index if not exists idx_order_stage_events_order_id   on order_stage_events (order_id);
create index if not exists idx_order_stage_events_actor_id   on order_stage_events (actor_id);
create index if not exists idx_project_documents_project_id  on project_documents (project_id);
create index if not exists idx_project_documents_uploaded_by on project_documents (uploaded_by);
