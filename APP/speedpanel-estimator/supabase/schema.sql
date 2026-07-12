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

-- display_name/title/phone: nullable, no signup UI sets these -- profiles
-- has no name/contact concept anywhere else in this app (email only, via
-- auth.users). Only meaningful for role='admin' rows, shown as "Your
-- Speedpanel Team" contact details instead of a raw email -- see
-- admin_set_staff_profile() and the "Assigned Speedpanel Team" section
-- below.
alter table profiles add column display_name text;
alter table profiles add column title text;
alter table profiles add column phone text;

-- Internal Speedpanel job function -- distinct from the binary `role`
-- access gate above (which only answers "can this person reach Admin at
-- all") and from staff_assignments.role (which company relationship this
-- person holds, per company). One value per person, reusing the same 5
-- labels as staff_assignments plus 'super_admin' (full access) -- a staff
-- member's job function is also what they're eligible to be assigned as on
-- a company's Speedpanel Team, so this is one role list, not two. null is a
-- deliberate grandfather state (full access, same as super_admin), not "no
-- access" -- see has_staff_role() below.
alter table profiles add column staff_role text
  check (staff_role in ('super_admin', 'project_manager', 'bdm', 'internal_sales', 'dispatch', 'technical_services'));

-- Backfill: every admin account that exists before this migration keeps
-- full access, explicitly, rather than relying only on has_staff_role()'s
-- null-fallback long-term.
update profiles set staff_role = 'super_admin' where role = 'admin' and staff_role is null;

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

-- Finer-grained check layered ON TOP of is_admin(), not a replacement --
-- used only by the specific internal-staff-only RPCs/policies that opted
-- into it (see "Internal staff roles" section below); every other is_admin()
-- call in this file is untouched. staff_role is null OR 'super_admin'
-- always passes, regardless of p_roles -- a defensive default so a not-yet-
-- assigned admin is never silently locked out of everything.
create or replace function public.has_staff_role(p_roles text[]) returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.is_admin() and exists (
    select 1 from profiles where id = auth.uid()
      and (staff_role is null or staff_role = 'super_admin' or staff_role = any(p_roles))
  );
$$;
revoke execute on function public.has_staff_role(text[]) from public, anon;
grant execute on function public.has_staff_role(text[]) to authenticated;

-- Narrowed from a plain role='admin' check to has_staff_role() -- Requests
-- triage is a BDM function, per "Internal staff roles". Redefined here
-- (rather than at the table's original "Admins can update requests" policy
-- further up) since has_staff_role() isn't defined until this point in the
-- file -- same "policy redefined later once its dependency exists" pattern
-- already used throughout this schema (e.g. projects/orders policies
-- redefined after can_edit_project).
drop policy "Admins can update requests" on requests;
create policy "Admins can update requests" on requests
  for update using (public.has_staff_role(array['bdm']))
  with check (public.has_staff_role(array['bdm']));

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
  file_url text,
  -- Full extracted PDF text, written by scripts/add-education-doc.mjs (via
  -- pdf-parse) for real documents; empty for mock entries with no PDF. Not
  -- exposed in the Admin > Documents edit form -- see
  -- src/education/educationCatalogStore.ts for the read side that powers
  -- Education Hub full-text search.
  search_text text not null default ''
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
-- Admin Maths -- durable cross-device copy of SystemTables (per-panel-type
-- corner-post / horizontal-C-track / shaft-track decision tables)
-- =============================================================================
-- Same singleton pattern as math_constants above (see src/systemTables.ts),
-- with a different fixed id. Unlike math_constants, this table IS seeded here
-- with the defaults, so a fresh deploy's first save() succeeds immediately
-- instead of silently no-op'ing against a row that was never created.
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
-- No insert/delete policy -- the single row is seeded once (below) and the
-- fixed default id + check constraint make a second row structurally
-- impossible even if insert were ever granted.

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
-- create or replace can't change an existing function's return columns --
-- drop first (same reasoning as the zero-arg overload drop above) since
-- this is gaining display_name/title/phone/staff_role.
drop function if exists public.admin_list_users(int, int);

-- Staff directory only (role = 'admin') -- external/customer accounts are
-- managed exclusively via each company's own roster on Admin > Companies
-- now, never listed here. has_staff_role(array[]) (super_admin) rather than
-- plain is_admin() -- see "Internal staff roles" section below.
create or replace function public.admin_list_users(p_limit int default 50, p_offset int default 0)
returns table (id uuid, email text, role text, created_at timestamptz, display_name text, title text, phone text, staff_role text)
language sql security definer stable
set search_path = public
as $$
  select p.id, u.email, p.role, p.created_at, p.display_name, p.title, p.phone, p.staff_role
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin' and public.has_staff_role(array[]::text[])
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
  where public.has_staff_role(array[]::text[]);
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
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;
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

-- Sets another admin's (or their own) display_name/title/phone, shown as
-- their "Your Speedpanel Team" contact details once assigned to a company.
-- Users area is super_admin-only from here on (has_staff_role(array[]) --
-- Admin > Users is a staff directory, not a general account list, so only
-- a super_admin manages it, same reasoning as admin_set_role/
-- admin_set_staff_role below).
create or replace function public.admin_set_staff_profile(p_user_id uuid, p_display_name text, p_title text, p_phone text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;
  update profiles set display_name = nullif(trim(p_display_name), ''), title = nullif(trim(p_title), ''),
    phone = nullif(trim(p_phone), ''), updated_at = now()
    where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
end;
$$;
revoke execute on function public.admin_set_staff_profile(uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_staff_profile(uuid, text, text, text) to authenticated;

create or replace function public.admin_set_staff_role(p_user_id uuid, p_staff_role text) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;
  if coalesce(p_staff_role, '') not in ('super_admin', 'project_manager', 'bdm', 'internal_sales', 'dispatch', 'technical_services') then
    raise exception 'Invalid staff role';
  end if;
  update profiles set staff_role = p_staff_role, updated_at = now() where id = p_user_id and role = 'admin';
  if not found then raise exception 'Staff account not found'; end if;
end;
$$;
revoke execute on function public.admin_set_staff_role(uuid, text) from public, anon;
grant execute on function public.admin_set_staff_role(uuid, text) to authenticated;

-- Promotes an EXISTING account (role='user' -- e.g. a former customer
-- signup, or an account created directly in Supabase) to Speedpanel staff
-- in one step, by email. admin_set_staff_role above requires role='admin'
-- already, and admin_list_users()/admin_list_staff_candidates() both filter
-- to role='admin' rows, so a role='user' account is otherwise invisible
-- and unreachable from Admin > Users -- this is the promotion path into
-- that visibility, mirroring admin_add_company_member_by_email's
-- lookup-by-email shape for the company-member case.
create or replace function public.admin_promote_user_to_staff_by_email(p_email text, p_staff_role text) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;
  if coalesce(p_staff_role, '') not in ('super_admin', 'project_manager', 'bdm', 'internal_sales', 'dispatch', 'technical_services') then
    raise exception 'Invalid staff role';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No account exists yet for that email -- ask them to sign up first, or use Invite instead.';
  end if;

  update profiles set role = 'admin', staff_role = p_staff_role, updated_at = now() where id = v_user_id;
  if not found then raise exception 'Profile not found for that account.'; end if;
end;
$$;
revoke execute on function public.admin_promote_user_to_staff_by_email(text, text) from public, anon;
grant execute on function public.admin_promote_user_to_staff_by_email(text, text) to authenticated;

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
  where public.has_staff_role(array[]::text[])
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
  -- Standalone admin-decision RPC, no customer-facing path shares this
  -- check -- narrowed to Internal Sales, who own order approvals.
  if not public.has_staff_role(array['internal_sales']) then raise exception 'Not authorized'; end if;

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

-- Dispatch-only writes (has_staff_role(array['dispatch'])), via dedicated
-- RPCs rather than narrowing the "Owners, company, and admins can update
-- orders"/"...manage deliveries..." RLS policies further down this file:
-- those are shared with customer self-service order edits via
-- can_edit_project, so narrowing their is_admin() clause would break that
-- shared path. These two replace AdminManufacturingPage.tsx's previous
-- direct .update() calls -- see adminManufacturingStore.ts.
create or replace function public.admin_update_manufacturing(
  p_order_id uuid, p_panels_manufactured int, p_manufacturing_est_completion date
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_staff_role(array['dispatch']) then raise exception 'Not authorized'; end if;
  update orders set panels_manufactured = p_panels_manufactured,
    manufacturing_est_completion = p_manufacturing_est_completion, updated_at = now()
    where id = p_order_id and stage = 'proforma_issued';
  if not found then raise exception 'Order not found or not yet confirmed'; end if;
end;
$$;
revoke execute on function public.admin_update_manufacturing(uuid, int, date) from public, anon;
grant execute on function public.admin_update_manufacturing(uuid, int, date) to authenticated;

create or replace function public.admin_update_delivery_status(p_delivery_id uuid, p_status text) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_staff_role(array['dispatch']) then raise exception 'Not authorized'; end if;
  if coalesce(p_status, '') not in ('planned', 'scheduled', 'in_transit', 'delivered') then raise exception 'Invalid status'; end if;
  update order_deliveries set status = p_status where id = p_delivery_id;
  if not found then raise exception 'Delivery not found'; end if;
end;
$$;
revoke execute on function public.admin_update_delivery_status(uuid, text) from public, anon;
grant execute on function public.admin_update_delivery_status(uuid, text) to authenticated;

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

-- =============================================================================
-- Multi-user company workspaces
-- =============================================================================
-- Lets several individual accounts share access to the same company's
-- projects/orders/documents, instead of every resource belonging to exactly
-- one owner_id forever. Deliberately NOT a single profiles.company_id column
-- -- a user can belong to more than one company (consultants, people who
-- change employers, Speedpanel support) so membership is its own table with
-- one row per (company, user) pair, per the multi-company-from-day-one
-- requirement, NOT a shortcut this app explicitly rejected.
--
-- Six fixed roles (role-templates, not a dynamic permissions matrix):
-- owner/admin manage the company itself and see every company project by
-- default; project_manager also sees every company project but can't manage
-- membership; estimator/site_user/viewer only see projects they're
-- explicitly assigned to via project_memberships, and viewer is read-only
-- there (see can_view_project/can_edit_project further below).
--
-- Everything here is additive: owner_id-only projects/orders (company_id
-- null) keep behaving exactly as before this section existed -- see
-- can_view_project/can_edit_project's first clause.
-- =============================================================================

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text,
  abn text,
  customer_account_number text,
  billing_email text,
  phone text,
  address text,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per (company, user) -- a user can hold multiple rows across
-- different companies, so this is never collapsed onto profiles.
create table if not exists company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'project_manager', 'estimator', 'site_user', 'viewer')),
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  invited_by uuid references auth.users (id),
  joined_at timestamptz not null default now(),
  last_active_at timestamptz,
  unique (company_id, user_id)
);

-- Pending/accepted/expired/cancelled invite states. A brand-new email gets a
-- real account immediately via Supabase Auth's own inviteUserByEmail (see
-- the company-invite-member Edge Function) -- there's no "pending account,
-- no login yet" state for that case, acceptance IS setting a password. An
-- email that already has an account instead sits here as 'pending' until
-- that person accepts in-app (see accept_company_invitation below), since
-- this app has no way to send a notification email to an existing user.
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  email text not null,
  invitee_name text,
  role text not null check (role in ('owner', 'admin', 'project_manager', 'estimator', 'site_user', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by uuid not null references auth.users (id),
  message text,
  -- Which specific projects to grant access to on acceptance (via
  -- project_memberships) -- null/empty means "whatever the role's default
  -- company-wide reach already covers, nothing project-specific to add".
  project_ids uuid[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz
);

-- Grants access to one SPECIFIC project regardless of company-wide role --
-- how estimator/site_user/viewer (who don't see the whole company by
-- default) get scoped in. project_role is what actually makes 'viewer'
-- read-only rather than just narrower-scoped -- see can_view_project vs
-- can_edit_project below, which is what this column's value actually gates.
create table if not exists project_memberships (
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_role text not null default 'editor' check (project_role in ('editor', 'viewer')),
  added_by uuid references auth.users (id),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Company-workspace event log -- membership changes plus the
-- project/order/delivery lifecycle events that matter when several people
-- can modify the same data. NOT a full field-level audit of every edit (see
-- log_audit() below) -- only fires when company_id is not null, since a
-- solo/personal project has no company to attribute an entry to.
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies (id) on delete cascade,
  actor_id uuid references auth.users (id),
  event_type text not null,
  target_user_id uuid references auth.users (id),
  project_id uuid references projects (id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table companies            enable row level security;
alter table company_memberships  enable row level security;
alter table invitations          enable row level security;
alter table project_memberships  enable row level security;
alter table audit_logs           enable row level security;

-- =============================================================================
-- Company-aware columns on projects/orders
-- =============================================================================
alter table projects add column company_id uuid references companies (id) on delete set null;
alter table projects add column project_manager_user_id uuid references auth.users (id);
alter table orders   add column company_id uuid references companies (id) on delete set null;

-- =============================================================================
-- Company-workspace helper functions
-- =============================================================================
-- Same security-definer, revoke-then-grant-to-authenticated convention as
-- is_admin() above throughout.

-- owner OR admin -- the general "can manage this company" gate (invite,
-- remove/role-change anyone below Owner, edit company details, view all).
-- has_staff_role(array[]) (super_admin) rather than plain is_admin():
-- Speedpanel staff manage every company via this bypass, not by joining it
-- as a member (see "Company-creation cutover" -- admin_create_company never
-- adds the calling admin to company_memberships), and per "Internal staff
-- roles" below, company management is super_admin-only, not every internal
-- role. Without this bypass at all, an admin who created a company
-- couldn't call company_set_member_role/company_remove_member/
-- resend_company_invitation/etc. for it, or pass company-invite-member's
-- is_company_admin check.
create or replace function public.is_company_admin(p_company_id uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.has_staff_role(array[]::text[]) or exists (
    select 1 from company_memberships
    where company_id = p_company_id and user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  );
$$;
revoke execute on function public.is_company_admin(uuid) from public, anon;
grant execute on function public.is_company_admin(uuid) to authenticated;

-- owner ONLY (plus the same super_admin bypass as is_company_admin above) --
-- gates the actions an Admin must not have: touching another Owner's
-- role/status, or promoting someone else to Owner.
create or replace function public.is_company_owner(p_company_id uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.has_staff_role(array[]::text[]) or exists (
    select 1 from company_memberships
    where company_id = p_company_id and user_id = auth.uid() and status = 'active' and role = 'owner'
  );
$$;
revoke execute on function public.is_company_owner(uuid) from public, anon;
grant execute on function public.is_company_owner(uuid) to authenticated;

-- Read access to a project: its own owner_id, Speedpanel admin, any active
-- owner/admin/project_manager of the project's company (company-wide reach),
-- or an explicit project_memberships row (either 'editor' or 'viewer').
create or replace function public.can_view_project(p_owner_id uuid, p_company_id uuid, p_project_id uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select
    auth.uid() = p_owner_id
    or public.is_admin()
    or (p_company_id is not null and exists (
      select 1 from company_memberships cm
      where cm.company_id = p_company_id and cm.user_id = auth.uid() and cm.status = 'active'
        and cm.role in ('owner', 'admin', 'project_manager')
    ))
    or exists (select 1 from project_memberships pm where pm.project_id = p_project_id and pm.user_id = auth.uid());
$$;
revoke execute on function public.can_view_project(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_view_project(uuid, uuid, uuid) to authenticated;

-- Write access to a project: same as can_view_project, except an explicit
-- project_memberships row only counts when project_role = 'editor' -- this
-- is what actually makes a 'viewer' assignment read-only rather than just
-- narrower-scoped than a company-wide role.
create or replace function public.can_edit_project(p_owner_id uuid, p_company_id uuid, p_project_id uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select
    auth.uid() = p_owner_id
    or public.is_admin()
    or (p_company_id is not null and exists (
      select 1 from company_memberships cm
      where cm.company_id = p_company_id and cm.user_id = auth.uid() and cm.status = 'active'
        and cm.role in ('owner', 'admin', 'project_manager')
    ))
    or exists (
      select 1 from project_memberships pm
      where pm.project_id = p_project_id and pm.user_id = auth.uid() and pm.project_role = 'editor'
    );
$$;
revoke execute on function public.can_edit_project(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_edit_project(uuid, uuid, uuid) to authenticated;

-- Stricter than can_edit_project -- deliberately has NO project_memberships
-- path at all, so estimator/site_user/viewer can never submit an order
-- regardless of project assignment (only company-wide owner/admin/
-- project_manager, the project's own owner, or Speedpanel admin can).
create or replace function public.can_submit_orders(p_owner_id uuid, p_company_id uuid, p_project_id uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select
    auth.uid() = p_owner_id
    or public.is_admin()
    or (p_company_id is not null and exists (
      select 1 from company_memberships cm
      where cm.company_id = p_company_id and cm.user_id = auth.uid() and cm.status = 'active'
        and cm.role in ('owner', 'admin', 'project_manager')
    ));
$$;
revoke execute on function public.can_submit_orders(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_submit_orders(uuid, uuid, uuid) to authenticated;

-- Shared audit-log writer -- silently a no-op when p_company_id is null
-- (solo/personal projects have nothing to attribute a company-audit entry
-- to), so every call site can call this unconditionally without its own
-- null-check.
create or replace function public.log_audit(
  p_company_id uuid, p_actor_id uuid, p_event_type text,
  p_target_user_id uuid default null, p_project_id uuid default null, p_detail jsonb default null
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_company_id is null then return; end if;
  insert into audit_logs (company_id, actor_id, event_type, target_user_id, project_id, detail)
    values (p_company_id, p_actor_id, p_event_type, p_target_user_id, p_project_id, p_detail);
end;
$$;
revoke execute on function public.log_audit(uuid, uuid, text, uuid, uuid, jsonb) from public, anon;
grant execute on function public.log_audit(uuid, uuid, text, uuid, uuid, jsonb) to authenticated;

-- =============================================================================
-- RLS: companies, company_memberships, invitations, project_memberships, audit_logs
-- =============================================================================

create policy "Company members can read their own company" on companies
  for select using (
    exists (select 1 from company_memberships cm where cm.company_id = companies.id and cm.user_id = auth.uid() and cm.status = 'active')
    or public.is_admin()
  );

create policy "Owner or admin can update their own company" on companies
  for update using (public.is_company_admin(id)) with check (public.is_company_admin(id));

-- No delete policy in v1 -- no self-service or admin company-closure flow yet.

create policy "Members can read their own membership rows" on company_memberships
  for select using (user_id = auth.uid() or public.is_company_admin(company_id) or public.is_admin());

-- No direct insert/update/delete policy -- every membership change goes
-- through the security definer RPCs below (company_set_member_role,
-- company_remove_member, company_set_member_status, the
-- invitation-acceptance path, admin_set_user_company), each of which does
-- its own privilege check before writing.

-- email = auth.email() (JWT claim, not a table read) -- authenticated has no
-- direct SELECT grant on auth.users, so a subquery against it here would
-- fail with "permission denied for table users" for any caller who isn't
-- already a company_admin/is_admin() (i.e. every plain user checking their
-- own pending invitations, exactly the useMyPendingInvitations/
-- PendingInvitationsBanner.tsx path -- see the original bug this replaced).
create policy "Company admins can read their own invitations" on invitations
  for select using (
    public.is_company_admin(company_id)
    or email = auth.email()
    or public.is_admin()
  );

-- No direct insert/update/delete -- see company-invite-member Edge Function
-- and the resend/cancel/accept/decline RPCs below.

create policy "Project access implies project_memberships visibility" on project_memberships
  for select using (
    exists (
      select 1 from projects p
      where p.id = project_id and public.can_view_project(p.owner_id, p.company_id, p.id)
    )
  );

-- No direct insert/update/delete -- see add_project_member/
-- remove_project_member/set_project_member_role below.

create policy "Company admins can read their own audit log" on audit_logs
  for select using (public.is_company_admin(company_id) or public.is_admin());

-- No insert/update/delete policy -- rows are only ever written by
-- log_audit(), which is security definer and bypasses RLS.

-- =============================================================================
-- Extend existing RLS to company/project-membership access
-- =============================================================================
-- Every policy below is a straight rewrite (drop + recreate under the same
-- name) of an existing "owner_id = auth.uid() or is_admin()"-shaped policy,
-- swapping in can_view_project()/can_edit_project() -- read policies get the
-- view function, write policies (insert/update/delete/"manage") get the edit
-- function, so a project_memberships 'viewer' assignment is genuinely
-- read-only rather than sharing one boolean with every write check too.
-- can_view_project/can_edit_project's first clause is still
-- "auth.uid() = owner_id", so solo projects (company_id null) behave
-- identically to before this section existed.

drop policy "Owners and admins can read projects" on projects;
create policy "Owners, company, and admins can read projects" on projects
  for select using (public.can_view_project(owner_id, company_id, id));

drop policy "Owners and admins can update projects" on projects;
create policy "Owners, company, and admins can update projects" on projects
  for update using (public.can_edit_project(owner_id, company_id, id))
  with check (public.can_edit_project(owner_id, company_id, id));

-- "Owners can create their own projects" (insert) is untouched -- a member
-- always creates a project as themselves; company-wide sharing takes effect
-- via the read/update policies above the moment company_id is set.

drop policy "Owners and admins can read project stage events" on project_stage_events;
create policy "Owners, company, and admins can read project stage events" on project_stage_events
  for select using (
    exists (select 1 from projects p where p.id = project_id and public.can_view_project(p.owner_id, p.company_id, p.id))
  );

drop policy "Owners and admins can read orders" on orders;
create policy "Owners, company, and admins can read orders" on orders
  for select using (public.can_view_project(owner_id, company_id, project_id));

drop policy "Owners can create their own orders" on orders;
create policy "Project access can create orders" on orders
  for insert with check (
    auth.uid() = owner_id
    and exists (
      select 1 from projects p where p.id = project_id and public.can_edit_project(p.owner_id, p.company_id, p.id)
    )
  );

drop policy "Owners and admins can update orders" on orders;
create policy "Owners, company, and admins can update orders" on orders
  for update using (public.can_edit_project(owner_id, company_id, project_id))
  with check (public.can_edit_project(owner_id, company_id, project_id));

drop policy "Owners and admins can read order deliveries" on order_deliveries;
create policy "Owners, company, and admins can read order deliveries" on order_deliveries
  for select using (
    exists (select 1 from orders o where o.id = order_id and public.can_view_project(o.owner_id, o.company_id, o.project_id))
  );

drop policy "Owners can manage deliveries while draft, admins anytime" on order_deliveries;
create policy "Editors can manage deliveries while draft, admins anytime" on order_deliveries
  for all using (
    (exists (
      select 1 from orders o where o.id = order_id and o.stage = 'draft'
        and public.can_edit_project(o.owner_id, o.company_id, o.project_id)
    ))
    or public.is_admin()
  )
  with check (
    (exists (
      select 1 from orders o where o.id = order_id and o.stage = 'draft'
        and public.can_edit_project(o.owner_id, o.company_id, o.project_id)
    ))
    or public.is_admin()
  );

drop policy "Owners and admins can read order stage events" on order_stage_events;
create policy "Owners, company, and admins can read order stage events" on order_stage_events
  for select using (
    exists (select 1 from orders o where o.id = order_id and public.can_view_project(o.owner_id, o.company_id, o.project_id))
  );

drop policy "Owners and admins can read project documents" on project_documents;
create policy "Owners, company, and admins can read project documents" on project_documents
  for select using (
    exists (select 1 from projects p where p.id = project_id and public.can_view_project(p.owner_id, p.company_id, p.id))
  );

drop policy "Owners and admins can upload project documents" on project_documents;
create policy "Editors can upload project documents" on project_documents
  for insert with check (
    uploaded_by = auth.uid()
    and exists (select 1 from projects p where p.id = project_id and public.can_edit_project(p.owner_id, p.company_id, p.id))
  );

drop policy "Owners and admins can delete project documents" on project_documents;
create policy "Editors can delete project documents" on project_documents
  for delete using (
    exists (select 1 from projects p where p.id = project_id and public.can_edit_project(p.owner_id, p.company_id, p.id))
  );

drop policy "Owners and admins can read project document files" on storage.objects;
create policy "Owners, company, and admins can read project document files" on storage.objects
  for select using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects p
      where p.id::text = (storage.foldername(name))[1] and public.can_view_project(p.owner_id, p.company_id, p.id)
    )
  );

drop policy "Owners and admins can upload project document files" on storage.objects;
create policy "Editors can upload project document files" on storage.objects
  for insert with check (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects p
      where p.id::text = (storage.foldername(name))[1] and public.can_edit_project(p.owner_id, p.company_id, p.id)
    )
  );

drop policy "Owners and admins can delete project document files" on storage.objects;
create policy "Editors can delete project document files" on storage.objects
  for delete using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects p
      where p.id::text = (storage.foldername(name))[1] and public.can_edit_project(p.owner_id, p.company_id, p.id)
    )
  );

-- =============================================================================
-- Denormalization + auto-membership triggers
-- =============================================================================

-- orders.company_id always mirrors the PARENT PROJECT's company_id -- never
-- set by the client (see ordersStore.ts, which needs zero changes because of
-- this). Never itself the security boundary either: every RLS/RPC check
-- above always does a live company_memberships lookup, so even a
-- momentarily-stale value here couldn't leak or restrict access -- it exists
-- purely so orders can be queried/filtered by company without a join.
create or replace function public.sync_order_company_id() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.company_id := (select company_id from public.projects where id = new.project_id);
  return new;
end;
$$;

drop trigger if exists sync_orders_company_id on orders;
create trigger sync_orders_company_id
  before insert or update on orders
  for each row execute function public.sync_order_company_id();

-- Trigger-only function -- no legitimate direct-RPC caller, same as
-- handle_new_user() above.
revoke execute on function public.sync_order_company_id() from public;
revoke execute on function public.sync_order_company_id() from anon;
revoke execute on function public.sync_order_company_id() from authenticated;

-- Auto-adds a project's creator to project_memberships as 'editor', and logs
-- a 'project_created' audit event. Not load-bearing for access itself
-- (owner_id = auth.uid() already grants access unconditionally), but keeps
-- the project's member roster accurate from the moment it exists, which the
-- Project Access UI depends on.
create or replace function public.on_project_created() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.project_memberships (project_id, user_id, project_role, added_by)
    values (new.id, new.owner_id, 'editor', new.owner_id)
    on conflict (project_id, user_id) do nothing;
  perform public.log_audit(new.company_id, new.owner_id, 'project_created', null, new.id);
  return new;
end;
$$;

drop trigger if exists on_project_created on projects;
create trigger on_project_created
  after insert on projects
  for each row execute function public.on_project_created();

revoke execute on function public.on_project_created() from public;
revoke execute on function public.on_project_created() from anon;
revoke execute on function public.on_project_created() from authenticated;

-- Logs a 'delivery_requested' audit event whenever a delivery batch is added
-- to a company order -- log_audit() itself no-ops when company_id is null.
create or replace function public.on_order_delivery_created() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_project uuid;
begin
  select company_id, project_id into v_company, v_project from public.orders where id = new.order_id;
  perform public.log_audit(v_company, auth.uid(), 'delivery_requested', null, v_project, jsonb_build_object('delivery_id', new.id));
  return new;
end;
$$;

drop trigger if exists on_order_delivery_created on order_deliveries;
create trigger on_order_delivery_created
  after insert on order_deliveries
  for each row execute function public.on_order_delivery_created();

revoke execute on function public.on_order_delivery_created() from public;
revoke execute on function public.on_order_delivery_created() from anon;
revoke execute on function public.on_order_delivery_created() from authenticated;

-- =============================================================================
-- Extend existing stage-transition RPCs for company access + audit logging
-- =============================================================================
-- Each of these does its own ownership check in PL/pgSQL (security definer,
-- so it bypasses RLS entirely) -- the RLS rewrite above doesn't touch these
-- at all, they need their own edits. Same signatures as before (create or
-- replace, not a new overload), so every existing caller keeps working
-- unchanged.

create or replace function public.request_install_review(p_project_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_stage text;
begin
  select owner_id, company_id, stage into v_owner, v_company, v_stage from projects where id = p_project_id for update;
  if v_owner is null then raise exception 'Project not found'; end if;
  -- can_edit_project's first clause is auth.uid() = p_owner_id, so this
  -- subsumes the original "is distinct from" owner-only check while adding
  -- company-wide/project_memberships-editor access.
  if not public.can_edit_project(v_owner, v_company, p_project_id) then raise exception 'Not authorized'; end if;
  if v_stage <> 'draft' then raise exception 'Install review can only be requested from Draft'; end if;

  update projects set stage = 'install_review', install_review_status = 'pending', updated_at = now()
    where id = p_project_id;
  insert into project_stage_events (project_id, actor_id, event_type)
    values (p_project_id, auth.uid(), 'install_review_requested');
  perform public.log_audit(v_company, auth.uid(), 'install_review_requested', null, p_project_id);
end;
$$;

create or replace function public.review_install(p_project_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_stage text;
  v_company uuid;
begin
  -- Standalone admin-decision RPC, no customer-facing path shares this
  -- check -- narrowed to the two internal roles who actually do reviews.
  if not public.has_staff_role(array['project_manager', 'technical_services']) then raise exception 'Not authorized'; end if;
  if coalesce(p_decision, '') not in ('approved', 'changes_requested') then raise exception 'Invalid decision'; end if;

  select stage, company_id into v_stage, v_company from projects where id = p_project_id for update;
  if v_stage is null then raise exception 'Project not found'; end if;
  if v_stage <> 'install_review' then raise exception 'Project is not awaiting install review'; end if;

  if p_decision = 'approved' then
    update projects set stage = 'draft', install_review_status = 'approved', updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, auth.uid(), 'install_review_approved', p_note);
    perform public.log_audit(v_company, auth.uid(), 'install_review_approved', null, p_project_id, jsonb_build_object('note', p_note));
  else
    update projects set stage = 'draft', install_review_status = 'changes_requested', install_review_note = p_note, updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, auth.uid(), 'install_review_changes_requested', p_note);
    perform public.log_audit(v_company, auth.uid(), 'install_review_changes_requested', null, p_project_id, jsonb_build_object('note', p_note));
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
  v_company uuid;
  v_stage text;
  v_install_status text;
begin
  select owner_id, company_id, stage, install_review_status into v_owner, v_company, v_stage, v_install_status
    from projects where id = p_project_id for update;
  if v_owner is null then raise exception 'Project not found'; end if;
  if not public.can_edit_project(v_owner, v_company, p_project_id) then raise exception 'Not authorized'; end if;
  if v_stage <> 'draft' then raise exception 'Technical review can only be requested from Draft'; end if;
  if v_install_status is distinct from 'approved' then raise exception 'Install review must be approved first'; end if;

  update projects set stage = 'technical_review', technical_review_status = 'pending', updated_at = now()
    where id = p_project_id;
  insert into project_stage_events (project_id, actor_id, event_type)
    values (p_project_id, auth.uid(), 'technical_review_requested');
  perform public.log_audit(v_company, auth.uid(), 'technical_review_requested', null, p_project_id);
end;
$$;

create or replace function public.review_technical(p_project_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_stage text;
  v_company uuid;
begin
  if not public.has_staff_role(array['project_manager', 'technical_services']) then raise exception 'Not authorized'; end if;
  if coalesce(p_decision, '') not in ('approved', 'changes_requested') then raise exception 'Invalid decision'; end if;

  select stage, company_id into v_stage, v_company from projects where id = p_project_id for update;
  if v_stage is null then raise exception 'Project not found'; end if;
  if v_stage <> 'technical_review' then raise exception 'Project is not awaiting technical review'; end if;

  if p_decision = 'approved' then
    update projects set stage = 'approved', technical_review_status = 'approved', updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, auth.uid(), 'technical_review_approved', p_note);
    perform public.log_audit(v_company, auth.uid(), 'technical_review_approved', null, p_project_id, jsonb_build_object('note', p_note));
  else
    update projects set stage = 'draft', technical_review_status = 'changes_requested', technical_review_note = p_note, updated_at = now()
      where id = p_project_id;
    insert into project_stage_events (project_id, actor_id, event_type, note)
      values (p_project_id, auth.uid(), 'technical_review_changes_requested', p_note);
    perform public.log_audit(v_company, auth.uid(), 'technical_review_changes_requested', null, p_project_id, jsonb_build_object('note', p_note));
  end if;
end;
$$;

create or replace function public.submit_order(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_project uuid;
  v_stage text;
begin
  select owner_id, company_id, project_id, stage into v_owner, v_company, v_project, v_stage
    from orders where id = p_order_id for update;
  if v_owner is null then raise exception 'Order not found'; end if;
  -- Stricter than install/technical review requests: can_submit_orders has
  -- no project_memberships path, so estimator/site_user/viewer can never
  -- submit regardless of project assignment.
  if not public.can_submit_orders(v_owner, v_company, v_project) then raise exception 'Not authorized'; end if;
  if v_stage <> 'draft' then raise exception 'Order can only be submitted from Draft'; end if;
  if not exists (select 1 from order_deliveries where order_id = p_order_id) then
    raise exception 'Add at least one delivery before submitting';
  end if;

  update orders set stage = 'submitted', submitted_at = now(), updated_at = now() where id = p_order_id;
  insert into order_stage_events (order_id, actor_id, event_type) values (p_order_id, auth.uid(), 'submitted');
  perform public.log_audit(v_company, auth.uid(), 'order_submitted', null, v_project, jsonb_build_object('order_id', p_order_id));
end;
$$;

create or replace function public.request_proforma_invoice(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_project uuid;
  v_stage text;
begin
  select owner_id, company_id, project_id, stage into v_owner, v_company, v_project, v_stage
    from orders where id = p_order_id for update;
  if v_owner is null then raise exception 'Order not found'; end if;
  if not public.can_submit_orders(v_owner, v_company, v_project) then raise exception 'Not authorized'; end if;
  if v_stage <> 'submitted' then raise exception 'A pro forma invoice can only be requested once the order is submitted'; end if;

  update orders set stage = 'proforma_requested', proforma_requested_at = now(), updated_at = now() where id = p_order_id;
  insert into order_stage_events (order_id, actor_id, event_type) values (p_order_id, auth.uid(), 'proforma_requested');
  perform public.log_audit(v_company, auth.uid(), 'proforma_requested', null, v_project, jsonb_build_object('order_id', p_order_id));
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_project uuid;
  v_stage text;
begin
  select owner_id, company_id, project_id, stage into v_owner, v_company, v_project, v_stage
    from orders where id = p_order_id for update;
  if v_owner is null then raise exception 'Order not found'; end if;
  -- can_edit_project already includes is_admin() in its OR chain, so this
  -- subsumes the original "owner or admin" check while adding company-wide/
  -- project_memberships-editor access.
  if not public.can_edit_project(v_owner, v_company, v_project) then raise exception 'Not authorized'; end if;
  if v_stage not in ('draft', 'submitted', 'proforma_requested') then raise exception 'Order can no longer be cancelled'; end if;

  update orders set stage = 'cancelled', cancelled_at = now(), updated_at = now() where id = p_order_id;
  insert into order_stage_events (order_id, actor_id, event_type) values (p_order_id, auth.uid(), 'cancelled');
end;
$$;

-- =============================================================================
-- Self-service company creation, membership, and invitations
-- =============================================================================

-- Self-service company creation has been removed -- Speedpanel now creates
-- every company via the Admin > Companies wizard (admin_create_company
-- below), never the customer. No production rows ever existed under the
-- old self-service create_company() (confirmed empty before this cutover),
-- so this is a clean drop, not a migration.
drop function if exists public.create_company(text, text, text, text, text, text);

-- is_admin()-gated. Deliberately does NOT add the calling admin to
-- company_memberships -- Speedpanel staff manage every company via the
-- is_admin() bypass added to is_company_admin/is_company_owner above, not by
-- being a member. The company's actual first Owner is added afterward via
-- the normal invite path (company-invite-member / admin-invite-user with
-- companyId+companyRole), same as any other member.
create or replace function public.admin_create_company(
  p_legal_name text, p_trading_name text default null, p_abn text default null,
  p_customer_account_number text default null, p_billing_email text default null,
  p_phone text default null, p_address text default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;
  if coalesce(trim(p_legal_name), '') = '' then raise exception 'Company name is required'; end if;

  insert into companies (legal_name, trading_name, abn, customer_account_number, billing_email, phone, address, created_by)
    values (p_legal_name, p_trading_name, p_abn, p_customer_account_number, p_billing_email, p_phone, p_address, auth.uid())
    returning id into v_company_id;
  perform public.log_audit(v_company_id, auth.uid(), 'company_created');
  return v_company_id;
end;
$$;
revoke execute on function public.admin_create_company(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_company(text, text, text, text, text, text, text) to authenticated;

-- handle_new_user() extended (redefined here, after invitations/
-- company_memberships/project_memberships/log_audit all exist) to
-- auto-accept any pending invitation(s) addressed to the new email --
-- clicking the invite link and setting a password IS accepting, for the
-- brand-new-person path (see company-invite-member Edge Function). The
-- existing on_auth_user_created trigger already points at this function by
-- name, so redefining it here is sufficient -- no need to redrop/recreate
-- the trigger itself.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_project_id uuid;
begin
  insert into public.profiles (id) values (new.id);

  for v_invite in
    select * from public.invitations where email = new.email and status = 'pending'
  loop
    insert into public.company_memberships (company_id, user_id, role, status, invited_by, joined_at)
      values (v_invite.company_id, new.id, v_invite.role, 'active', v_invite.invited_by, now())
      on conflict (company_id, user_id) do nothing;

    if v_invite.project_ids is not null then
      foreach v_project_id in array v_invite.project_ids loop
        insert into public.project_memberships (project_id, user_id, added_by)
          values (v_project_id, new.id, v_invite.invited_by)
          on conflict (project_id, user_id) do nothing;
      end loop;
    end if;

    update public.invitations set status = 'accepted', accepted_at = now() where id = v_invite.id;
    perform public.log_audit(v_invite.company_id, new.id, 'invitation_accepted', new.id);
  end loop;

  return new;
end;
$$;

create or replace function public.resend_company_invitation(p_invitation_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_status text;
begin
  select company_id, status into v_company, v_status from invitations where id = p_invitation_id;
  if v_company is null then raise exception 'Invitation not found'; end if;
  if not public.is_company_admin(v_company) then raise exception 'Not authorized'; end if;
  if v_status <> 'pending' then raise exception 'Only a pending invitation can be resent'; end if;

  -- Metadata-only: extends the expiry window. Actually re-sending Supabase's
  -- own invite email (for the still-no-account case) needs the service-role
  -- key, so that half happens in company-invite-member's "resend" mode,
  -- which calls this RPC for the validation + expiry reset.
  update invitations set expires_at = now() + interval '14 days' where id = p_invitation_id;
end;
$$;
revoke execute on function public.resend_company_invitation(uuid) from public, anon;
grant execute on function public.resend_company_invitation(uuid) to authenticated;

create or replace function public.cancel_company_invitation(p_invitation_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from invitations where id = p_invitation_id;
  if v_company is null then raise exception 'Invitation not found'; end if;
  if not public.is_company_admin(v_company) then raise exception 'Not authorized'; end if;

  update invitations set status = 'cancelled' where id = p_invitation_id;
end;
$$;
revoke execute on function public.cancel_company_invitation(uuid) from public, anon;
grant execute on function public.cancel_company_invitation(uuid) to authenticated;

-- Accept/decline path for an EXISTING user invited into a second company
-- (no email capability to notify them, so this is an in-app banner + these
-- two RPCs instead -- see PendingInvitationsBanner.tsx).
create or replace function public.accept_company_invitation(p_invitation_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_invite record;
  v_caller_email text;
  v_project_id uuid;
begin
  select * into v_invite from invitations where id = p_invitation_id for update;
  if v_invite.id is null then raise exception 'Invitation not found'; end if;
  if v_invite.status <> 'pending' then raise exception 'This invitation is no longer pending'; end if;

  select email into v_caller_email from auth.users where id = auth.uid();
  if v_invite.email is distinct from v_caller_email then raise exception 'Not authorized'; end if;

  insert into company_memberships (company_id, user_id, role, status, invited_by, joined_at)
    values (v_invite.company_id, auth.uid(), v_invite.role, 'active', v_invite.invited_by, now())
    on conflict (company_id, user_id) do nothing;

  if v_invite.project_ids is not null then
    foreach v_project_id in array v_invite.project_ids loop
      insert into project_memberships (project_id, user_id, added_by)
        values (v_project_id, auth.uid(), v_invite.invited_by)
        on conflict (project_id, user_id) do nothing;
    end loop;
  end if;

  update invitations set status = 'accepted', accepted_at = now() where id = p_invitation_id;
  perform public.log_audit(v_invite.company_id, auth.uid(), 'invitation_accepted', auth.uid());
end;
$$;
revoke execute on function public.accept_company_invitation(uuid) from public, anon;
grant execute on function public.accept_company_invitation(uuid) to authenticated;

create or replace function public.decline_company_invitation(p_invitation_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text;
  v_caller_email text;
begin
  select email into v_email from invitations where id = p_invitation_id;
  if v_email is null then raise exception 'Invitation not found'; end if;
  select email into v_caller_email from auth.users where id = auth.uid();
  if v_email is distinct from v_caller_email then raise exception 'Not authorized'; end if;

  update invitations set status = 'cancelled' where id = p_invitation_id;
end;
$$;
revoke execute on function public.decline_company_invitation(uuid) from public, anon;
grant execute on function public.decline_company_invitation(uuid) to authenticated;

-- =============================================================================
-- Self-service member management
-- =============================================================================

create or replace function public.company_set_member_role(p_company_id uuid, p_user_id uuid, p_role text) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_owner_count int;
begin
  if not public.is_company_admin(p_company_id) then raise exception 'Not authorized'; end if;
  if coalesce(p_role, '') not in ('owner', 'admin', 'project_manager', 'estimator', 'site_user', 'viewer') then
    raise exception 'Invalid role';
  end if;

  select role into v_target_role from company_memberships where company_id = p_company_id and user_id = p_user_id;
  if v_target_role is null then raise exception 'User not found in this company'; end if;

  -- Owner/Admin asymmetry: an Admin can freely manage project_manager/
  -- estimator/site_user/viewer rows, but touching an existing Owner's role,
  -- or promoting someone else TO Owner, requires the caller to be an Owner.
  if (v_target_role = 'owner' or p_role = 'owner') and not public.is_company_owner(p_company_id) then
    raise exception 'Only an owner can change another owner''s role or promote someone to owner';
  end if;

  if v_target_role = 'owner' and p_role <> 'owner' then
    select count(*) into v_owner_count from company_memberships
      where company_id = p_company_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then raise exception 'Cannot demote the only remaining owner'; end if;
  end if;

  update company_memberships set role = p_role where company_id = p_company_id and user_id = p_user_id;
  perform public.log_audit(p_company_id, auth.uid(), 'role_changed', p_user_id, null,
    jsonb_build_object('from', v_target_role, 'to', p_role));
end;
$$;
revoke execute on function public.company_set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.company_set_member_role(uuid, uuid, text) to authenticated;

create or replace function public.company_set_member_status(p_company_id uuid, p_user_id uuid, p_status text) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_owner_count int;
begin
  if not public.is_company_admin(p_company_id) then raise exception 'Not authorized'; end if;
  if coalesce(p_status, '') not in ('active', 'suspended') then raise exception 'Invalid status'; end if;
  if p_user_id = auth.uid() and p_status = 'suspended' then raise exception 'Cannot suspend yourself.'; end if;

  select role into v_target_role from company_memberships where company_id = p_company_id and user_id = p_user_id;
  if v_target_role is null then raise exception 'User not found in this company'; end if;

  if v_target_role = 'owner' and not public.is_company_owner(p_company_id) then
    raise exception 'Only an owner can suspend another owner';
  end if;

  if v_target_role = 'owner' and p_status = 'suspended' then
    select count(*) into v_owner_count from company_memberships
      where company_id = p_company_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then raise exception 'Cannot suspend the only remaining owner'; end if;
  end if;

  update company_memberships set status = p_status where company_id = p_company_id and user_id = p_user_id;
  perform public.log_audit(p_company_id, auth.uid(), 'member_status_changed', p_user_id, null, jsonb_build_object('status', p_status));
end;
$$;
revoke execute on function public.company_set_member_status(uuid, uuid, text) from public, anon;
grant execute on function public.company_set_member_status(uuid, uuid, text) to authenticated;

create or replace function public.company_remove_member(p_company_id uuid, p_user_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_owner_count int;
begin
  if not public.is_company_admin(p_company_id) then raise exception 'Not authorized'; end if;
  if p_user_id = auth.uid() then raise exception 'Cannot remove yourself -- ask another admin, or contact Speedpanel.'; end if;

  select role into v_target_role from company_memberships where company_id = p_company_id and user_id = p_user_id;
  if v_target_role is null then raise exception 'User not found in this company'; end if;

  if v_target_role = 'owner' and not public.is_company_owner(p_company_id) then
    raise exception 'Only an owner can remove another owner';
  end if;

  if v_target_role = 'owner' then
    select count(*) into v_owner_count from company_memberships
      where company_id = p_company_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then raise exception 'Cannot remove the only remaining owner'; end if;
  end if;

  -- Soft removal (preserves history, doesn't delete the login), plus clean
  -- up any lingering project-level access within this company so a removed
  -- member doesn't retain narrow access via project_memberships.
  update company_memberships set status = 'removed' where company_id = p_company_id and user_id = p_user_id;
  delete from project_memberships
    where user_id = p_user_id and project_id in (select id from projects where company_id = p_company_id);
  perform public.log_audit(p_company_id, auth.uid(), 'member_removed', p_user_id);
end;
$$;
revoke execute on function public.company_remove_member(uuid, uuid) from public, anon;
grant execute on function public.company_remove_member(uuid, uuid) to authenticated;

-- Read-only advisory counts shown before the removal confirm dialog --
-- doesn't block removal, matches this app's existing window.confirm()-style
-- destructive-action pattern. Empty result set (not an error) for a
-- non-admin caller, same "where public.is_company_admin(...)" idiom as
-- admin_list_users.
create or replace function public.company_member_removal_warnings(p_company_id uuid, p_user_id uuid)
returns table (active_projects_as_pm bigint, draft_orders bigint, open_reviews_as_pm bigint)
language sql security definer stable
set search_path = public
as $$
  select
    (select count(*) from projects where project_manager_user_id = p_user_id and company_id = p_company_id and stage <> 'approved' and deleted_at is null),
    (select count(*) from orders where owner_id = p_user_id and company_id = p_company_id and stage = 'draft'),
    (select count(*) from projects where project_manager_user_id = p_user_id and company_id = p_company_id
       and (install_review_status = 'pending' or technical_review_status = 'pending'))
  where public.is_company_admin(p_company_id);
$$;
revoke execute on function public.company_member_removal_warnings(uuid, uuid) from public, anon;
grant execute on function public.company_member_removal_warnings(uuid, uuid) to authenticated;

-- Readable by any active member of the company (not just admins) -- backs
-- the Members screen's roster, including the "Project access" column
-- (assigned_project_count).
create or replace function public.company_list_members(p_company_id uuid)
returns table (user_id uuid, email text, role text, status text, joined_at timestamptz, last_active_at timestamptz, assigned_project_count bigint)
language sql security definer stable
set search_path = public
as $$
  select cm.user_id, u.email, cm.role, cm.status, cm.joined_at, cm.last_active_at,
    (select count(*) from project_memberships pm where pm.user_id = cm.user_id
       and pm.project_id in (select id from projects where company_id = p_company_id)) as assigned_project_count
  from company_memberships cm
  join auth.users u on u.id = cm.user_id
  where cm.company_id = p_company_id
    and (exists (select 1 from company_memberships me where me.company_id = p_company_id and me.user_id = auth.uid() and me.status = 'active') or public.is_admin())
  order by cm.joined_at asc;
$$;
revoke execute on function public.company_list_members(uuid) from public, anon;
grant execute on function public.company_list_members(uuid) to authenticated;

-- Called once per sign-in from the frontend -- the only writer of
-- last_active_at, which otherwise would just be a dead column.
create or replace function public.touch_last_active() returns void
language sql security definer
set search_path = public
as $$
  update company_memberships set last_active_at = now() where user_id = auth.uid() and status = 'active';
$$;
revoke execute on function public.touch_last_active() from public, anon;
grant execute on function public.touch_last_active() to authenticated;

-- Paginated, same shape as admin_list_stage_events. Backs the Activity Log
-- screen.
create or replace function public.company_list_audit_log(p_company_id uuid, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, actor_id uuid, actor_email text, event_type text,
  target_user_id uuid, target_email text, project_id uuid, project_name text,
  detail jsonb, created_at timestamptz
)
language sql security definer stable
set search_path = public
as $$
  select al.id, al.actor_id, au.email, al.event_type, al.target_user_id, tu.email, al.project_id, pr.name, al.detail, al.created_at
  from audit_logs al
  left join auth.users au on au.id = al.actor_id
  left join auth.users tu on tu.id = al.target_user_id
  left join projects pr on pr.id = al.project_id
  where al.company_id = p_company_id and public.is_company_admin(p_company_id)
  order by al.created_at desc
  limit p_limit offset p_offset;
$$;
revoke execute on function public.company_list_audit_log(uuid, int, int) from public, anon;
grant execute on function public.company_list_audit_log(uuid, int, int) to authenticated;

-- =============================================================================
-- Project-level assignment
-- =============================================================================
-- Gated by can_edit_project on the TARGET project, not company_admin -- so an
-- Owner/Admin/Project Manager can assign people to any company project, and
-- someone with only a project_memberships 'editor' row on this one project
-- can also manage its own roster (matches Project Manager's "invite or
-- assign users to projects, where permitted").

create or replace function public.add_project_member(p_project_id uuid, p_user_id uuid, p_project_role text default 'editor') returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
begin
  select owner_id, company_id into v_owner, v_company from projects where id = p_project_id;
  if v_owner is null then raise exception 'Project not found'; end if;
  if not public.can_edit_project(v_owner, v_company, p_project_id) then raise exception 'Not authorized'; end if;
  if coalesce(p_project_role, '') not in ('editor', 'viewer') then raise exception 'Invalid project role'; end if;
  -- Target must actually be a member of the project's company -- otherwise
  -- this would be a backdoor to grant an outsider access.
  if v_company is not null and not exists (
    select 1 from company_memberships where company_id = v_company and user_id = p_user_id and status = 'active'
  ) then
    raise exception 'User is not a member of this project''s company';
  end if;

  insert into project_memberships (project_id, user_id, project_role, added_by)
    values (p_project_id, p_user_id, p_project_role, auth.uid())
    on conflict (project_id, user_id) do update set project_role = excluded.project_role;
  perform public.log_audit(v_company, auth.uid(), 'project_reassigned', p_user_id, p_project_id, jsonb_build_object('project_role', p_project_role));
end;
$$;
revoke execute on function public.add_project_member(uuid, uuid, text) from public, anon;
grant execute on function public.add_project_member(uuid, uuid, text) to authenticated;

create or replace function public.set_project_member_role(p_project_id uuid, p_user_id uuid, p_project_role text) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
begin
  select owner_id, company_id into v_owner, v_company from projects where id = p_project_id;
  if v_owner is null then raise exception 'Project not found'; end if;
  if not public.can_edit_project(v_owner, v_company, p_project_id) then raise exception 'Not authorized'; end if;
  if coalesce(p_project_role, '') not in ('editor', 'viewer') then raise exception 'Invalid project role'; end if;

  update project_memberships set project_role = p_project_role where project_id = p_project_id and user_id = p_user_id;
  if not found then raise exception 'User is not assigned to this project'; end if;
  perform public.log_audit(v_company, auth.uid(), 'project_reassigned', p_user_id, p_project_id, jsonb_build_object('project_role', p_project_role));
end;
$$;
revoke execute on function public.set_project_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_project_member_role(uuid, uuid, text) to authenticated;

create or replace function public.remove_project_member(p_project_id uuid, p_user_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
begin
  select owner_id, company_id into v_owner, v_company from projects where id = p_project_id;
  if v_owner is null then raise exception 'Project not found'; end if;
  if not public.can_edit_project(v_owner, v_company, p_project_id) then raise exception 'Not authorized'; end if;
  if p_user_id = v_owner then raise exception 'Cannot remove the project owner'; end if;

  delete from project_memberships where project_id = p_project_id and user_id = p_user_id;
  perform public.log_audit(v_company, auth.uid(), 'project_reassigned', p_user_id, p_project_id, jsonb_build_object('removed', true));
end;
$$;
revoke execute on function public.remove_project_member(uuid, uuid) from public, anon;
grant execute on function public.remove_project_member(uuid, uuid) to authenticated;

-- =============================================================================
-- Admin (Speedpanel staff) visibility into companies
-- =============================================================================
-- Read-only visibility for support purposes, reusing the access Speedpanel
-- staff already implicitly have via is_admin() -- NOT the deferred
-- SupportAccess grant model (time-boxed, reason-logged access), just a plain
-- admin-gated read view + the one write action needed to bootstrap a
-- company's first Owner from the existing Admin > Users roster.

create or replace function public.admin_list_companies()
returns table (id uuid, name text, member_count bigint, created_at timestamptz)
language sql security definer stable
set search_path = public
as $$
  select c.id, coalesce(c.trading_name, c.legal_name), count(cm.id) filter (where cm.status = 'active'), c.created_at
  from companies c
  left join company_memberships cm on cm.company_id = c.id
  where public.has_staff_role(array[]::text[])
  group by c.id, c.trading_name, c.legal_name, c.created_at
  order by c.created_at desc;
$$;
revoke execute on function public.admin_list_companies() from public, anon;
grant execute on function public.admin_list_companies() to authenticated;

-- Assigns/detaches an EXISTING user to/from a company. p_company_id = null
-- detaches (soft, mirrors company_remove_member's effect) -- also doubles as
-- the general support tool for "move this user to a different company".
create or replace function public.admin_set_user_company(p_user_id uuid, p_company_id uuid, p_role text default null) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;

  if p_company_id is null then
    update company_memberships set status = 'removed' where user_id = p_user_id and status = 'active';
    return;
  end if;

  if coalesce(p_role, '') not in ('owner', 'admin', 'project_manager', 'estimator', 'site_user', 'viewer') then
    raise exception 'Invalid role';
  end if;
  if not exists (select 1 from companies where id = p_company_id) then raise exception 'Company not found'; end if;

  insert into company_memberships (company_id, user_id, role, status, invited_by, joined_at)
    values (p_company_id, p_user_id, p_role, 'active', auth.uid(), now())
    on conflict (company_id, user_id) do update set role = excluded.role, status = 'active';
  perform public.log_audit(p_company_id, auth.uid(), 'member_added_by_admin', p_user_id);
end;
$$;
revoke execute on function public.admin_set_user_company(uuid, uuid, text) from public, anon;
grant execute on function public.admin_set_user_company(uuid, uuid, text) to authenticated;

-- Adds an EXISTING auth user (e.g. created directly in Supabase, or from any
-- other path that left them without a company yet) to a company by email,
-- wrapping admin_set_user_company's insert logic but keyed by email instead
-- of a pre-known user_id -- the normal invite flow (invitations table) only
-- auto-links on NEW signup (see handle_new_user()'s on_auth_user_created
-- trigger), so an account created before the invite is sent needs this
-- instead of falling back on the invite-then-accept path. Errors clearly if
-- no account exists yet for that email, since that IS the "use Invite
-- instead" case.
create or replace function public.admin_add_company_member_by_email(p_company_id uuid, p_email text, p_role text) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;
  if coalesce(p_role, '') not in ('owner', 'admin', 'project_manager', 'estimator', 'site_user', 'viewer') then
    raise exception 'Invalid role';
  end if;
  if not exists (select 1 from companies where id = p_company_id) then raise exception 'Company not found'; end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No account exists yet for that email -- use Invite instead, or create the account first.';
  end if;

  insert into company_memberships (company_id, user_id, role, status, invited_by, joined_at)
    values (p_company_id, v_user_id, p_role, 'active', auth.uid(), now())
    on conflict (company_id, user_id) do update set role = excluded.role, status = 'active';
  perform public.log_audit(p_company_id, auth.uid(), 'member_added_by_admin', v_user_id);
end;
$$;
revoke execute on function public.admin_add_company_member_by_email(uuid, text, text) from public, anon;
grant execute on function public.admin_add_company_member_by_email(uuid, text, text) to authenticated;

-- =============================================================================
-- Assigned Speedpanel Team
-- =============================================================================
-- A fixed, Speedpanel-managed roster of internal contacts per company --
-- Project Manager, BDM, Internal Sales, Dispatch, Technical Services -- read
-- only for the customer (shown as "Your Speedpanel Team"), editable only by
-- Speedpanel admins. Deliberately a separate table from company_memberships:
-- these are relationships between the customer and Speedpanel, not the
-- customer's own users/roles, even though 'project_manager' happens to be a
-- label both sides use for different things -- see StaffRole vs CompanyRole
-- in companyTypes.ts/staffTypes.ts, never conflated in code.
--
-- project_manager/bdm are "Single Assignment" (relationship owners -- one
-- person should own it); internal_sales/dispatch/technical_services are
-- "Multiple Assignment" (departments -- several people may be involved).
-- The partial unique index below enforces single-assignment at the DB
-- level, not just in the RPC.
create table staff_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  staff_user_id uuid not null references auth.users (id),
  role text not null check (role in ('project_manager', 'bdm', 'internal_sales', 'dispatch', 'technical_services')),
  is_primary boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (company_id, staff_user_id, role)
);
create unique index staff_assignments_single_role_idx on staff_assignments (company_id, role)
  where active and role in ('project_manager', 'bdm');

alter table staff_assignments enable row level security;

-- Read-only for customers -- any active member of the company can see who's
-- assigned, but there is no insert/update/delete policy at all: every write
-- goes through admin_set_staff_assignment/admin_remove_staff_assignment
-- below, both is_admin()-gated. Not even a company Owner can write here.
create policy "Members and admins can read staff assignments" on staff_assignments
  for select using (
    public.is_admin()
    or exists (select 1 from company_memberships cm where cm.company_id = staff_assignments.company_id and cm.user_id = auth.uid() and cm.status = 'active')
  );

-- is_admin()-gated; validates the role and that the target is currently a
-- Speedpanel admin account (staff_assignments has no other concept of
-- "employee" -- if Speedpanel wants a team-alias assignee with no personal
-- login, they'd give it its own admin account, same as any other staff
-- member). For project_manager/bdm, deactivates any other active row for
-- that (company, role) first so the partial unique index above holds, then
-- upserts -- reactivating a previously-removed assignment is idempotent
-- rather than erroring on the (company_id, staff_user_id, role) unique
-- constraint.
create or replace function public.admin_set_staff_assignment(p_company_id uuid, p_staff_user_id uuid, p_role text) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_is_single boolean;
begin
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;
  if coalesce(p_role, '') not in ('project_manager', 'bdm', 'internal_sales', 'dispatch', 'technical_services') then
    raise exception 'Invalid role';
  end if;
  if not exists (select 1 from profiles where id = p_staff_user_id and role = 'admin') then
    raise exception 'Staff must be a Speedpanel admin account';
  end if;

  v_is_single := p_role in ('project_manager', 'bdm');
  if v_is_single then
    update staff_assignments set active = false
      where company_id = p_company_id and role = p_role and active and staff_user_id <> p_staff_user_id;
  end if;

  insert into staff_assignments (company_id, staff_user_id, role, is_primary, active, created_by)
    values (p_company_id, p_staff_user_id, p_role, v_is_single, true, auth.uid())
    on conflict (company_id, staff_user_id, role) do update set active = true, is_primary = excluded.is_primary;
  perform public.log_audit(p_company_id, auth.uid(), 'staff_assignment_added', p_staff_user_id, null, jsonb_build_object('role', p_role));
end;
$$;
revoke execute on function public.admin_set_staff_assignment(uuid, uuid, text) from public, anon;
grant execute on function public.admin_set_staff_assignment(uuid, uuid, text) to authenticated;

create or replace function public.admin_remove_staff_assignment(p_company_id uuid, p_staff_user_id uuid, p_role text) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;
  update staff_assignments set active = false
    where company_id = p_company_id and staff_user_id = p_staff_user_id and role = p_role and active;
  if not found then raise exception 'Assignment not found'; end if;
  perform public.log_audit(p_company_id, auth.uid(), 'staff_assignment_removed', p_staff_user_id, null, jsonb_build_object('role', p_role));
end;
$$;
revoke execute on function public.admin_remove_staff_assignment(uuid, uuid, text) from public, anon;
grant execute on function public.admin_remove_staff_assignment(uuid, uuid, text) to authenticated;

-- Same access shape as company_list_members -- any active member of the
-- company, or is_admin(). Powers both the customer-facing "Your Speedpanel
-- Team" card and the admin assignment editor (the admin sees the same rows
-- via the is_admin() OR-clause, no separate admin-only RPC needed).
create or replace function public.company_list_staff_team(p_company_id uuid)
returns table (staff_user_id uuid, email text, display_name text, title text, phone text, role text, is_primary boolean)
language sql security definer stable
set search_path = public
as $$
  select sa.staff_user_id, u.email, p.display_name, p.title, p.phone, sa.role, sa.is_primary
  from staff_assignments sa
  join auth.users u on u.id = sa.staff_user_id
  join profiles p on p.id = sa.staff_user_id
  where sa.active
    and (public.is_admin() or exists (select 1 from company_memberships cm where cm.company_id = p_company_id and cm.user_id = auth.uid() and cm.status = 'active'))
    and sa.company_id = p_company_id
  order by sa.role, u.email;
$$;
revoke execute on function public.company_list_staff_team(uuid) from public, anon;
grant execute on function public.company_list_staff_team(uuid) to authenticated;

-- super_admin-gated (has_staff_role(array[])) -- the picker source for the
-- assignment UI (wizard step 3 and the Admin > Companies per-company
-- editor). Returns staff_role so the frontend can filter each role
-- section's candidate list to people whose own job function matches (or
-- who are super_admin) -- see StaffTeamAssignmentPanel.tsx.
drop function if exists public.admin_list_staff_candidates();

create or replace function public.admin_list_staff_candidates()
returns table (id uuid, email text, display_name text, title text, staff_role text)
language sql security definer stable
set search_path = public
as $$
  select p.id, u.email, p.display_name, p.title, p.staff_role
  from profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin' and public.has_staff_role(array[]::text[])
  order by coalesce(p.display_name, u.email);
$$;
revoke execute on function public.admin_list_staff_candidates() from public, anon;
grant execute on function public.admin_list_staff_candidates() to authenticated;

-- =============================================================================
-- Foreign key indexes -- company workspace tables
-- =============================================================================
-- Same reasoning as the "Foreign key indexes" section above: Postgres
-- doesn't auto-index the referencing side of a relationship, and every RLS
-- policy/RPC introduced by this section filters on exactly these columns.
create index if not exists idx_company_memberships_company_id on company_memberships (company_id);
create index if not exists idx_company_memberships_user_id    on company_memberships (user_id);
create index if not exists idx_invitations_company_id         on invitations (company_id);
create index if not exists idx_invitations_email              on invitations (email);
create index if not exists idx_project_memberships_user_id    on project_memberships (user_id);
create index if not exists idx_audit_logs_company_id          on audit_logs (company_id);
create index if not exists idx_audit_logs_actor_id            on audit_logs (actor_id);
create index if not exists idx_audit_logs_target_user_id      on audit_logs (target_user_id);
create index if not exists idx_audit_logs_project_id          on audit_logs (project_id);
create index if not exists idx_projects_company_id            on projects (company_id);
create index if not exists idx_projects_project_manager       on projects (project_manager_user_id);
create index if not exists idx_orders_company_id              on orders (company_id);
create index if not exists idx_staff_assignments_company_id   on staff_assignments (company_id);
create index if not exists idx_staff_assignments_staff_user_id on staff_assignments (staff_user_id);
