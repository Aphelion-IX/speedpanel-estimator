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

-- Baseline table/sequence/function privileges for anon/authenticated --
-- RLS (enabled per-table below) is the real access boundary, but without
-- this grant Postgres blocks every query before RLS is even evaluated
-- ("permission denied for table X", distinct from an RLS denial). On a
-- hosted Supabase project this is applied automatically at project
-- creation, outside schema.sql, which is why it was never captured here --
-- but that means schema.sql alone could never actually bootstrap a working
-- database (confirmed: a from-scratch `supabase db reset` gets exactly
-- that "permission denied" error on every table). ALTER DEFAULT PRIVILEGES
-- extends the same grant to every table this script creates below,
-- matching what the hosted platform already does going forward too.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

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

-- =============================================================================
-- Dynamic RBAC: permission catalog + role grants
-- =============================================================================
-- Every has_staff_role(array['x','y']) call site below (RPC bodies AND
-- inline RLS policy clauses) is being migrated to has_permission('some.key')
-- instead, so a super_admin can change which internal StaffRole can do what
-- from Admin > Roles (AdminRolesPage.tsx) without a code deploy. Defined
-- here (immediately after has_staff_role()) rather than at the end of the
-- file so every rewritten call site below -- the very first is 20 lines down
-- -- has its dependency already in place, same as every other
-- "defined once, used everywhere after" function in this file.
create table public.permissions (
  key text primary key,
  description text not null,
  category text not null,
  created_at timestamptz not null default now()
);

-- super_admin is structurally excluded (check constraint) -- has_staff_role()'s
-- grandfather clause above already gives super_admin/null-staff_role
-- unconditional access to everything has_permission() gates, so a row here
-- for 'super_admin' would be both meaningless (has_permission() below never
-- reaches the role_permissions lookup for that account) and misleading if
-- ever exposed as an editable checkbox in the Roles UI.
create table public.role_permissions (
  role text not null check (role in ('project_manager', 'bdm', 'internal_sales', 'dispatch', 'technical_services')),
  permission_key text not null references public.permissions (key) on delete cascade,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  primary key (role, permission_key)
);
create index idx_role_permissions_permission_key on public.role_permissions (permission_key);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

create policy "Staff-role-manage can read permission catalog" on public.permissions
  for select using (public.has_staff_role(array[]::text[]));
-- No insert/update/delete policy -- catalog rows are seeded/extended only via
-- schema.sql migrations, never from the client; only role_permissions (the
-- grants) are client-editable, exclusively through admin_set_role_permission()
-- below.

create policy "Staff-role-manage can read all role grants" on public.role_permissions
  for select using (public.has_staff_role(array[]::text[]));
-- A staff member (bdm/dispatch/etc.) can also read grants for THEIR OWN role
-- -- this is what adminSectionAccess.ts's client-side nav gating reads
-- directly (a plain table select, same "own row" pattern
-- useMyInternalRole.ts already uses for staff_role itself), no RPC needed
-- for that path.
create policy "Staff can read grants for their own role" on public.role_permissions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.staff_role = role_permissions.role
    )
  );
-- No insert/update/delete policy -- all writes go through
-- admin_set_role_permission() below.

-- Finer-grained than has_staff_role() -- checks a specific permission_key
-- against role_permissions instead of a hardcoded array literal at the call
-- site. Reuses has_staff_role(array[]::text[]) for EXACTLY its grandfather
-- semantics (is_admin() required; staff_role IS NULL or 'super_admin' always
-- passes, regardless of p_permission_key) -- never reimplemented, so the two
-- functions can never drift apart on that clause.
create or replace function public.has_permission(p_permission_key text) returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.has_staff_role(array[]::text[]) or exists (
    select 1 from public.profiles p
    join public.role_permissions rp on rp.role = p.staff_role
    where p.id = auth.uid() and p.role = 'admin' and rp.permission_key = p_permission_key
  );
$$;
revoke execute on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;

-- admin_list_permission_matrix()/admin_set_role_permission() below (the RPCs
-- that read/write the matrix) are DELIBERATELY gated by has_staff_role()
-- directly, never has_permission() -- if "who can edit RBAC" were itself a
-- row in role_permissions, a role holding it could self-escalate, and a bad
-- edit could lock out the only page that fixes RBAC mistakes. Same reasoning
-- applies to the admin-invite-user Edge Function's own super_admin gate,
-- which stays has_staff_role()-based too.
create or replace function public.admin_list_permission_matrix()
returns table (permission_key text, description text, category text, role text, granted boolean)
language sql security definer stable
set search_path = public
as $$
  select p.key, p.description, p.category, r.role,
    exists (select 1 from public.role_permissions rp where rp.role = r.role and rp.permission_key = p.key)
  from public.permissions p
  cross join (values ('project_manager'), ('bdm'), ('internal_sales'), ('dispatch'), ('technical_services')) as r(role)
  where public.has_staff_role(array[]::text[])
  order by p.category, p.key, r.role;
$$;
revoke execute on function public.admin_list_permission_matrix() from public, anon;
grant execute on function public.admin_list_permission_matrix() to authenticated;

create or replace function public.admin_set_role_permission(p_role text, p_permission_key text, p_granted boolean) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_staff_role(array[]::text[]) then raise exception 'Not authorized'; end if;
  if p_role not in ('project_manager', 'bdm', 'internal_sales', 'dispatch', 'technical_services') then
    raise exception 'Invalid role';
  end if;
  if not exists (select 1 from public.permissions where key = p_permission_key) then
    raise exception 'Unknown permission key';
  end if;
  if p_granted then
    insert into public.role_permissions (role, permission_key, granted_by) values (p_role, p_permission_key, auth.uid())
      on conflict (role, permission_key) do nothing;
  else
    delete from public.role_permissions where role = p_role and permission_key = p_permission_key;
  end if;
end;
$$;
revoke execute on function public.admin_set_role_permission(text, text, boolean) from public, anon;
grant execute on function public.admin_set_role_permission(text, text, boolean) to authenticated;

-- Permission catalog seed -- one row per has_staff_role(...) call site being
-- migrated below (both RPC-body and RLS-policy sites), plus one
-- admin.section.* row per non-dashboard AdminSubPage (nav-visibility layer,
-- read by adminSectionAccess.ts via useMyInternalRole.ts), plus the two
-- admin-invite-user Edge Function sites (users.invite_staff /
-- companies.create_company_user). See each call site's own comment below
-- for why it maps to the key it does.
insert into public.permissions (key, description, category) values
  ('requests.triage_update', 'Triage (accept/decline/assign) incoming requests', 'requests'),
  ('users.list', 'List the Speedpanel staff directory', 'users'),
  ('users.count', 'Read staff/user counts (Analytics)', 'users'),
  ('users.set_role', 'Promote/demote an account between user and admin', 'users'),
  ('users.set_staff_profile', 'Edit a staff member''s display name/title/phone', 'users'),
  ('users.set_staff_role', 'Change a staff member''s internal job function', 'users'),
  ('users.promote_to_staff', 'Promote an existing account to staff by email', 'users'),
  ('users.invite_staff', 'Create a brand-new Speedpanel staff account', 'users'),
  ('admin.stage_events.list', 'Read the install/technical review history feed', 'audit'),
  ('orders.issue_proforma_invoice', 'Issue a pro forma invoice for a submitted order', 'orders'),
  ('manufacturing.update_progress', 'Update panels-manufactured / est. completion', 'manufacturing'),
  ('manufacturing.update_delivery_status', 'Update a delivery''s manufacturing status', 'manufacturing'),
  ('companies.manage_all', 'Manage any company as Speedpanel staff (bypasses membership)', 'companies'),
  ('companies.create', 'Create a new company workspace', 'companies'),
  ('companies.list', 'List all company workspaces', 'companies'),
  ('companies.set_user_company', 'Move/detach a user to/from a company', 'companies'),
  ('companies.add_member_by_email', 'Grant an existing account access to a company', 'companies'),
  ('companies.create_company_user', 'Create a brand-new external company user', 'companies'),
  ('companies.set_staff_assignment', 'Assign a staff member to a company''s Speedpanel Team', 'companies'),
  ('companies.remove_staff_assignment', 'Remove a Speedpanel Team assignment', 'companies'),
  ('companies.list_staff_candidates', 'List staff eligible for Speedpanel Team assignment', 'companies'),
  ('project_reviews.review_install', 'Approve/request changes on an install review', 'project_reviews'),
  ('project_reviews.review_technical', 'Approve/request changes on a technical review', 'project_reviews'),
  ('price_lists.read', 'Read the price list catalog', 'price_lists'),
  ('price_list_prices.read', 'Read price list line items', 'price_lists'),
  ('price_lists.list', 'List price lists with usage counts', 'price_lists'),
  ('price_lists.create', 'Create a new price list', 'price_lists'),
  ('price_lists.rename', 'Rename a price list', 'price_lists'),
  ('price_lists.duplicate', 'Duplicate a price list', 'price_lists'),
  ('price_lists.set_price', 'Set/update a product''s price on a list', 'price_lists'),
  ('price_lists.delete_price', 'Remove a product''s price from a list', 'price_lists'),
  ('price_lists.delete', 'Delete a price list', 'price_lists'),
  ('price_lists.assign_to_company', 'Assign a price list to a company', 'price_lists'),
  ('delivery.accept_date', 'Accept a customer''s requested delivery date', 'delivery'),
  ('delivery.propose_date', 'Propose an alternative delivery date', 'delivery'),
  ('delivery.decline_request', 'Decline a delivery request', 'delivery'),
  ('delivery.set_internal_note', 'Set a delivery''s internal note', 'delivery'),
  ('delivery.set_customer_note', 'Set a delivery''s customer-visible note', 'delivery'),
  ('delivery.create', 'Split/create an additional delivery', 'delivery'),
  ('delivery.update', 'Edit an existing delivery''s content fields', 'delivery'),
  ('delivery.list', 'List all delivery requests', 'delivery'),
  ('admin.section.requests', 'See the Requests admin section', 'nav'),
  ('admin.section.projectReviews', 'See the Project Reviews admin section', 'nav'),
  ('admin.section.orders', 'See the Orders admin section', 'nav'),
  ('admin.section.deliveryRequests', 'See the Delivery Requests admin section', 'nav'),
  ('admin.section.manufacturing', 'See the Manufacturing & Delivery admin section', 'nav'),
  ('admin.section.users', 'See the Users admin section', 'nav'),
  ('admin.section.companies', 'See the Companies admin section', 'nav'),
  ('admin.section.permissions', 'See the Roles admin section', 'nav'),
  ('admin.section.analytics', 'See the Analytics admin section', 'nav'),
  ('admin.section.auditLog', 'See the Audit Log admin section', 'nav'),
  ('admin.section.products', 'See the Products admin section', 'nav'),
  ('admin.section.priceLists', 'See the Price Lists admin section', 'nav'),
  ('admin.section.systems', 'See the Systems admin section', 'nav'),
  ('admin.section.maths', 'See the Maths admin section', 'nav'),
  ('admin.section.documents', 'See the Documents admin section', 'nav')
on conflict (key) do nothing;

-- Role grants seed -- reproduces today's SECTION_ROLES/has_staff_role(...)
-- call-site behavior EXACTLY. Only the mechanism becomes dynamic here; no
-- role gains or loses access as of this migration. Every permission_key NOT
-- listed here (users.*, companies.* except none above, price_lists.*,
-- admin.section.{users,companies,permissions,analytics,auditLog,products,
-- priceLists,systems,maths,documents}) intentionally gets ZERO rows,
-- matching today's super_admin/null-staff_role-only fallthrough exactly.
insert into public.role_permissions (role, permission_key) values
  ('bdm', 'requests.triage_update'), ('bdm', 'admin.section.requests'),
  ('internal_sales', 'orders.issue_proforma_invoice'), ('internal_sales', 'admin.section.orders'),
  ('dispatch', 'manufacturing.update_progress'), ('dispatch', 'manufacturing.update_delivery_status'),
  ('dispatch', 'admin.section.manufacturing'),
  ('project_manager', 'project_reviews.review_install'), ('technical_services', 'project_reviews.review_install'),
  ('project_manager', 'project_reviews.review_technical'), ('technical_services', 'project_reviews.review_technical'),
  ('project_manager', 'admin.section.projectReviews'), ('technical_services', 'admin.section.projectReviews'),
  ('internal_sales', 'delivery.accept_date'),   ('dispatch', 'delivery.accept_date'),
  ('internal_sales', 'delivery.propose_date'),  ('dispatch', 'delivery.propose_date'),
  ('internal_sales', 'delivery.decline_request'), ('dispatch', 'delivery.decline_request'),
  ('internal_sales', 'delivery.set_internal_note'), ('dispatch', 'delivery.set_internal_note'),
  ('internal_sales', 'delivery.set_customer_note'), ('dispatch', 'delivery.set_customer_note'),
  ('internal_sales', 'delivery.create'), ('dispatch', 'delivery.create'),
  ('internal_sales', 'delivery.update'), ('dispatch', 'delivery.update'),
  ('internal_sales', 'delivery.list'),  ('dispatch', 'delivery.list'),
  ('internal_sales', 'admin.section.deliveryRequests'), ('dispatch', 'admin.section.deliveryRequests')
on conflict (role, permission_key) do nothing;

-- Narrowed from a plain role='admin' check to has_staff_role() -- Requests
-- triage is a BDM function, per "Internal staff roles". Redefined here
-- (rather than at the table's original "Admins can update requests" policy
-- further up) since has_staff_role() isn't defined until this point in the
-- file -- same "policy redefined later once its dependency exists" pattern
-- already used throughout this schema (e.g. projects/orders policies
-- redefined after can_edit_project).
drop policy "Admins can update requests" on requests;
create policy "Admins can update requests" on requests
  for update using (public.has_permission('requests.triage_update'))
  with check (public.has_permission('requests.triage_update'));

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
-- Public read was already granted above. Writes require is_admin() --
-- AdminGate.tsx requires the caller to be signed in and profiles.role =
-- 'admin' too, matching this end to end (see appShell/AdminGate.tsx).
-- requests/projects are NOT part of this -- those hold customer PII (name/
-- email/phone/project data) and stay gated to auth.uid()/is_admin() below.
-- =============================================================================
create policy "Admin write access"  on panels   for insert with check (is_admin());
create policy "Admin update access" on panels   for update using (is_admin()) with check (is_admin());
create policy "Admin delete access" on panels   for delete using (is_admin());

create policy "Admin write access"  on tracks   for insert with check (is_admin());
create policy "Admin update access" on tracks   for update using (is_admin()) with check (is_admin());
create policy "Admin delete access" on tracks   for delete using (is_admin());

create policy "Admin write access"  on fixings  for insert with check (is_admin());
create policy "Admin update access" on fixings  for update using (is_admin()) with check (is_admin());
create policy "Admin delete access" on fixings  for delete using (is_admin());

create policy "Admin write access"  on sealants for insert with check (is_admin());
create policy "Admin update access" on sealants for update using (is_admin()) with check (is_admin());
create policy "Admin delete access" on sealants for delete using (is_admin());

create policy "Admin write access"  on colours  for insert with check (is_admin());
create policy "Admin update access" on colours  for update using (is_admin()) with check (is_admin());
create policy "Admin delete access" on colours  for delete using (is_admin());

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
create policy "Admin write access"  on admin_documents for insert with check (is_admin());
create policy "Admin update access" on admin_documents for update using (is_admin()) with check (is_admin());
create policy "Admin delete access" on admin_documents for delete using (is_admin());

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
create policy "Admin update access" on system_locked_rows
  for update using (is_admin()) with check (is_admin());
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
create policy "Admin update access" on math_constants
  for update using (is_admin()) with check (is_admin());
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
create policy "Admin update access" on system_tables
  for update using (is_admin()) with check (is_admin());
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
-- now, never listed here. has_permission('users.list') (dynamic RBAC) rather than
-- plain is_admin() -- see "Internal staff roles" section below.
create or replace function public.admin_list_users(p_limit int default 50, p_offset int default 0)
returns table (id uuid, email text, role text, created_at timestamptz, display_name text, title text, phone text, staff_role text)
language sql security definer stable
set search_path = public
as $$
  select p.id, u.email, p.role, p.created_at, p.display_name, p.title, p.phone, p.staff_role
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin' and public.has_permission('users.list')
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
  where public.has_permission('users.count');
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
  if not public.has_permission('users.set_role') then raise exception 'Not authorized'; end if;
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
-- Users area is has_permission()-gated from here on (dynamic RBAC) --
-- Admin > Users is a staff directory, not a general account list, so by
-- default (no role_permissions grants seeded for these keys) only a
-- super_admin manages it, same reasoning as admin_set_role/
-- admin_set_staff_role below).
create or replace function public.admin_set_staff_profile(p_user_id uuid, p_display_name text, p_title text, p_phone text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_permission('users.set_staff_profile') then raise exception 'Not authorized'; end if;
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
  if not public.has_permission('users.set_staff_role') then raise exception 'Not authorized'; end if;
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
  if not public.has_permission('users.promote_to_staff') then raise exception 'Not authorized'; end if;
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
  where public.has_permission('admin.stage_events.list')
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
  if not public.has_permission('orders.issue_proforma_invoice') then raise exception 'Not authorized'; end if;

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

-- Dispatch-only writes (has_permission('manufacturing.update_progress'/
-- 'manufacturing.update_delivery_status')), via dedicated RPCs rather than
-- narrowing the "Owners, company, and admins can update orders"/"...manage
-- deliveries..." RLS policies further down this file:
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
  if not public.has_permission('manufacturing.update_progress') then raise exception 'Not authorized'; end if;
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
  if not public.has_permission('manufacturing.update_delivery_status') then raise exception 'Not authorized'; end if;
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
-- has_permission('companies.manage_all') (dynamic RBAC) rather than plain is_admin():
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
  select public.has_permission('companies.manage_all') or exists (
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
  select public.has_permission('companies.manage_all') or exists (
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
  if not public.has_permission('project_reviews.review_install') then raise exception 'Not authorized'; end if;
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
  if not public.has_permission('project_reviews.review_technical') then raise exception 'Not authorized'; end if;
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
-- Company Accounts & Pricing -- Phase 2 schema catch-up
-- =============================================================================
-- Expands companies.status from the original 3-value placeholder set
-- ('active'/'suspended'/'closed', never actually surfaced in any admin UI
-- before now) to the 5-state model the backend spec describes
-- (Pending/Active/On Hold/Suspended/Archived). 'closed' never had a code
-- path that set it (grep confirms), so it maps onto 'archived' rather than
-- needing its own case. New companies now start 'pending' -- admin_create_company
-- below is the only insert path into this table (see "Company-creation
-- cutover" a few lines down), so the column default doubles as that call
-- site's default. This is enum/default catch-up ONLY -- nothing yet reads
-- these new states to block anything (see the phased plan's Phase 11 for
-- actual On-Hold/Suspended order-blocking enforcement).
update companies set status = 'archived' where status = 'closed';
alter table companies drop constraint companies_status_check;
alter table companies add constraint companies_status_check
  check (status in ('pending', 'active', 'on_hold', 'suspended', 'archived'));
alter table companies alter column status set default 'pending';

-- "Payment or account terms" / "Internal notes" -- two of the Account-step
-- fields the backend spec's company field list (section 1) names that had
-- no column yet.
alter table companies add column payment_terms text;
alter table companies add column internal_notes text;

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
--
-- p_payment_terms/p_internal_notes (Phase 2) are appended, not inserted
-- among the existing params -- old callers (the pre-Phase-2 3-step wizard)
-- that never pass them still work unchanged via the defaults. Dropped and
-- recreated (not a bare `create or replace`) because appending params
-- changes the function's argument-type signature, same convention already
-- used by admin_list_staff_candidates()/admin_list_companies() below.
drop function if exists public.admin_create_company(text, text, text, text, text, text, text);

create or replace function public.admin_create_company(
  p_legal_name text, p_trading_name text default null, p_abn text default null,
  p_customer_account_number text default null, p_billing_email text default null,
  p_phone text default null, p_address text default null,
  p_payment_terms text default null, p_internal_notes text default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if not public.has_permission('companies.create') then raise exception 'Not authorized'; end if;
  if coalesce(trim(p_legal_name), '') = '' then raise exception 'Company name is required'; end if;

  -- companies.price_list_id is not null (see the price_lists migration's
  -- backfill) but this function predates that column and was never updated
  -- when it was added -- every new company defaults to PL1 - Standard, same
  -- as every pre-existing company was backfilled to, until an admin assigns
  -- a different list via admin_set_company_price_list(). status is left to
  -- the column default ('pending', see the Phase 2 schema catch-up above).
  insert into companies (legal_name, trading_name, abn, customer_account_number, billing_email, phone, address, payment_terms, internal_notes, created_by, price_list_id)
    values (p_legal_name, p_trading_name, p_abn, p_customer_account_number, p_billing_email, p_phone, p_address, p_payment_terms, p_internal_notes, auth.uid(),
      (select id from price_lists where is_default))
    returning id into v_company_id;
  perform public.log_audit(v_company_id, auth.uid(), 'company_created');
  return v_company_id;
end;
$$;
revoke execute on function public.admin_create_company(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_company(text, text, text, text, text, text, text, text, text) to authenticated;

-- Phase 2's company-status editor -- has_permission('companies.set_status')-gated
-- (new permission key, see the block below), records the transition on
-- audit_logs via log_audit() the same way every other company-workspace
-- mutation does. p_status is validated against the same 5-state list as the
-- table's own check constraint (defence in depth -- a bad value should fail
-- with a clear message here, not a raw constraint-violation error).
create or replace function public.admin_set_company_status(p_company_id uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_old_status text;
begin
  if not public.has_permission('companies.set_status') then raise exception 'Not authorized'; end if;
  if p_status not in ('pending', 'active', 'on_hold', 'suspended', 'archived') then raise exception 'Invalid status'; end if;

  select status into v_old_status from companies where id = p_company_id;
  if not found then raise exception 'Company not found'; end if;

  update companies set status = p_status, updated_at = now() where id = p_company_id;
  perform public.log_audit(p_company_id, auth.uid(), 'company_status_changed', null, null,
    jsonb_build_object('from', v_old_status, 'to', p_status, 'reason', p_reason));
end;
$$;
revoke execute on function public.admin_set_company_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_company_status(uuid, text, text) to authenticated;

insert into public.permissions (key, description, category) values
  ('companies.set_status', 'Change a company''s account status (Pending/Active/On Hold/Suspended/Archived)', 'companies')
on conflict (key) do nothing;

-- Single-company activity counts for CompanyOverviewPage.tsx's KPI tiles --
-- kept as its own tiny RPC (parameterized to one company_id, cheap even as
-- a correlated-subquery pair) rather than folded into admin_list_companies()
-- below, since the list view never needs per-row project/order counts and
-- admin_list_companies() already runs across every company. orders has no
-- company_id column of its own (see the phased plan's corrected-understanding
-- notes) -- reached via its project_id -> projects.company_id join instead.
create or replace function public.admin_company_activity_counts(p_company_id uuid)
returns table (project_count bigint, order_count bigint)
language sql security definer stable
set search_path = public
as $$
  select
    (select count(*) from projects where company_id = p_company_id and deleted_at is null),
    (select count(*) from orders o join projects p on p.id = o.project_id where p.company_id = p_company_id)
  where public.has_permission('companies.list');
$$;
revoke execute on function public.admin_company_activity_counts(uuid) from public, anon;
grant execute on function public.admin_company_activity_counts(uuid) to authenticated;

-- =============================================================================
-- Company Accounts & Pricing -- Phase 3: Company Addresses
-- =============================================================================
-- Genuinely new -- today `companies.address` is one text field. This table
-- is purely a picker source for pre-filling order_deliveries' own address
-- fields at delivery-creation time; order_deliveries already freezes
-- addresses as plain text with no FK (see the phased plan's corrected-
-- understanding notes), so nothing about that freeze behavior changes here.
--
-- `label` is one deliberate addition beyond the phased plan's own draft SQL
-- (flagged there as "exact field set to confirm against spec text") -- the
-- backend spec's table list names `company_addresses` but gives no column
-- list of its own, and the screenshots need *something* to distinguish two
-- addresses of the same type (e.g. two delivery locations, only one
-- default) -- "Dandenong Warehouse" vs "Sydney Office" in the mockup.
--
-- Two access paths, deliberately separate:
-- - RLS (below): the company's OWN active members/admins reading/writing
--   directly -- is_company_admin() already carries the companies.manage_all
--   staff bypass, so this also covers staff, but is the path a future
--   customer-facing addresses page would use.
-- - The RPCs further down: the STAFF module's path (CompanyAddressesTab.tsx),
--   gated by the new company_addresses.read/write permission keys (dynamic
--   RBAC -- lets e.g. dispatch read without necessarily being able to write)
--   rather than is_company_admin(), and the only path that calls log_audit().
create table company_addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  type text not null check (type in ('billing', 'delivery', 'office')),
  is_default boolean not null default false,
  label text,
  line1 text not null,
  line2 text,
  suburb text,
  state text,
  postcode text,
  delivery_contact_name text,
  delivery_contact_phone text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One default per (company, type) -- e.g. one default billing address and
-- one default delivery address at a time, enforced at the DB level, not
-- just by the RPCs clearing the old default first (see
-- admin_set_company_address/admin_set_default_address below).
create unique index company_addresses_one_default_per_type on company_addresses (company_id, type) where is_default;
create index idx_company_addresses_company_id on company_addresses (company_id);

alter table company_addresses enable row level security;

create policy "Members and admins can read company addresses" on company_addresses
  for select using (
    public.is_admin()
    or exists (select 1 from company_memberships cm where cm.company_id = company_addresses.company_id and cm.user_id = auth.uid() and cm.status = 'active')
  );
create policy "Company admins can insert company addresses" on company_addresses
  for insert with check (public.is_company_admin(company_id));
create policy "Company admins can update company addresses" on company_addresses
  for update using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy "Company admins can delete company addresses" on company_addresses
  for delete using (public.is_company_admin(company_id));

insert into public.permissions (key, description, category) values
  ('company_addresses.read', 'Read a company''s saved addresses (staff module)', 'companies'),
  ('company_addresses.write', 'Create/edit/delete a company''s saved addresses (staff module)', 'companies')
on conflict (key) do nothing;

create or replace function public.company_list_addresses(p_company_id uuid)
returns table (
  id uuid, type text, is_default boolean, label text, line1 text, line2 text,
  suburb text, state text, postcode text, delivery_contact_name text, delivery_contact_phone text,
  created_at timestamptz, updated_at timestamptz
)
language sql security definer stable
set search_path = public
as $$
  select id, type, is_default, label, line1, line2, suburb, state, postcode,
    delivery_contact_name, delivery_contact_phone, created_at, updated_at
  from company_addresses
  where company_id = p_company_id and public.has_permission('company_addresses.read')
  order by type, is_default desc, created_at;
$$;
revoke execute on function public.company_list_addresses(uuid) from public, anon;
grant execute on function public.company_list_addresses(uuid) to authenticated;

-- Upsert -- p_address_id null creates, present updates. Clearing the old
-- default is its own statement (not folded into the insert/update), so the
-- one-default-per-type unique index above never sees two defaults at once
-- even transiently -- each statement's constraint check runs immediately,
-- not deferred to end of transaction.
create or replace function public.admin_set_company_address(
  p_address_id uuid, p_company_id uuid, p_type text, p_label text,
  p_line1 text, p_line2 text, p_suburb text, p_state text, p_postcode text,
  p_delivery_contact_name text default null, p_delivery_contact_phone text default null,
  p_is_default boolean default false
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_event text;
begin
  if not public.has_permission('company_addresses.write') then raise exception 'Not authorized'; end if;
  if p_type not in ('billing', 'delivery', 'office') then raise exception 'Invalid address type'; end if;
  if coalesce(trim(p_line1), '') = '' then raise exception 'Street address is required'; end if;

  if p_is_default then
    update company_addresses set is_default = false, updated_at = now()
      where company_id = p_company_id and type = p_type and is_default and id is distinct from p_address_id;
  end if;

  if p_address_id is null then
    insert into company_addresses (
      company_id, type, label, line1, line2, suburb, state, postcode,
      delivery_contact_name, delivery_contact_phone, is_default, created_by
    ) values (
      p_company_id, p_type, nullif(trim(p_label), ''), p_line1, nullif(trim(p_line2), ''), p_suburb, p_state, p_postcode,
      nullif(trim(p_delivery_contact_name), ''), nullif(trim(p_delivery_contact_phone), ''), p_is_default, auth.uid()
    ) returning id into v_id;
    v_event := 'company_address_added';
  else
    update company_addresses set
      type = p_type, label = nullif(trim(p_label), ''), line1 = p_line1, line2 = nullif(trim(p_line2), ''),
      suburb = p_suburb, state = p_state, postcode = p_postcode,
      delivery_contact_name = nullif(trim(p_delivery_contact_name), ''), delivery_contact_phone = nullif(trim(p_delivery_contact_phone), ''),
      is_default = p_is_default, updated_at = now()
      where id = p_address_id and company_id = p_company_id
      returning id into v_id;
    if v_id is null then raise exception 'Address not found'; end if;
    v_event := 'company_address_changed';
  end if;

  perform public.log_audit(p_company_id, auth.uid(), v_event, null, null, jsonb_build_object('address_id', v_id, 'type', p_type));
  return v_id;
end;
$$;
revoke execute on function public.admin_set_company_address(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_set_company_address(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) to authenticated;

create or replace function public.admin_delete_company_address(p_address_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if not public.has_permission('company_addresses.write') then raise exception 'Not authorized'; end if;
  delete from company_addresses where id = p_address_id returning company_id into v_company_id;
  if v_company_id is null then raise exception 'Address not found'; end if;
  perform public.log_audit(v_company_id, auth.uid(), 'company_address_removed', null, null, jsonb_build_object('address_id', p_address_id));
end;
$$;
revoke execute on function public.admin_delete_company_address(uuid) from public, anon;
grant execute on function public.admin_delete_company_address(uuid) to authenticated;

-- Lighter-weight than admin_set_company_address for the common "make this
-- existing address the default" action (e.g. a card's own "Set default"
-- button) -- no need to resubmit the whole address form.
create or replace function public.admin_set_default_address(p_address_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_type text;
begin
  if not public.has_permission('company_addresses.write') then raise exception 'Not authorized'; end if;
  select company_id, type into v_company_id, v_type from company_addresses where id = p_address_id;
  if v_company_id is null then raise exception 'Address not found'; end if;

  update company_addresses set is_default = false, updated_at = now()
    where company_id = v_company_id and type = v_type and is_default and id <> p_address_id;
  update company_addresses set is_default = true, updated_at = now() where id = p_address_id;

  perform public.log_audit(v_company_id, auth.uid(), 'company_address_changed', null, null, jsonb_build_object('address_id', p_address_id, 'set_default', true));
end;
$$;
revoke execute on function public.admin_set_default_address(uuid) from public, anon;
grant execute on function public.admin_set_default_address(uuid) to authenticated;

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
  -- which calls this RPC for the validation + expiry reset. 5 days, not the
  -- original 14 -- Phase 5 (Company Accounts & Pricing) changed the default
  -- to match the mockup's "Invitation Rules" copy; kept in sync here.
  update invitations set expires_at = now() + interval '5 days' where id = p_invitation_id;
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
-- Company Accounts & Pricing -- Phase 5: standalone Invitations page +
-- "Delivery Failed" status
-- =============================================================================
-- A real send failure previously deleted the just-inserted invitations row
-- (see company-invite-member/index.ts's old comment, now rewritten) and
-- returned a synchronous error -- nothing persisted, so a failed send was
-- invisible anywhere in the app after the fact. delivery_failed makes that
-- state real and visible instead. ALTERed rather than edited into the
-- original `create table if not exists invitations` above, same reasoning
-- as companies.status in Phase 2's own schema catch-up -- that CREATE TABLE
-- only ever runs once against a real project, so a column/constraint change
-- has to be a separate statement appended here, not a rewrite of the
-- original text.
alter table invitations add column failure_reason text;
alter table invitations drop constraint invitations_status_check;
alter table invitations add constraint invitations_status_check
  check (status in ('pending', 'accepted', 'expired', 'cancelled', 'delivery_failed'));
-- 14 -> 5 days, per the mockup's "Invitation Rules" panel copy
-- ("expires after five days"). Only affects new rows -- existing pending
-- invitations keep whatever expires_at they already have.
alter table invitations alter column expires_at set default (now() + interval '5 days');

insert into public.permissions (key, description, category) values
  ('invitations.list', 'List invitations across every company (staff module)', 'invitations')
on conflict (key) do nothing;

-- Cross-company read for the standalone Invitations page
-- (src/pages/accounts/invitations/InvitationsPage.tsx) -- every other
-- invitation RPC above is scoped to one company (reached from that
-- company's own Users tab); this is the first one that lists across all of
-- them, so it gets its own permission key rather than reusing
-- is_company_admin()'s per-company check.
create or replace function public.admin_list_invitations(p_company_id uuid default null, p_status text default null)
returns table (
  id uuid, company_id uuid, company_name text, email text, invitee_name text,
  role text, status text, failure_reason text,
  created_at timestamptz, expires_at timestamptz, accepted_at timestamptz
)
language sql security definer stable
set search_path = public
as $$
  select i.id, i.company_id, coalesce(c.trading_name, c.legal_name), i.email, i.invitee_name,
    i.role, i.status, i.failure_reason, i.created_at, i.expires_at, i.accepted_at
  from invitations i
  join companies c on c.id = i.company_id
  where public.has_permission('invitations.list')
    and (p_company_id is null or i.company_id = p_company_id)
    and (p_status is null or i.status = p_status)
  order by i.created_at desc;
$$;
revoke execute on function public.admin_list_invitations(uuid, text) from public, anon;
grant execute on function public.admin_list_invitations(uuid, text) to authenticated;

-- The metadata half of "fix the email and retry" for a delivery_failed
-- invitation -- resets status/failure_reason/expiry so the row looks like a
-- brand-new pending invite again. Same split as resend_company_invitation:
-- this RPC does the auth check + metadata reset, company-invite-member's
-- new "fixEmail" action calls it then does the half that needs the
-- service-role key (re-firing inviteUserByEmail at the corrected address).
-- is_company_admin()-gated (not invitations.list) -- fixing one company's
-- invitation is a per-company write, same as resend/cancel above, even
-- though the page it's reached from lists across companies.
create or replace function public.admin_fix_invitation_email(p_invitation_id uuid, p_new_email text) returns void
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
  if v_status <> 'delivery_failed' then raise exception 'Only a delivery-failed invitation can be fixed'; end if;
  if p_new_email is null or p_new_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address'; end if;

  update invitations set email = p_new_email, status = 'pending', failure_reason = null,
    expires_at = now() + interval '5 days'
    where id = p_invitation_id;
  perform public.log_audit(v_company, auth.uid(), 'invitation_fixed', null, null, jsonb_build_object('invitation_id', p_invitation_id, 'new_email', p_new_email));
end;
$$;
revoke execute on function public.admin_fix_invitation_email(uuid, text) from public, anon;
grant execute on function public.admin_fix_invitation_email(uuid, text) to authenticated;

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

-- admin_list_companies() itself lives further down (Phase 2's version reads
-- price_lists.name, so it's defined after the Pricing: Price List RPCs
-- section instead of here -- language sql function bodies are checked
-- against referenced-object existence at CREATE time, unlike plpgsql, so it
-- can't reference a table that doesn't exist yet this early in the script).

-- Assigns/detaches an EXISTING user to/from a company. p_company_id = null
-- detaches (soft, mirrors company_remove_member's effect) -- also doubles as
-- the general support tool for "move this user to a different company".
create or replace function public.admin_set_user_company(p_user_id uuid, p_company_id uuid, p_role text default null) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_permission('companies.set_user_company') then raise exception 'Not authorized'; end if;

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
  if not public.has_permission('companies.add_member_by_email') then raise exception 'Not authorized'; end if;
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
  if not public.has_permission('companies.set_staff_assignment') then raise exception 'Not authorized'; end if;
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
  if not public.has_permission('companies.remove_staff_assignment') then raise exception 'Not authorized'; end if;
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

-- has_permission('companies.list_staff_candidates')-gated (dynamic RBAC) -- the picker source for the
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
  where p.role = 'admin' and public.has_permission('companies.list_staff_candidates')
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

-- =============================================================================
-- Pricing: Price Lists
-- =============================================================================
-- Replaces panels/tracks/fixings/sealants.price_per_* (still present, now
-- deprecated as an editable field -- see AdminProductsPage.tsx) as the
-- source of truth for what a company pays. Every company is assigned
-- exactly one price_lists row; "PL1 - Standard" is seeded from today's
-- price_per_* values and marked is_default so a price gap on any other
-- list (a SKU added after a list was duplicated, say) still resolves to a
-- real price instead of silently going unpriced -- see
-- applyEffectivePricing() in src/export/applyEffectivePricing.ts.
-- =============================================================================
create table price_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  notes text,
  -- Nullable: the PL1 backfill below runs as part of schema application,
  -- before any admin profile necessarily exists (a fresh `supabase db
  -- reset`/CI bootstrap applies schema.sql before seed.sql creates
  -- profiles) -- attributing it to a real admin when one already exists
  -- (the live-project case) is still preferred, null is just the fallback.
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index price_lists_one_default on price_lists (is_default) where is_default;

alter table price_lists enable row level security;
-- "if exists" so this stays a no-op on a fresh `supabase db reset` (the
-- table doesn't exist yet at that point) while still being safe to
-- re-apply incrementally against an already-live project.
drop policy if exists "Staff can read price lists" on price_lists;
create policy "Staff can read price lists" on price_lists
  for select using (public.has_permission('price_lists.read'));
-- A non-staff customer needs to be able to look up the default list's id
-- client-side (to then read its price_list_prices rows for the fallback
-- merge, see applyEffectivePricing()) -- they otherwise have no visibility
-- into price_lists at all, so this can't ride on the staff policy above.
-- Only the row where is_default is exposed, never a negotiated list's
-- name/notes.
create policy "Default price list is readable by any authenticated user" on price_lists
  for select using (is_default);
-- No insert/update/delete policy -- all writes go through the admin_*
-- RPCs below.

-- One row per (list, product) across all four priceable categories -- a
-- single table (not four parallel ones) since admin_duplicate_price_list
-- needs one INSERT...SELECT across every priced product regardless of
-- category. Real per-category FKs (not one untyped polymorphic uuid) so
-- deleting a product cascades its price rows instead of orphaning them.
create table price_list_prices (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references price_lists (id) on delete cascade,
  category text not null check (category in ('panel', 'track', 'fixing', 'sealant')),
  panel_id uuid references panels (id) on delete cascade,
  track_id uuid references tracks (id) on delete cascade,
  fixing_id uuid references fixings (id) on delete cascade,
  sealant_id uuid references sealants (id) on delete cascade,
  price numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (category = 'panel'   and panel_id   is not null and track_id is null and fixing_id is null and sealant_id is null) or
    (category = 'track'   and track_id   is not null and panel_id is null and fixing_id is null and sealant_id is null) or
    (category = 'fixing'  and fixing_id  is not null and panel_id is null and track_id is null and sealant_id is null) or
    (category = 'sealant' and sealant_id is not null and panel_id is null and track_id is null and fixing_id is null)
  )
);
create unique index price_list_prices_unique on price_list_prices
  (price_list_id, category, coalesce(panel_id, track_id, fixing_id, sealant_id));

alter table price_list_prices enable row level security;
drop policy if exists "Staff can read price list prices" on price_list_prices;
create policy "Staff can read price list prices" on price_list_prices
  for select using (public.has_permission('price_list_prices.read'));
-- No insert/update/delete policy -- admin_* RPCs only.

-- Must exist before the "Company members can read their assigned list's
-- prices" policy below, which references companies.price_list_id --
-- creating a policy that reads a not-yet-existing column fails outright
-- (confirmed live: "column c.price_list_id does not exist"), it isn't
-- deferred/validated lazily like a foreign key constraint would be.
alter table companies add column price_list_id uuid references price_lists (id);

-- A customer needs to read the ONE list their own company is assigned to,
-- to price their own order preview client-side -- never leaks another
-- company's negotiated list. The default (PL1) list's prices are also
-- readable by any authenticated user, not just its own assigned
-- companies: applyEffectivePricing()'s confirmed "fall back to PL1" rule
-- needs every customer (regardless of which list THEY'RE on) to be able to
-- read PL1's rows client-side. This is no more permissive than before this
-- feature existed -- panels/tracks/fixings/sealants.price_per_* (PL1's own
-- backfill source) have always had a public `using (true)` read policy,
-- open even to anon.
create policy "Company members can read their assigned list's prices" on price_list_prices
  for select using (
    exists (
      select 1 from companies c join company_memberships cm on cm.company_id = c.id
      where c.price_list_id = price_list_prices.price_list_id
        and cm.user_id = auth.uid() and cm.status = 'active'
    )
    or exists (select 1 from price_lists pl where pl.id = price_list_prices.price_list_id and pl.is_default)
  );

-- Seed PL1 - Standard, backfill it from today's price_per_* columns, then
-- assign every existing company to it -- keeps every company priced
-- exactly as before this migration until an admin creates/assigns a
-- different list. created_by attributes the seed row to the earliest admin
-- account when one already exists (the live-project case); on a fresh
-- bootstrap with no profiles yet (local Docker/CI, schema.sql applies
-- before seed.sql), the subquery is null, which created_by now allows.
insert into price_lists (name, is_default, created_by)
  select 'PL1 - Standard', true, (select id from profiles where role = 'admin' order by created_at asc limit 1)
  where not exists (select 1 from price_lists where is_default);

insert into price_list_prices (price_list_id, category, panel_id, price)
  select (select id from price_lists where is_default), 'panel', id, price_per_panel
  from panels where price_per_panel is not null;
insert into price_list_prices (price_list_id, category, track_id, price)
  select (select id from price_lists where is_default), 'track', id, price_per_metre
  from tracks where price_per_metre is not null;
insert into price_list_prices (price_list_id, category, fixing_id, price)
  select (select id from price_lists where is_default), 'fixing', id, price_per_box
  from fixings where price_per_box is not null;
insert into price_list_prices (price_list_id, category, sealant_id, price)
  select (select id from price_lists where is_default), 'sealant', id, price_per_box
  from sealants where price_per_box is not null;

update companies set price_list_id = (select id from price_lists where is_default) where price_list_id is null;
alter table companies alter column price_list_id set not null;

-- Closes a real gap: "Owner or admin can update their own company" RLS
-- (is_company_admin()) passes for a customer's own company owner/admin,
-- not just staff -- a plain price_list_id column would let a customer
-- reassign their own price list. RLS can't express column-level checks;
-- a BEFORE UPDATE trigger can. auth.uid() still resolves to the real
-- calling user inside a security definer trigger (it reads the request
-- JWT, not the function owner), so has_staff_role() here correctly reflects
-- who actually issued the UPDATE, including from inside
-- admin_set_company_price_list() below.
create or replace function public.guard_company_price_list_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.price_list_id is distinct from old.price_list_id and not public.has_permission('price_lists.assign_to_company') then
    raise exception 'Not authorized to change price list assignment';
  end if;
  return new;
end;
$$;
create trigger guard_company_price_list_id before update on companies
  for each row execute function public.guard_company_price_list_id();

-- =============================================================================
-- Pricing: Price List RPCs (super_admin-gated, matching where Companies and
-- Products management already sit today -- both omitted from
-- adminSectionAccess.ts's SECTION_ROLES)
-- =============================================================================
create or replace function public.admin_list_price_lists()
returns table (id uuid, name text, is_default boolean, notes text, product_count bigint, company_count bigint, created_at timestamptz, updated_at timestamptz)
language sql security definer stable
set search_path = public
as $$
  select pl.id, pl.name, pl.is_default, pl.notes,
    (select count(*) from price_list_prices plp where plp.price_list_id = pl.id),
    (select count(*) from companies c where c.price_list_id = pl.id),
    pl.created_at, pl.updated_at
  from price_lists pl
  where public.has_permission('price_lists.list')
  order by pl.is_default desc, pl.name;
$$;
revoke execute on function public.admin_list_price_lists() from public, anon;
grant execute on function public.admin_list_price_lists() to authenticated;

-- Also creates the new list's initial version 1, status 'active' -- Phase 6
-- (Company Accounts & Pricing) versioning makes every price_lists row
-- require at least one version to have any prices at all. plpgsql (not sql)
-- so referencing price_list_versions here, defined further down the file,
-- is fine -- only checked against real object existence at CALL time, not
-- at this CREATE.
create or replace function public.admin_create_price_list(p_name text, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_permission('price_lists.create') then raise exception 'Not authorized'; end if;
  insert into price_lists (name, notes, created_by) values (p_name, p_notes, auth.uid()) returning id into v_id;
  insert into price_list_versions (price_list_id, version_number, status, effective_date, created_by, published_at, published_by)
    values (v_id, 1, 'active', current_date, auth.uid(), now(), auth.uid());
  return v_id;
end;
$$;
revoke execute on function public.admin_create_price_list(text, text) from public, anon;
grant execute on function public.admin_create_price_list(text, text) to authenticated;

create or replace function public.admin_rename_price_list(p_price_list_id uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('price_lists.rename') then raise exception 'Not authorized'; end if;
  update price_lists set name = p_name, updated_at = now() where id = p_price_list_id;
  if not found then raise exception 'Price list not found'; end if;
end;
$$;
revoke execute on function public.admin_rename_price_list(uuid, text) from public, anon;
grant execute on function public.admin_rename_price_list(uuid, text) to authenticated;

-- The entire "Duplicate Price List" backend -- one new price_lists row plus
-- a new version 1 (status 'active') plus one INSERT...SELECT across every
-- priced product on the source list's own CURRENT (active) version, no
-- loop. Phase 6 (Company Accounts & Pricing): duplicating copies today's
-- live prices, never a draft-in-progress on the source list.
create or replace function public.admin_duplicate_price_list(p_source_price_list_id uuid, p_new_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_version_id uuid; v_source_version_id uuid;
begin
  if not public.has_permission('price_lists.duplicate') then raise exception 'Not authorized'; end if;
  select id into v_source_version_id from price_list_versions where price_list_id = p_source_price_list_id and status = 'active';
  if v_source_version_id is null then raise exception 'Price list not found'; end if;
  insert into price_lists (name, notes, created_by)
    select p_new_name, notes, auth.uid() from price_lists where id = p_source_price_list_id
    returning id into v_id;
  if v_id is null then raise exception 'Price list not found'; end if;
  insert into price_list_versions (price_list_id, version_number, status, effective_date, created_by, published_at, published_by)
    values (v_id, 1, 'active', current_date, auth.uid(), now(), auth.uid())
    returning id into v_version_id;
  insert into price_list_prices (price_list_version_id, category, panel_id, track_id, fixing_id, sealant_id, price)
    select v_version_id, category, panel_id, track_id, fixing_id, sealant_id, price
    from price_list_prices where price_list_version_id = v_source_version_id;
  return v_id;
end;
$$;
revoke execute on function public.admin_duplicate_price_list(uuid, text) from public, anon;
grant execute on function public.admin_duplicate_price_list(uuid, text) to authenticated;

create or replace function public.admin_set_price_list_price(p_price_list_id uuid, p_category text, p_product_id uuid, p_price numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('price_lists.set_price') then raise exception 'Not authorized'; end if;
  if p_category not in ('panel', 'track', 'fixing', 'sealant') then raise exception 'Invalid category'; end if;
  insert into price_list_prices (price_list_id, category, panel_id, track_id, fixing_id, sealant_id, price)
  values (
    p_price_list_id, p_category,
    case when p_category = 'panel' then p_product_id end,
    case when p_category = 'track' then p_product_id end,
    case when p_category = 'fixing' then p_product_id end,
    case when p_category = 'sealant' then p_product_id end,
    p_price
  )
  on conflict (price_list_id, category, coalesce(panel_id, track_id, fixing_id, sealant_id))
  do update set price = excluded.price, updated_at = now();
end;
$$;
revoke execute on function public.admin_set_price_list_price(uuid, text, uuid, numeric) from public, anon;
grant execute on function public.admin_set_price_list_price(uuid, text, uuid, numeric) to authenticated;

create or replace function public.admin_delete_price_list_price(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('price_lists.delete_price') then raise exception 'Not authorized'; end if;
  delete from price_list_prices where id = p_id;
end;
$$;
revoke execute on function public.admin_delete_price_list_price(uuid) from public, anon;
grant execute on function public.admin_delete_price_list_price(uuid) to authenticated;

-- Pre-checks against deleting the default list or a list still assigned to
-- a company with a friendly message -- the FK on companies.price_list_id
-- would already block the latter with a raw constraint-violation, this
-- just keeps that error readable in the UI.
create or replace function public.admin_delete_price_list(p_price_list_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('price_lists.delete') then raise exception 'Not authorized'; end if;
  if exists (select 1 from price_lists where id = p_price_list_id and is_default) then
    raise exception 'Cannot delete the default price list';
  end if;
  if exists (select 1 from companies where price_list_id = p_price_list_id) then
    raise exception 'Cannot delete a price list that is still assigned to a company';
  end if;
  delete from price_lists where id = p_price_list_id;
  if not found then raise exception 'Price list not found'; end if;
end;
$$;
revoke execute on function public.admin_delete_price_list(uuid) from public, anon;
grant execute on function public.admin_delete_price_list(uuid) to authenticated;

create or replace function public.admin_set_company_price_list(p_company_id uuid, p_price_list_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('price_lists.assign_to_company') then raise exception 'Not authorized'; end if;
  update companies set price_list_id = p_price_list_id, updated_at = now() where id = p_company_id;
  if not found then raise exception 'Company not found'; end if;
end;
$$;
revoke execute on function public.admin_set_company_price_list(uuid, uuid) from public, anon;
grant execute on function public.admin_set_company_price_list(uuid, uuid) to authenticated;

-- Phase 2 (Company Accounts & Pricing): extended from the original 4-column
-- row (id/name/member_count/created_at, see "Admin (Speedpanel staff)
-- visibility into companies" above) to also carry every field
-- CompaniesListPage.tsx's table and CompanyOverviewPage.tsx's detail cards
-- need -- one shared row shape for both screens rather than a second
-- per-company RPC, since the company count here is small enough (internal
-- B2B customer list, not end-user scale) that returning the full row for
-- every company is cheap. Dropped and recreated (not `create or replace`)
-- since the return column list is growing, which `create or replace
-- function` can't do in place. Defined here (after price_lists exists)
-- rather than back at its original spot, since it reads price_lists.name --
-- language sql function bodies are checked against referenced-object
-- existence at CREATE time, unlike plpgsql.
drop function if exists public.admin_list_companies();

create or replace function public.admin_list_companies()
returns table (
  id uuid, name text, member_count bigint, created_at timestamptz,
  legal_name text, trading_name text, abn text, account_code text,
  billing_email text, phone text, address text, status text,
  payment_terms text, internal_notes text,
  price_list_id uuid, price_list_name text,
  primary_user_name text, primary_user_email text, internal_owner_name text
)
language sql security definer stable
set search_path = public
as $$
  select
    c.id, coalesce(c.trading_name, c.legal_name), count(cm.id) filter (where cm.status = 'active'), c.created_at,
    c.legal_name, c.trading_name, c.abn, c.customer_account_number,
    c.billing_email, c.phone, c.address, c.status,
    c.payment_terms, c.internal_notes,
    c.price_list_id, pl.name,
    owner.display_name_or_email, owner.email, creator.display_name_or_email
  from companies c
  left join company_memberships cm on cm.company_id = c.id
  left join price_lists pl on pl.id = c.price_list_id
  left join lateral (
    select coalesce(p.display_name, u.email) as display_name_or_email, u.email
    from company_memberships owner_cm
    join profiles p on p.id = owner_cm.user_id
    join auth.users u on u.id = owner_cm.user_id
    where owner_cm.company_id = c.id and owner_cm.role = 'owner' and owner_cm.status = 'active'
    limit 1
  ) owner on true
  left join lateral (
    select coalesce(p.display_name, u.email) as display_name_or_email
    from profiles p join auth.users u on u.id = p.id
    where p.id = c.created_by
  ) creator on true
  where public.has_permission('companies.list')
  group by c.id, c.trading_name, c.legal_name, c.created_at, c.abn, c.customer_account_number,
    c.billing_email, c.phone, c.address, c.status, c.payment_terms, c.internal_notes,
    c.price_list_id, pl.name, owner.display_name_or_email, owner.email, creator.display_name_or_email
  order by c.created_at desc;
$$;
revoke execute on function public.admin_list_companies() from public, anon;
grant execute on function public.admin_list_companies() to authenticated;

-- =============================================================================
-- Foreign key indexes -- pricing tables
-- =============================================================================
create index if not exists idx_price_list_prices_price_list_id on price_list_prices (price_list_id);
create index if not exists idx_price_list_prices_panel_id      on price_list_prices (panel_id);
create index if not exists idx_price_list_prices_track_id      on price_list_prices (track_id);
create index if not exists idx_price_list_prices_fixing_id     on price_list_prices (fixing_id);
create index if not exists idx_price_list_prices_sealant_id    on price_list_prices (sealant_id);
create index if not exists idx_companies_price_list_id         on companies (price_list_id);

-- =============================================================================
-- Pricing: Price List Versioning (Company Accounts & Pricing, Phase 6)
-- =============================================================================
-- Restructures price_list_prices from one flat, live-edited row set per
-- price_lists row into a versioned model: every price now belongs to a
-- price_list_versions row, exactly one of which is ever 'active' per
-- price_lists row at a time. companies.price_list_id keeps meaning the
-- LOGICAL list (unchanged by this migration) -- callers that need today's
-- real prices resolve through current_price_list_prices() below, which
-- always reads the active version.
--
-- This is a live-table migration, not a fresh CREATE TABLE -- schema.sql
-- has already run against a real project by the time this section exists,
-- so (matching this file's own established convention, e.g. the
-- company_addresses/invitations sections) every change here is additive
-- ALTER/new-CREATE, appended after price_list_prices' original definition
-- rather than edited into it.
-- =============================================================================
create table price_list_versions (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references price_lists (id) on delete cascade,
  version_number int not null,
  status text not null check (status in ('draft', 'scheduled', 'active', 'expired', 'archived')),
  effective_date date,
  notes text,
  -- Nullable for the same reason price_lists.created_by is: the version-1
  -- backfill below copies created_by straight from price_lists, and on a
  -- from-scratch bootstrap (a fresh `supabase db reset`/CI, schema applies
  -- before seed.sql creates any profile) that value is null. Attributing it
  -- to a real admin when one exists (the live-project case) is still
  -- preferred; null is just the bootstrap fallback.
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references auth.users (id),
  unique (price_list_id, version_number)
);
-- Enforces the "exactly one active version per list" invariant at the
-- database level, not just in RPC logic -- a partial unique index so
-- draft/scheduled/expired/archived rows are unconstrained.
create unique index price_list_versions_one_active on price_list_versions (price_list_id) where status = 'active';

alter table price_list_versions enable row level security;
drop policy if exists "Staff can read price list versions" on price_list_versions;
create policy "Staff can read price list versions" on price_list_versions
  for select using (public.has_permission('price_lists.read'));
-- current_price_list_prices() below is SECURITY INVOKER (deliberately, see
-- its own comment) and joins through this table, so a non-staff company
-- member needs read access to at least the active row to resolve their own
-- assigned list's current prices client-side -- mirrors "Default price list
-- is readable by any authenticated user" above. Only status/dates/version
-- numbers are exposed by this policy, never a draft's own price rows (those
-- stay gated by price_list_prices' own policy, rewritten below).
drop policy if exists "Active price list versions are readable by any authenticated user" on price_list_versions;
create policy "Active price list versions are readable by any authenticated user" on price_list_versions
  for select using (status = 'active');
-- No insert/update/delete policy -- admin_* RPCs only, same convention as
-- price_lists/price_list_prices above.

-- One version per existing price_lists row, seeded as version 1 / active /
-- effective today -- every company stays priced exactly as before this
-- migration.
insert into price_list_versions (price_list_id, version_number, status, effective_date, created_by, created_at, published_at, published_by)
  select id, 1, 'active', current_date, created_by, created_at, created_at, created_by
  from price_lists;

alter table price_list_prices add column price_list_version_id uuid references price_list_versions (id) on delete cascade;
update price_list_prices plp
  set price_list_version_id = plv.id
  from price_list_versions plv
  where plv.price_list_id = plp.price_list_id and plv.status = 'active';
alter table price_list_prices alter column price_list_version_id set not null;

-- Rewritten to join through price_list_version_id (price_list_id, the
-- column this policy used to reference, is being dropped a few statements
-- down) and to genuinely restrict to the active version only -- once drafts
-- exist, a company member must never be able to read a not-yet-published
-- draft's prices. Must run (and so must the column backfill above) BEFORE
-- price_list_id is dropped: this policy's old body depends on that column,
-- and Postgres won't let a column be dropped while a policy still
-- references it.
drop policy if exists "Company members can read their assigned list's prices" on price_list_prices;
create policy "Company members can read their assigned list's prices" on price_list_prices
  for select using (
    exists (
      select 1 from price_list_versions plv
      join companies c on c.price_list_id = plv.price_list_id
      join company_memberships cm on cm.company_id = c.id
      where plv.id = price_list_prices.price_list_version_id
        and plv.status = 'active'
        and cm.user_id = auth.uid() and cm.status = 'active'
    )
    or exists (
      select 1 from price_list_versions plv
      join price_lists pl on pl.id = plv.price_list_id
      where plv.id = price_list_prices.price_list_version_id
        and plv.status = 'active' and pl.is_default
    )
  );

-- price_list_id's own unique index and FK index are dropped along with the
-- column itself (Postgres drops a column's own dependent indexes
-- automatically, no explicit DROP INDEX/CASCADE needed) -- price_list_id
-- is superseded entirely by price_list_version_id from here on.
drop index if exists price_list_prices_unique;
drop index if exists idx_price_list_prices_price_list_id;
alter table price_list_prices drop column price_list_id;
create unique index price_list_prices_unique on price_list_prices
  (price_list_version_id, category, coalesce(panel_id, track_id, fixing_id, sealant_id));
create index if not exists idx_price_list_prices_price_list_version_id on price_list_prices (price_list_version_id);

-- Draft-only mutability: once a price_list_prices row's version is
-- 'active', its price can no longer be changed or removed in place --
-- publishing a new version (Phase 8) is the only way to change a live
-- price from here on. Fires on UPDATE/DELETE only, not INSERT: every INSERT
-- path into this table is already RPC-gated (RLS above grants "admin_* RPCs
-- only", no direct client insert policy exists at all) and the only RPCs
-- that insert into an ALREADY-existing version either create that version
-- as part of the same statement (admin_create_price_list/
-- admin_duplicate_price_list, populating a brand-new active version, not
-- mutating an existing one) or explicitly require status = 'draft' first
-- (admin_set_draft_price below) -- so guarding INSERT here would only block
-- that legitimate initial-population path, not add any real protection.
-- Placed here, after the data-migration UPDATE above (which itself targets
-- rows whose version is already 'active') and after price_list_version_id's
-- NOT NULL is set -- a trigger active any earlier would reject that very
-- backfill.
create or replace function public.guard_price_list_prices_immutable() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from price_list_versions where id = coalesce(new.price_list_version_id, old.price_list_version_id);
  if v_status = 'active' then
    raise exception 'Cannot modify prices on an active price list version -- create a draft first';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger guard_price_list_prices_immutable before update or delete on price_list_prices
  for each row execute function public.guard_price_list_prices_immutable();

-- publish/schedule seeded now (Phase 6) even though admin_publish_price_
-- list_version()/the scheduled-activation check land in Phase 8 -- same
-- "seed the permission key before its RPC exists" precedent this file's
-- nav (admin.section.*) keys already follow. Like every other price_lists.*
-- key, none of these three are granted to any staff role below -- only
-- super_admin/null-staff_role passes has_permission() for them, matching
-- price_lists.create/rename/etc.'s existing super-admin-only posture.
insert into public.permissions (key, description, category) values
  ('price_lists.create_draft', 'Create a draft version of a price list', 'price_lists'),
  ('price_lists.publish', 'Publish a price list version, making it the active one', 'price_lists'),
  ('price_lists.schedule', 'Schedule a future price list version to activate on its effective date', 'price_lists')
on conflict (key) do nothing;

-- SECURITY INVOKER -- deliberately the odd one out among this file's RPCs,
-- almost all of which are security definer. This reads through the CALLING
-- user's own RLS grants on price_list_prices/price_list_versions rather
-- than bypassing them, so a customer calling this can only ever see what
-- "Company members can read their assigned list's prices" and "Active
-- price list versions are readable by any authenticated user" above
-- already let them see directly -- there's no privilege-escalation surface
-- to guard with has_permission() here, unlike the admin_* RPCs below.
create or replace function public.current_price_list_prices(p_price_list_id uuid)
returns setof price_list_prices
language sql security invoker stable
set search_path = public
as $$
  select plp.* from price_list_prices plp
  join price_list_versions plv on plv.id = plp.price_list_version_id
  where plv.price_list_id = p_price_list_id and plv.status = 'active';
$$;
revoke execute on function public.current_price_list_prices(uuid) from public, anon;
grant execute on function public.current_price_list_prices(uuid) to authenticated;

-- Creates a new draft version, optionally seeded by copying an existing
-- version's prices (defaults to copying the list's current active version,
-- so an admin editing "in place" always starts from today's real prices).
-- Backs AdminPriceListsPage.tsx's Phase 6 stopgap: its existing edit-price
-- action auto-creates a draft via this RPC on first edit if the list has no
-- draft yet (see admin_set_draft_price below), rather than editing the
-- active version directly the way admin_set_price_list_price used to.
create or replace function public.admin_create_draft_version(p_price_list_id uuid, p_from_version_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_next_version int; v_source_version_id uuid;
begin
  if not public.has_permission('price_lists.create_draft') then raise exception 'Not authorized'; end if;
  select coalesce(max(version_number), 0) + 1 into v_next_version from price_list_versions where price_list_id = p_price_list_id;
  v_source_version_id := coalesce(p_from_version_id, (select id from price_list_versions where price_list_id = p_price_list_id and status = 'active'));
  insert into price_list_versions (price_list_id, version_number, status, created_by)
    values (p_price_list_id, v_next_version, 'draft', auth.uid())
    returning id into v_id;
  if v_source_version_id is not null then
    insert into price_list_prices (price_list_version_id, category, panel_id, track_id, fixing_id, sealant_id, price)
      select v_id, category, panel_id, track_id, fixing_id, sealant_id, price
      from price_list_prices where price_list_version_id = v_source_version_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.admin_create_draft_version(uuid, uuid) from public, anon;
grant execute on function public.admin_create_draft_version(uuid, uuid) to authenticated;

-- Replaces admin_set_price_list_price (dropped below) as the version-scoped
-- write path -- rejects a target version that isn't currently a draft
-- (defense in depth on top of the immutability trigger above, which would
-- reject the same write with a less specific error message).
create or replace function public.admin_set_draft_price(p_version_id uuid, p_category text, p_product_id uuid, p_price numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('price_lists.set_price') then raise exception 'Not authorized'; end if;
  if p_category not in ('panel', 'track', 'fixing', 'sealant') then raise exception 'Invalid category'; end if;
  if not exists (select 1 from price_list_versions where id = p_version_id and status = 'draft') then
    raise exception 'Prices can only be set on a draft version';
  end if;
  insert into price_list_prices (price_list_version_id, category, panel_id, track_id, fixing_id, sealant_id, price)
  values (
    p_version_id, p_category,
    case when p_category = 'panel' then p_product_id end,
    case when p_category = 'track' then p_product_id end,
    case when p_category = 'fixing' then p_product_id end,
    case when p_category = 'sealant' then p_product_id end,
    p_price
  )
  on conflict (price_list_version_id, category, coalesce(panel_id, track_id, fixing_id, sealant_id))
  do update set price = excluded.price, updated_at = now();
end;
$$;
revoke execute on function public.admin_set_draft_price(uuid, text, uuid, numeric) from public, anon;
grant execute on function public.admin_set_draft_price(uuid, text, uuid, numeric) to authenticated;

-- Not named in the Phase 6 plan doc (which only calls out
-- admin_set_draft_price as the write RPC to add) -- added because
-- admin_delete_price_list_price is being dropped outright as part of this
-- same cutover, and AdminPriceListsPage.tsx's existing "remove price"
-- action needs a version-scoped equivalent to keep working. Reuses the
-- existing price_lists.delete_price permission key, matching
-- admin_set_draft_price's reuse of price_lists.set_price above rather than
-- minting a key the plan doc doesn't call for.
create or replace function public.admin_delete_draft_price(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('price_lists.delete_price') then raise exception 'Not authorized'; end if;
  if not exists (
    select 1 from price_list_prices plp
    join price_list_versions plv on plv.id = plp.price_list_version_id
    where plp.id = p_id and plv.status = 'draft'
  ) then
    raise exception 'Prices can only be deleted from a draft version';
  end if;
  delete from price_list_prices where id = p_id;
end;
$$;
revoke execute on function public.admin_delete_draft_price(uuid) from public, anon;
grant execute on function public.admin_delete_draft_price(uuid) to authenticated;

-- Superseded by admin_set_draft_price/admin_delete_draft_price above --
-- both wrote directly into whatever version price_list_id logically meant,
-- which no longer exists now every price belongs to a specific version.
drop function if exists public.admin_set_price_list_price(uuid, text, uuid, numeric);
drop function if exists public.admin_delete_price_list_price(uuid);

-- Redefined (not edited in place at its original definition above) because
-- it's `language sql` -- checked against referenced-object existence at
-- CREATE time, unlike plpgsql, so it can't reference price_list_versions/
-- price_list_version_id until after both exist, i.e. here. Same
-- product_count/company_count shape as before; product_count now counts
-- only the list's current ACTIVE version's prices (a draft-in-progress
-- shouldn't inflate the count shown in the library table).
create or replace function public.admin_list_price_lists()
returns table (id uuid, name text, is_default boolean, notes text, product_count bigint, company_count bigint, created_at timestamptz, updated_at timestamptz)
language sql security definer stable
set search_path = public
as $$
  select pl.id, pl.name, pl.is_default, pl.notes,
    (select count(*) from price_list_prices plp
       join price_list_versions plv on plv.id = plp.price_list_version_id
       where plv.price_list_id = pl.id and plv.status = 'active'),
    (select count(*) from companies c where c.price_list_id = pl.id),
    pl.created_at, pl.updated_at
  from price_lists pl
  where public.has_permission('price_lists.list')
  order by pl.is_default desc, pl.name;
$$;
revoke execute on function public.admin_list_price_lists() from public, anon;
grant execute on function public.admin_list_price_lists() to authenticated;

-- =============================================================================
-- Pricing: Price Lists library + draft editor (Company Accounts & Pricing,
-- Phase 7) -- read-only RPCs backing the new src/pages/accounts/priceLists/
-- module. Both reuse the existing price_lists.read permission key rather
-- than minting new ones -- everything they return is metadata/diff
-- information staff with read access to the price-list catalog already see
-- elsewhere (AdminPriceListsPage.tsx, admin_list_price_lists()).
-- =============================================================================

-- p_price_list_id null returns every version across every list (the
-- library's Draft Versions/Scheduled/Archived tabs, which are cross-list);
-- given a specific id it scopes to that one list's own version history
-- (the draft editor's own use). created_by_name/published_by_name mirror
-- admin_list_companies()'s own display_name-or-email lateral join pattern.
create or replace function public.admin_list_price_list_versions(p_price_list_id uuid default null)
returns table (
  id uuid, price_list_id uuid, price_list_name text, version_number int, status text,
  effective_date date, notes text, created_by uuid, created_by_name text, created_at timestamptz,
  published_at timestamptz, published_by uuid, published_by_name text, price_count bigint
)
language sql security definer stable
set search_path = public
as $$
  select
    plv.id, plv.price_list_id, pl.name, plv.version_number, plv.status,
    plv.effective_date, plv.notes, plv.created_by, creator.display_name_or_email, plv.created_at,
    plv.published_at, plv.published_by, publisher.display_name_or_email,
    (select count(*) from price_list_prices plp where plp.price_list_version_id = plv.id)
  from price_list_versions plv
  join price_lists pl on pl.id = plv.price_list_id
  left join lateral (
    select coalesce(p.display_name, u.email) as display_name_or_email
    from profiles p join auth.users u on u.id = p.id where p.id = plv.created_by
  ) creator on true
  left join lateral (
    select coalesce(p.display_name, u.email) as display_name_or_email
    from profiles p join auth.users u on u.id = p.id where p.id = plv.published_by
  ) publisher on true
  where public.has_permission('price_lists.read')
    and (p_price_list_id is null or plv.price_list_id = p_price_list_id)
  order by pl.name, plv.version_number desc;
$$;
revoke execute on function public.admin_list_price_list_versions(uuid) from public, anon;
grant execute on function public.admin_list_price_list_versions(uuid) to authenticated;

-- Per-product old/new price + change type between two versions (typically
-- the current active version and a draft) -- built once here, reused as-is
-- by Phase 8's Compare & Publish screen per the plan. A full outer join on
-- (category, the one non-null panel/track/fixing/sealant id) rather than a
-- plain id join, since the same product's row has a different id in every
-- version (price_list_prices.id isn't stable across versions -- each
-- version's rows are its own copy, see admin_create_draft_version()).
-- Labels aren't resolved here -- the frontend already holds the full
-- product catalog client-side (useProductStore()) and can look up
-- category+product_id against it directly (see itemTitle() in
-- productCategoryViews.tsx), so this stays a thin numeric diff.
create or replace function public.admin_diff_price_list_versions(p_from_version_id uuid, p_to_version_id uuid)
returns table (
  category text, panel_id uuid, track_id uuid, fixing_id uuid, sealant_id uuid,
  old_price numeric, new_price numeric, change_type text
)
language sql security definer stable
set search_path = public
as $$
  select
    coalesce(new_v.category, old_v.category),
    coalesce(new_v.panel_id, old_v.panel_id), coalesce(new_v.track_id, old_v.track_id),
    coalesce(new_v.fixing_id, old_v.fixing_id), coalesce(new_v.sealant_id, old_v.sealant_id),
    old_v.price, new_v.price,
    case
      when old_v.price is null then 'added'
      when new_v.price is null then 'removed'
      when old_v.price is distinct from new_v.price then 'changed'
      else 'unchanged'
    end
  from
    (select * from price_list_prices where price_list_version_id = p_to_version_id) new_v
    full outer join
    (select * from price_list_prices where price_list_version_id = p_from_version_id) old_v
    on new_v.category = old_v.category
    and coalesce(new_v.panel_id, new_v.track_id, new_v.fixing_id, new_v.sealant_id)
      = coalesce(old_v.panel_id, old_v.track_id, old_v.fixing_id, old_v.sealant_id)
  where public.has_permission('price_lists.read');
$$;
revoke execute on function public.admin_diff_price_list_versions(uuid, uuid) from public, anon;
grant execute on function public.admin_diff_price_list_versions(uuid, uuid) to authenticated;

-- =============================================================================
-- Pricing: Compare & Publish (Company Accounts & Pricing, Phase 8)
-- =============================================================================
-- admin_publish_price_list_version() below is the one real write RPC this
-- phase adds; everything else here is the "lazy on-read check" scheduled-
-- activation mechanism the Phase 6 plan flagged as a from-scratch design
-- call, not a convention to follow -- no pg_cron, no background job. A
-- future-dated publish sets a version to 'scheduled' and otherwise leaves
-- the current 'active' version alone (see the RPC's own comment for why);
-- current_price_list_version_id() below is what "resolves" a scheduled
-- version into the effective current one once its effective_date arrives,
-- used everywhere a caller needs pricing to be genuinely correct
-- (current_price_list_prices()). Deliberately NOT threaded into
-- admin_list_price_lists()'s product_count or
-- admin_list_price_list_versions()'s status column -- those keep showing
-- the literal stored status ('scheduled' stays 'scheduled' in the admin UI
-- even once its date has passed) rather than duplicating this resolution
-- logic into every display path; only customer-facing pricing needs to be
-- lazily correct, not every admin list/count.
-- =============================================================================

-- Both RLS policies below are the SAME ones Phase 6 wrote (drop+recreate
-- again here, same "append a new section rather than edit into place"
-- convention already established for this file's live tables) --
-- extended with an OR clause admitting a 'scheduled' version whose
-- effective_date has already arrived, alongside the existing literal
-- 'active' check.
drop policy if exists "Active price list versions are readable by any authenticated user" on price_list_versions;
create policy "Active price list versions are readable by any authenticated user" on price_list_versions
  for select using (status = 'active' or (status = 'scheduled' and effective_date <= current_date));

drop policy if exists "Company members can read their assigned list's prices" on price_list_prices;
create policy "Company members can read their assigned list's prices" on price_list_prices
  for select using (
    exists (
      select 1 from price_list_versions plv
      join companies c on c.price_list_id = plv.price_list_id
      join company_memberships cm on cm.company_id = c.id
      where plv.id = price_list_prices.price_list_version_id
        and (plv.status = 'active' or (plv.status = 'scheduled' and plv.effective_date <= current_date))
        and cm.user_id = auth.uid() and cm.status = 'active'
    )
    or exists (
      select 1 from price_list_versions plv
      join price_lists pl on pl.id = plv.price_list_id
      where plv.id = price_list_prices.price_list_version_id
        and (plv.status = 'active' or (plv.status = 'scheduled' and plv.effective_date <= current_date))
        and pl.is_default
    )
  );

-- Resolves "the one version currently in effect" for a price list --
-- literally 'active', or if none, the most recent 'scheduled' version
-- whose effective_date has arrived. A plain OR filter (matching both RLS
-- policies above) could return two candidate rows at once during the
-- window after a scheduled version's date passes but before anything
-- re-publishes it (the outgoing active version is deliberately left alone
-- at schedule time, see admin_publish_price_list_version()) -- this
-- resolves that down to exactly one, deterministically preferring the
-- due-scheduled version over a stale literal-active one, so
-- current_price_list_prices() below never blends two versions' prices
-- together. SECURITY INVOKER, same reasoning as current_price_list_prices()
-- itself -- relies on the caller's own RLS on price_list_versions (both
-- policies above), not a privilege-escalation path.
create or replace function public.current_price_list_version_id(p_price_list_id uuid) returns uuid
language sql security invoker stable
set search_path = public
as $$
  select id from price_list_versions
  where price_list_id = p_price_list_id
    and (status = 'active' or (status = 'scheduled' and effective_date <= current_date))
  order by (status = 'scheduled') desc, effective_date desc nulls last, version_number desc
  limit 1;
$$;
revoke execute on function public.current_price_list_version_id(uuid) from public, anon;
grant execute on function public.current_price_list_version_id(uuid) to authenticated;

-- Redefined (not the Phase 6 definition edited in place) for the same
-- `language sql`-checked-at-CREATE-time reason every other redefinition in
-- this file follows -- current_price_list_version_id() above must exist
-- first. Behavior is identical for every list with a literal active
-- version and no due-scheduled one (the overwhelming common case); only
-- changes for a list with a scheduled version whose date has passed.
create or replace function public.current_price_list_prices(p_price_list_id uuid)
returns setof price_list_prices
language sql security invoker stable
set search_path = public
as $$
  select plp.* from price_list_prices plp
  where plp.price_list_version_id = public.current_price_list_version_id(p_price_list_id);
$$;
revoke execute on function public.current_price_list_prices(uuid) from public, anon;
grant execute on function public.current_price_list_prices(uuid) to authenticated;

-- Publishes a draft: reuses the existing price_lists.publish permission key
-- seeded (unused) back in Phase 6. p_effective_date null or <= today means
-- publish immediately (the outgoing active version -- if any -- is expired
-- FIRST, then the target activated second: the price_list_versions_one_active
-- partial unique index isn't deferrable, so activating the new version
-- before expiring the old one would momentarily violate it -- 1 active -> 0
-- -> 1, never 1 -> 2). A future p_effective_date instead leaves the
-- current active version alone entirely and marks the target 'scheduled' --
-- current_price_list_version_id() above is what makes it start resolving
-- as "the" active version once that date arrives, with no further write
-- needed here or anywhere else (no cron job).
--
-- "No concurrent publish in flight": rejects outright if this list already
-- has a pending 'scheduled' version, regardless of whether the new publish
-- is itself immediate or another future date -- keeps at most one pending
-- future activation per list at a time, so there's never ambiguity about
-- which of two scheduled versions should win.
--
-- Audit: log_audit() is inherently per-company (it silently no-ops on a
-- null company_id), and a price list isn't itself scoped to one company --
-- so this logs one price_list_version_published row per company currently
-- assigned to the list (their own Activity Log is exactly where "your
-- price list changed" belongs), rather than skipping audit logging
-- entirely or reworking log_audit's shape. A list with zero assigned
-- companies (e.g. a brand new one) logs nothing, same as log_audit's own
-- existing "nothing to attribute this to" precedent elsewhere.
create or replace function public.admin_publish_price_list_version(p_version_id uuid, p_effective_date date default null, p_approval_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_price_list_id uuid;
  v_version_number int;
  v_effective date := coalesce(p_effective_date, current_date);
  v_company record;
begin
  if not public.has_permission('price_lists.publish') then raise exception 'Not authorized'; end if;

  select price_list_id, version_number into v_price_list_id, v_version_number
    from price_list_versions where id = p_version_id and status = 'draft';
  if v_price_list_id is null then raise exception 'Only a draft version can be published'; end if;

  if exists (select 1 from price_list_versions where price_list_id = v_price_list_id and status = 'scheduled') then
    raise exception 'This price list already has a scheduled publish pending -- resolve it before publishing another';
  end if;

  if v_effective <= current_date then
    update price_list_versions set status = 'expired' where price_list_id = v_price_list_id and status = 'active';
    update price_list_versions set status = 'active', effective_date = v_effective, published_at = now(), published_by = auth.uid()
      where id = p_version_id;
  else
    update price_list_versions set status = 'scheduled', effective_date = v_effective, published_at = now(), published_by = auth.uid()
      where id = p_version_id;
  end if;

  for v_company in select id from companies where price_list_id = v_price_list_id loop
    perform public.log_audit(v_company.id, auth.uid(), 'price_list_version_published', null, null,
      jsonb_build_object(
        'price_list_id', v_price_list_id, 'version_id', p_version_id, 'version_number', v_version_number,
        'effective_date', v_effective, 'immediate', v_effective <= current_date, 'approval_note', p_approval_note
      ));
  end loop;
end;
$$;
revoke execute on function public.admin_publish_price_list_version(uuid, date, text) from public, anon;
grant execute on function public.admin_publish_price_list_version(uuid, date, text) to authenticated;

-- =============================================================================
-- Company Price Overrides -- Method 2 pricing (Company Accounts & Pricing,
-- Phase 9)
-- =============================================================================
-- The 3rd, highest-priority pricing tier applyEffectivePricing() resolves
-- (src/export/applyEffectivePricing.ts): override > assigned price list's
-- active version > default (PL1) list > the deprecated price_per_* column.
-- Active/Scheduled/Expired is derived from effective_date/expiry_date at
-- read time, never stored -- only genuinely stateful lifecycles like
-- price_list_versions.status get an explicit column (matches the mockup's
-- own description of this screen).
-- =============================================================================
create table company_price_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  category text not null check (category in ('panel', 'track', 'fixing', 'sealant')),
  panel_id uuid references panels (id) on delete cascade,
  track_id uuid references tracks (id) on delete cascade,
  fixing_id uuid references fixings (id) on delete cascade,
  sealant_id uuid references sealants (id) on delete cascade,
  override_price numeric not null,
  effective_date date not null default current_date,
  expiry_date date,
  -- Internal-only (see the column-level grant below, same technique
  -- order_deliveries.internal_note already established) -- why this
  -- customer got a special price is staff-facing context, never shown to
  -- the customer themselves.
  internal_reason text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- Audit-only metadata, not a second workflow state (confirmed against the
  -- spec/mockup: override status shown is only Active/Scheduled/Expired,
  -- derived from dates -- there's no separate pending-approval gate here).
  -- Set at creation/edit time by whoever has company_price_overrides.write,
  -- same as created_by.
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  check (
    (category = 'panel'   and panel_id   is not null and track_id is null and fixing_id is null and sealant_id is null) or
    (category = 'track'   and track_id   is not null and panel_id is null and fixing_id is null and sealant_id is null) or
    (category = 'fixing'  and fixing_id  is not null and panel_id is null and track_id is null and sealant_id is null) or
    (category = 'sealant' and sealant_id is not null and panel_id is null and track_id is null and fixing_id is null)
  ),
  check (expiry_date is null or expiry_date >= effective_date)
);
create index idx_company_price_overrides_company_id on company_price_overrides (company_id);
create index idx_company_price_overrides_panel_id    on company_price_overrides (panel_id);
create index idx_company_price_overrides_track_id    on company_price_overrides (track_id);
create index idx_company_price_overrides_fixing_id   on company_price_overrides (fixing_id);
create index idx_company_price_overrides_sealant_id  on company_price_overrides (sealant_id);

-- The plan's own sketch called for a partial unique index scoped to
-- "currently relevant" rows (`where expiry_date is null or expiry_date >=
-- current_date`) -- confirmed directly against a real Postgres that this
-- fails outright ("functions in index predicate must be marked IMMUTABLE"):
-- current_date is stable, not immutable, and index predicates require the
-- latter. A BEFORE trigger has no such restriction (same reasoning
-- guard_price_list_prices_immutable/guard_order_delivery_allocation already
-- rely on triggers for date/status-sensitive checks a plain constraint
-- can't express) and gives the same "at most one current-or-upcoming
-- override per product" invariant. admin_set_company_price_override()
-- below upserts the existing row instead of inserting a second one, so
-- this trigger is defense-in-depth against that RPC's own logic, not the
-- primary mechanism -- same relationship the immutability trigger has to
-- admin_set_draft_price()'s own draft-only pre-check.
create or replace function public.guard_company_price_overrides_no_overlap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from company_price_overrides o
    where o.company_id = new.company_id and o.category = new.category
      and coalesce(o.panel_id, o.track_id, o.fixing_id, o.sealant_id) = coalesce(new.panel_id, new.track_id, new.fixing_id, new.sealant_id)
      and o.id <> new.id
      and (o.expiry_date is null or o.expiry_date >= current_date)
  ) then
    raise exception 'This company already has a current or upcoming override for this product -- edit or remove it first';
  end if;
  return new;
end;
$$;
create trigger guard_company_price_overrides_no_overlap before insert or update on company_price_overrides
  for each row execute function public.guard_company_price_overrides_no_overlap();

alter table company_price_overrides enable row level security;

create policy "Staff can read company price overrides" on company_price_overrides
  for select using (public.has_permission('company_price_overrides.read'));

-- A customer needs to read their OWN company's CURRENTLY active overrides
-- (never a future-scheduled or already-expired one) so client-side order
-- pricing (applyEffectivePricing(), via current_company_price_overrides()
-- below) can apply them without a staff-only RPC in the loop -- same
-- "assigned list's active version, not everything" scoping
-- "Company members can read their assigned list's prices" already
-- establishes for price_list_prices.
create policy "Company members can read their company's active overrides" on company_price_overrides
  for select using (
    exists (select 1 from company_memberships cm where cm.company_id = company_price_overrides.company_id and cm.user_id = auth.uid() and cm.status = 'active')
    and effective_date <= current_date
    and (expiry_date is null or expiry_date >= current_date)
  );
-- No insert/update/delete policy -- admin_* RPCs only, same convention as
-- price_lists/price_list_prices.

-- internal_reason (and created_by/approved_by/approved_at, staff-only
-- audit metadata) excluded from the authenticated column grant -- same
-- technique order_deliveries.internal_note already uses. Doesn't affect
-- company_list_price_overrides() below (security definer, reads as the
-- table owner, bypassing this column restriction the same way it bypasses
-- RLS) -- only a direct table read (a customer's own RLS-visible row, or
-- current_company_price_overrides()'s invoker-security select) is narrowed.
revoke select on company_price_overrides from authenticated;
grant select (id, company_id, category, panel_id, track_id, fixing_id, sealant_id, override_price, effective_date, expiry_date)
  on company_price_overrides to authenticated;

insert into public.permissions (key, description, category) values
  ('company_price_overrides.read', 'Read a company''s item price overrides (staff module)', 'companies'),
  ('company_price_overrides.write', 'Create/edit/delete a company''s item price overrides (staff module)', 'companies')
on conflict (key) do nothing;

-- SECURITY INVOKER -- same reasoning as current_price_list_prices(): reads
-- through the CALLING user's own RLS grants above rather than bypassing
-- them, and its own column list already excludes internal_reason/
-- created_by/approved_by/approved_at (redundant with the column-level
-- grant above, but explicit here since this is the one function customer
-- pricing code actually calls).
create or replace function public.current_company_price_overrides(p_company_id uuid)
returns table (
  id uuid, category text, panel_id uuid, track_id uuid, fixing_id uuid, sealant_id uuid,
  override_price numeric, effective_date date, expiry_date date
)
language sql security invoker stable
set search_path = public
as $$
  select id, category, panel_id, track_id, fixing_id, sealant_id, override_price, effective_date, expiry_date
  from company_price_overrides
  where company_id = p_company_id
    and effective_date <= current_date
    and (expiry_date is null or expiry_date >= current_date);
$$;
revoke execute on function public.current_company_price_overrides(uuid) from public, anon;
grant execute on function public.current_company_price_overrides(uuid) to authenticated;

-- Staff-side read -- every override regardless of active/scheduled/expired
-- status (the admin table shows full history), all columns including
-- internal_reason/approver -- same display-name-or-email lateral-join
-- pattern admin_list_companies()/admin_list_price_list_versions() already
-- use.
create or replace function public.company_list_price_overrides(p_company_id uuid)
returns table (
  id uuid, category text, panel_id uuid, track_id uuid, fixing_id uuid, sealant_id uuid,
  override_price numeric, effective_date date, expiry_date date, internal_reason text,
  created_by uuid, created_by_name text, created_at timestamptz,
  approved_by uuid, approved_by_name text, approved_at timestamptz
)
language sql security definer stable
set search_path = public
as $$
  select
    o.id, o.category, o.panel_id, o.track_id, o.fixing_id, o.sealant_id,
    o.override_price, o.effective_date, o.expiry_date, o.internal_reason,
    o.created_by, creator.display_name_or_email, o.created_at,
    o.approved_by, approver.display_name_or_email, o.approved_at
  from company_price_overrides o
  left join lateral (
    select coalesce(p.display_name, u.email) as display_name_or_email
    from profiles p join auth.users u on u.id = p.id where p.id = o.created_by
  ) creator on true
  left join lateral (
    select coalesce(p.display_name, u.email) as display_name_or_email
    from profiles p join auth.users u on u.id = p.id where p.id = o.approved_by
  ) approver on true
  where o.company_id = p_company_id and public.has_permission('company_price_overrides.read')
  order by o.created_at desc;
$$;
revoke execute on function public.company_list_price_overrides(uuid) from public, anon;
grant execute on function public.company_list_price_overrides(uuid) to authenticated;

-- Upsert -- reuses an existing current-or-upcoming override for the same
-- product if one exists (matching the no-overlap trigger's own definition
-- of "conflicting"), otherwise creates a new one. approved_by/approved_at
-- are audit-only metadata (see the table's own comment) set to whoever
-- calls this, not a separate approval step.
create or replace function public.admin_set_company_price_override(
  p_company_id uuid, p_category text, p_product_id uuid, p_override_price numeric,
  p_effective_date date default current_date, p_expiry_date date default null, p_internal_reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_event text;
begin
  if not public.has_permission('company_price_overrides.write') then raise exception 'Not authorized'; end if;
  if p_category not in ('panel', 'track', 'fixing', 'sealant') then raise exception 'Invalid category'; end if;
  if p_expiry_date is not null and p_expiry_date < p_effective_date then raise exception 'Expiry date can''t be before the effective date'; end if;

  select id into v_id from company_price_overrides
    where company_id = p_company_id and category = p_category
      and coalesce(panel_id, track_id, fixing_id, sealant_id) = p_product_id
      and (expiry_date is null or expiry_date >= current_date);

  if v_id is null then
    insert into company_price_overrides (
      company_id, category, panel_id, track_id, fixing_id, sealant_id,
      override_price, effective_date, expiry_date, internal_reason, created_by, approved_by, approved_at
    ) values (
      p_company_id, p_category,
      case when p_category = 'panel' then p_product_id end,
      case when p_category = 'track' then p_product_id end,
      case when p_category = 'fixing' then p_product_id end,
      case when p_category = 'sealant' then p_product_id end,
      p_override_price, p_effective_date, p_expiry_date, nullif(trim(p_internal_reason), ''), auth.uid(), auth.uid(), now()
    ) returning id into v_id;
    v_event := 'item_override_added';
  else
    update company_price_overrides set
      override_price = p_override_price, effective_date = p_effective_date, expiry_date = p_expiry_date,
      internal_reason = nullif(trim(p_internal_reason), ''), approved_by = auth.uid(), approved_at = now()
      where id = v_id;
    v_event := 'item_override_changed';
  end if;

  perform public.log_audit(p_company_id, auth.uid(), v_event, null, null,
    jsonb_build_object('override_id', v_id, 'category', p_category, 'override_price', p_override_price));
  return v_id;
end;
$$;
revoke execute on function public.admin_set_company_price_override(uuid, text, uuid, numeric, date, date, text) from public, anon;
grant execute on function public.admin_set_company_price_override(uuid, text, uuid, numeric, date, date, text) to authenticated;

create or replace function public.admin_delete_company_price_override(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_company_id uuid;
begin
  if not public.has_permission('company_price_overrides.write') then raise exception 'Not authorized'; end if;
  delete from company_price_overrides where id = p_id returning company_id into v_company_id;
  if v_company_id is null then raise exception 'Override not found'; end if;
  perform public.log_audit(v_company_id, auth.uid(), 'item_override_removed', null, null, jsonb_build_object('override_id', p_id));
end;
$$;
revoke execute on function public.admin_delete_company_price_override(uuid) from public, anon;
grant execute on function public.admin_delete_company_price_override(uuid) to authenticated;

-- =============================================================================
-- Delivery request/approval workflow
-- =============================================================================
-- Replaces order_deliveries' original "committed on insert, draft-only"
-- model with a request/negotiation workflow: a customer submits a delivery
-- request against an already-submitted order, and Internal Sales or Dispatch
-- accept the requested date, propose an alternative, decline it, or split
-- the order into additional delivery batches. approval_status governs this
-- request/negotiation phase; the existing fulfillment `status` column
-- (planned/scheduled/in_transit/delivered, set via
-- admin_update_delivery_status above) continues to govern post-confirmation
-- dispatch tracking -- the two columns are independent and neither
-- constrains the other server-side.
-- =============================================================================

-- Pure rename -- this column has always meant "client-authored delivery
-- instructions"; the new columns below just make that explicit alongside it.
alter table order_deliveries rename column notes to delivery_instructions;

-- New client-submitted free-text fields, one column each (not normalized --
-- matches this schema's existing posture for business free text, e.g.
-- orders.customer_note).
alter table order_deliveries add column preferred_window text;
alter table order_deliveries add column site_access_details text;

-- Staff-authored notes: internal_note is never customer-readable (see the
-- column-privilege revoke below); customer_note is staff-written but
-- customer-visible, the same internal-vs-customer split orders.customer_note
-- already establishes at the order level.
alter table order_deliveries add column internal_note text;
alter table order_deliveries add column customer_note text;

-- New date columns -- requested_date (existing) stays client-authored.
-- actual_date has no writer yet (a future admin_update_delivery_status
-- extension); the column exists now so it's available without a further
-- migration once that's built.
alter table order_deliveries add column proposed_date date;
alter table order_deliveries add column confirmed_date date;
alter table order_deliveries add column actual_date date;

-- Approval-status enum -- see header comment above for why this is separate
-- from `status`.
alter table order_deliveries add column approval_status text not null default 'draft'
  check (approval_status in ('draft', 'pending', 'accepted', 'date_proposed', 'declined'));

-- Backfill: every pre-existing row was fully committed on insert under the
-- old model -- map it onto the new enum's terminal "already agreed" state
-- instead of leaving it stuck at the new default 'draft'.
update order_deliveries set approval_status = 'accepted', confirmed_date = requested_date;

-- Hardening: sequence_no had no uniqueness constraint under the old
-- single-delivery-per-order-in-practice model; staff-side splitting
-- concurrently with customer inserts makes a genuine duplicate possible now
-- that multiple deliveries per order is an actively-used path.
alter table order_deliveries add constraint order_deliveries_order_id_sequence_no_key unique (order_id, sequence_no);

-- Column-level protection for internal_note -- RLS is row-level only, can't
-- discriminate columns within a row. A column-specific "revoke select
-- (internal_note) ... from authenticated" alone does NOT work here: Supabase
-- grants authenticated a blanket TABLE-level SELECT on every table by
-- default, and a table-level grant implies SELECT on all columns regardless
-- of a column-specific revoke (confirmed against the live project -- the
-- column stayed readable until the table-level grant itself was revoked).
-- So the table-level SELECT grant must be revoked and replaced with an
-- explicit column-level SELECT grant naming every column except
-- internal_note. Composes with the existing security-definer-bypasses-
-- grants pattern admin_list_stage_events already uses to read auth.users (a
-- table `authenticated` has zero grants on at all) -- same mechanism here:
-- no session can read internal_note through a plain
-- `.from("order_deliveries").select(...)` call after this; the only read
-- path is admin_list_delivery_requests() below.
revoke select on order_deliveries from authenticated;
grant select (
  id, order_id, sequence_no, address_line1, address_line2, suburb, state, postcode, requested_date,
  contact_name, contact_phone, delivery_instructions, item_allocations, created_at, updated_at, status,
  preferred_window, site_access_details, customer_note, proposed_date, confirmed_date, actual_date, approval_status
) on order_deliveries to authenticated;

-- Replaces the single "draft-only" blanket policy with three, split by
-- operation so each can express a different rule.
drop policy "Editors can manage deliveries while draft, admins anytime" on order_deliveries;

-- INSERT: a customer creates a delivery REQUEST once the order has left
-- draft (nothing to request delivery of before submission) and hasn't been
-- cancelled. Always inserted as 'pending' -- WITH CHECK blocks a customer
-- from insert-forging 'accepted'/'date_proposed'/'declined' directly.
create policy "Editors can create delivery requests on submitted orders, admins anytime" on order_deliveries
  for insert with check (
    (
      exists (
        select 1 from orders o where o.id = order_id
          and o.stage in ('submitted', 'proforma_requested', 'proforma_issued')
          and public.can_edit_project(o.owner_id, o.company_id, o.project_id)
      )
      and approval_status = 'pending'
    )
    or public.is_admin()
  );

-- UPDATE: a customer can edit their own request's fields while it's still
-- open for negotiation (pending, or date_proposed -- they can revise
-- address/contact/instructions while considering a proposed date). Once
-- approval_status = 'accepted' the row is locked from direct customer
-- writes -- the only path from there is request_delivery_date_change()
-- below, not a raw UPDATE. WITH CHECK re-asserts approval_status stays in
-- {'pending','date_proposed'}, so this can't be used to self-approve or
-- self-decline.
create policy "Editors can edit pending delivery requests, admins anytime" on order_deliveries
  for update using (
    (approval_status in ('pending', 'date_proposed')
      and exists (select 1 from orders o where o.id = order_id and public.can_edit_project(o.owner_id, o.company_id, o.project_id)))
    or public.is_admin()
  )
  with check (
    (approval_status in ('pending', 'date_proposed')
      and exists (select 1 from orders o where o.id = order_id and public.can_edit_project(o.owner_id, o.company_id, o.project_id)))
    or public.is_admin()
  );

-- DELETE: a customer can withdraw their own not-yet-reviewed request;
-- admin anytime.
create policy "Editors can delete pending delivery requests, admins anytime" on order_deliveries
  for delete using (
    (approval_status = 'pending'
      and exists (select 1 from orders o where o.id = order_id and public.can_edit_project(o.owner_id, o.company_id, o.project_id)))
    or public.is_admin()
  );

-- Staff review actions below are gated to Internal Sales or Dispatch
-- specifically (has_permission(), per-RPC delivery.* keys), same
-- narrowing pattern already used by admin_update_manufacturing/
-- admin_update_delivery_status above: RLS stays admin-broad (the blanket
-- public.is_admin() clause on every policy above already lets any admin
-- write any column), these RPCs are what actually restrict it to the two
-- intended roles.

-- Accepts whatever date the customer most recently requested. Valid from
-- 'pending'/'date_proposed' (staff can accept the original ask even after
-- having proposed an alternative) or 'draft' (a staff-created split row can
-- be accepted directly without a separate propose step).
create or replace function public.accept_delivery_date(p_delivery_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
  v_requested date;
begin
  if not public.has_permission('delivery.accept_date') then raise exception 'Not authorized'; end if;
  select approval_status, requested_date into v_status, v_requested from order_deliveries where id = p_delivery_id for update;
  if v_status is null then raise exception 'Delivery not found'; end if;
  if v_status not in ('pending', 'date_proposed', 'draft') then raise exception 'Delivery is not awaiting a date decision'; end if;
  update order_deliveries set approval_status = 'accepted', confirmed_date = v_requested, updated_at = now() where id = p_delivery_id;
end;
$$;
revoke execute on function public.accept_delivery_date(uuid) from public, anon;
grant execute on function public.accept_delivery_date(uuid) to authenticated;

-- Offers an alternative date -- confirmed_date is NOT set here; it's only
-- set once accept_delivery_date() or the customer's own
-- accept_proposed_delivery_date() runs.
create or replace function public.propose_delivery_date(p_delivery_id uuid, p_proposed_date date) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.has_permission('delivery.propose_date') then raise exception 'Not authorized'; end if;
  if p_proposed_date is null then raise exception 'A proposed date is required'; end if;
  select approval_status into v_status from order_deliveries where id = p_delivery_id for update;
  if v_status is null then raise exception 'Delivery not found'; end if;
  if v_status not in ('pending', 'date_proposed', 'draft') then raise exception 'Delivery is not awaiting a date decision'; end if;
  update order_deliveries set approval_status = 'date_proposed', proposed_date = p_proposed_date, updated_at = now() where id = p_delivery_id;
end;
$$;
revoke execute on function public.propose_delivery_date(uuid, date) from public, anon;
grant execute on function public.propose_delivery_date(uuid, date) to authenticated;

-- Customer-facing -- accepts staff's proposed alternative date.
create or replace function public.accept_proposed_delivery_date(p_delivery_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
  v_proposed date;
  v_owner uuid;
  v_company uuid;
  v_project uuid;
begin
  select od.approval_status, od.proposed_date, o.owner_id, o.company_id, o.project_id
    into v_status, v_proposed, v_owner, v_company, v_project
    from order_deliveries od join orders o on o.id = od.order_id where od.id = p_delivery_id for update;
  if v_status is null then raise exception 'Delivery not found'; end if;
  if not public.can_edit_project(v_owner, v_company, v_project) then raise exception 'Not authorized'; end if;
  if v_status <> 'date_proposed' then raise exception 'No proposed date to accept'; end if;
  update order_deliveries set approval_status = 'accepted', confirmed_date = v_proposed, requested_date = v_proposed, updated_at = now() where id = p_delivery_id;
end;
$$;
revoke execute on function public.accept_proposed_delivery_date(uuid) from public, anon;
grant execute on function public.accept_proposed_delivery_date(uuid) to authenticated;

-- p_customer_note (optional) lands in customer_note so a red "Declined"
-- badge isn't left unexplained.
create or replace function public.decline_delivery_request(p_delivery_id uuid, p_customer_note text default null) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.has_permission('delivery.decline_request') then raise exception 'Not authorized'; end if;
  select approval_status into v_status from order_deliveries where id = p_delivery_id for update;
  if v_status is null then raise exception 'Delivery not found'; end if;
  if v_status not in ('pending', 'date_proposed', 'draft') then raise exception 'Delivery is not awaiting a decision'; end if;
  update order_deliveries set approval_status = 'declined', customer_note = coalesce(p_customer_note, customer_note), updated_at = now() where id = p_delivery_id;
end;
$$;
revoke execute on function public.decline_delivery_request(uuid, text) from public, anon;
grant execute on function public.decline_delivery_request(uuid, text) to authenticated;

-- Customer-facing -- the only write path once approval_status = 'accepted'
-- (the UPDATE RLS policy above locks direct edits at that point). Reopens
-- the delivery for staff review; confirmed_date is left in place for
-- history, the UI just stops treating it as current while pending.
create or replace function public.request_delivery_date_change(p_delivery_id uuid, p_new_requested_date date) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
  v_owner uuid;
  v_company uuid;
  v_project uuid;
begin
  if p_new_requested_date is null then raise exception 'A new requested date is required'; end if;
  select od.approval_status, o.owner_id, o.company_id, o.project_id
    into v_status, v_owner, v_company, v_project
    from order_deliveries od join orders o on o.id = od.order_id where od.id = p_delivery_id for update;
  if v_status is null then raise exception 'Delivery not found'; end if;
  if not public.can_edit_project(v_owner, v_company, v_project) then raise exception 'Not authorized'; end if;
  if v_status <> 'accepted' then raise exception 'Only an accepted delivery can have a date change requested'; end if;
  update order_deliveries set approval_status = 'pending', requested_date = p_new_requested_date, updated_at = now() where id = p_delivery_id;
end;
$$;
revoke execute on function public.request_delivery_date_change(uuid, date) from public, anon;
grant execute on function public.request_delivery_date_change(uuid, date) to authenticated;

-- Two dedicated note RPCs (not one with a p_kind flag) -- keeps the
-- internal_note write path trivially auditable/greppable on its own, same
-- "one small dedicated RPC per concern" posture as
-- admin_update_manufacturing vs admin_update_delivery_status above.
create or replace function public.set_delivery_internal_note(p_delivery_id uuid, p_note text) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_permission('delivery.set_internal_note') then raise exception 'Not authorized'; end if;
  update order_deliveries set internal_note = p_note, updated_at = now() where id = p_delivery_id;
  if not found then raise exception 'Delivery not found'; end if;
end;
$$;
revoke execute on function public.set_delivery_internal_note(uuid, text) from public, anon;
grant execute on function public.set_delivery_internal_note(uuid, text) to authenticated;

create or replace function public.set_delivery_customer_note(p_delivery_id uuid, p_note text) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_permission('delivery.set_customer_note') then raise exception 'Not authorized'; end if;
  update order_deliveries set customer_note = p_note, updated_at = now() where id = p_delivery_id;
  if not found then raise exception 'Delivery not found'; end if;
end;
$$;
revoke execute on function public.set_delivery_customer_note(uuid, text) from public, anon;
grant execute on function public.set_delivery_customer_note(uuid, text) to authenticated;

-- Staff splits an order: inserts an ADDITIONAL delivery row, starting at
-- approval_status = 'draft' (not customer-visible until moved forward via
-- propose_delivery_date/accept_delivery_date/decline_delivery_request,
-- which all also accept 'draft' as a starting state above). Address/contact
-- defaulting from delivery #1 is a client-side UX concern, not enforced
-- here -- this RPC just inserts whatever full row content it's given.
-- sequence_no is server-assigned (max+1), closing the client-computed-
-- sequence gap the old insert-only store had.
create or replace function public.admin_create_delivery(
  p_order_id uuid, p_address_line1 text, p_address_line2 text, p_suburb text, p_state text, p_postcode text,
  p_contact_name text, p_contact_phone text, p_requested_date date, p_delivery_instructions text,
  p_preferred_window text default null, p_site_access_details text default null,
  p_item_allocations jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_seq int;
begin
  if not public.has_permission('delivery.create') then raise exception 'Not authorized'; end if;
  select coalesce(max(sequence_no), 0) + 1 into v_seq from order_deliveries where order_id = p_order_id;
  insert into order_deliveries (order_id, sequence_no, address_line1, address_line2, suburb, state, postcode,
    contact_name, contact_phone, requested_date, delivery_instructions, preferred_window, site_access_details,
    item_allocations, approval_status)
    values (p_order_id, v_seq, p_address_line1, p_address_line2, p_suburb, p_state, p_postcode,
      p_contact_name, p_contact_phone, p_requested_date, p_delivery_instructions, p_preferred_window,
      p_site_access_details, p_item_allocations, 'draft')
    returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.admin_create_delivery(uuid, text, text, text, text, text, text, text, date, text, text, text, jsonb) from public, anon;
grant execute on function public.admin_create_delivery(uuid, text, text, text, text, text, text, text, date, text, text, text, jsonb) to authenticated;

-- Staff edits an existing delivery's content fields -- deliberately does
-- NOT touch approval_status or any date column, which only ever move
-- through the dedicated transition RPCs above, keeping the state machine
-- centralized in one place per transition.
create or replace function public.admin_update_delivery(
  p_delivery_id uuid, p_address_line1 text, p_address_line2 text, p_suburb text, p_state text, p_postcode text,
  p_contact_name text, p_contact_phone text, p_delivery_instructions text, p_preferred_window text,
  p_site_access_details text, p_item_allocations jsonb
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_permission('delivery.update') then raise exception 'Not authorized'; end if;
  update order_deliveries set address_line1 = p_address_line1, address_line2 = p_address_line2, suburb = p_suburb,
    state = p_state, postcode = p_postcode, contact_name = p_contact_name, contact_phone = p_contact_phone,
    delivery_instructions = p_delivery_instructions, preferred_window = p_preferred_window,
    site_access_details = p_site_access_details, item_allocations = p_item_allocations, updated_at = now()
    where id = p_delivery_id;
  if not found then raise exception 'Delivery not found'; end if;
end;
$$;
revoke execute on function public.admin_update_delivery(uuid, text, text, text, text, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.admin_update_delivery(uuid, text, text, text, text, text, text, text, text, text, text, jsonb) to authenticated;

-- Server-side guarantee that a delivery split never allocates more of a
-- line item than the order actually contains. This is the single
-- enforcement point for all four write paths into item_allocations
-- (customer direct insert/update, admin_create_delivery, admin_update_delivery)
-- -- see guard_company_price_list_id above for the same cross-cutting-
-- invariant-via-trigger pattern. No DELETE trigger: removing a delivery can
-- only reduce total allocation, never cause an over-allocation.
create or replace function public.guard_order_delivery_allocation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_line_items jsonb;
  v_ordered numeric;
  v_allocated numeric;
  v_item record;
begin
  select line_items into v_line_items from orders where id = new.order_id;
  if v_line_items is null then
    raise exception 'Order % not found', new.order_id;
  end if;

  for v_item in
    select (alloc->>'lineItemId') as line_item_id, sum((alloc->>'qty')::numeric) as qty
    from jsonb_array_elements(new.item_allocations) as alloc
    group by 1
  loop
    select (li->>'qty')::numeric into v_ordered
    from jsonb_array_elements(v_line_items) as li
    where (li->>'id') = v_item.line_item_id;
    if v_ordered is null then
      raise exception 'Line item % is not part of order %', v_item.line_item_id, new.order_id;
    end if;

    -- new.id excludes nothing extra on INSERT and excludes this row itself
    -- on UPDATE -- BEFORE ROW triggers see gen_random_uuid()'s default
    -- already applied, so new.id is always valid here.
    select coalesce(sum((alloc2->>'qty')::numeric), 0) into v_allocated
    from order_deliveries od, jsonb_array_elements(od.item_allocations) as alloc2
    where od.order_id = new.order_id and od.id <> new.id
      and (alloc2->>'lineItemId') = v_item.line_item_id;

    if v_allocated + v_item.qty > v_ordered then
      raise exception 'Over-allocated: line item % requests % but only % remain (of % ordered)',
        v_item.line_item_id, v_item.qty, greatest(v_ordered - v_allocated, 0), v_ordered;
    end if;
  end loop;
  return new;
end;
$$;

create trigger order_deliveries_guard_allocation
  before insert or update of item_allocations on order_deliveries
  for each row execute function public.guard_order_delivery_allocation();

-- The only read path for internal_note -- security-definer table function,
-- staff-role-gated via a WHERE clause (returns an empty set for anyone else,
-- matching admin_list_stage_events's own gating style above) so it composes
-- with useMyQueueScope/applyQueueScope's filter-chaining client-side the
-- same way adminOrdersStore.ts already chains filters onto a plain table
-- select. company_id/order_stage/project_name are joined in for display and
-- so applyQueueScope can filter on company_id exactly like every other
-- admin queue. Includes 'draft' rows (unlike the customer-facing read path,
-- which filters those out client-side) since staff need to see their own
-- in-progress splits.
create or replace function public.admin_list_delivery_requests() returns table (
  id uuid, order_id uuid, sequence_no int, address_line1 text, address_line2 text, suburb text, state text,
  postcode text, contact_name text, contact_phone text, delivery_instructions text, preferred_window text,
  site_access_details text, requested_date date, proposed_date date, confirmed_date date, actual_date date,
  approval_status text, internal_note text, customer_note text, item_allocations jsonb, status text,
  company_id uuid, order_stage text, project_name text, created_at timestamptz, updated_at timestamptz
)
language sql security definer stable
set search_path = public
as $$
  select od.id, od.order_id, od.sequence_no, od.address_line1, od.address_line2, od.suburb, od.state, od.postcode,
    od.contact_name, od.contact_phone, od.delivery_instructions, od.preferred_window, od.site_access_details,
    od.requested_date, od.proposed_date, od.confirmed_date, od.actual_date, od.approval_status, od.internal_note,
    od.customer_note, od.item_allocations, od.status, o.company_id, o.stage, p.name, od.created_at, od.updated_at
  from order_deliveries od join orders o on o.id = od.order_id join projects p on p.id = o.project_id
  where public.has_permission('delivery.list')
  order by od.updated_at desc;
$$;
revoke execute on function public.admin_list_delivery_requests() from public, anon;
grant execute on function public.admin_list_delivery_requests() to authenticated;

-- =============================================================================
-- Owner/company read access for quote requests tied to a saved project
-- =============================================================================
-- "My Requests" (customer-facing consolidated request history) needs
-- customers to read their own requests table rows, which today only has
-- admin-gated SELECT policies. Reuses can_view_project(), the same
-- function projects/orders/order_deliveries already use for ownership/
-- company-membership checks.
--
-- Deliberately does NOT cover anonymous/pre-signup requests (project_id
-- is null) -- there's no reliable ownership signal for those (name/email/
-- phone are free-typed, never matched against auth.jwt()), so they stay
-- staff-only, exactly as before this policy.
-- =============================================================================
create policy "Owners, company, and admins can read their own requests" on requests
  for select using (
    project_id is not null
    and exists (
      select 1 from projects p where p.id = project_id
        and public.can_view_project(p.owner_id, p.company_id, p.id)
    )
  );

-- =============================================================================
-- Quote revisions -- staff correcting a submitted order's line items/pricing
-- =============================================================================
-- Order pricing was fully immutable everywhere until now (create-once at
-- submission, never editable by anyone). Adds the correction capability
-- itself (revise_order below) plus a lightweight audit trail -- NOT full
-- snapshots, just old total -> new total + a required note, same
-- "insert-only, RPC-written, RLS-read" convention as order_stage_events,
-- but a dedicated table rather than a 5th order_stage_events event_type:
-- that table's single free-text `note` can't hold structured "was $X, now
-- $Y" data the way a UI wants to display/diff it, and its event_type enum
-- is closed around pure stage transitions, which a revision isn't.
--
-- Scope of this pass: STAFF revising an already-submitted order only
-- (stage 'submitted' or 'proforma_requested'). Customers editing their own
-- still-draft order before submitting is a deliberately separate,
-- deferred follow-up -- draft edits aren't "revisions" in the same sense
-- (nothing has been formally submitted/committed to yet).
create table if not exists order_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  actor_id uuid references auth.users (id),
  -- Only 'staff' is ever written in this pass -- column exists so a future
  -- customer-draft-edit-logging decision doesn't require a migration.
  actor_kind text not null check (actor_kind in ('customer', 'staff')),
  old_total_inc_gst numeric not null,
  new_total_inc_gst numeric not null,
  note text not null,
  created_at timestamptz not null default now()
);

alter table order_revisions enable row level security;

create policy "Owners, company, and admins can read order revisions" on order_revisions
  for select using (
    exists (
      select 1 from orders o where o.id = order_id
        and public.can_view_project(o.owner_id, o.company_id, o.project_id)
    )
  );
-- No insert/update/delete policy -- rows are only ever created by
-- revise_order() below, a security definer function that bypasses RLS.

create index if not exists idx_order_revisions_order_id on order_revisions (order_id);

insert into public.permissions (key, description, category) values
  ('orders.revise_order', 'Correct a submitted order''s line items/pricing', 'orders')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_key) values
  ('internal_sales', 'orders.revise_order')
on conflict (role, permission_key) do nothing;

-- Mirrors issue_proforma_invoice's permission-gating shape and submit_order's
-- row-lock pattern. p_note is REQUIRED (unlike issue_proforma_invoice's
-- optional note) -- staff must say what changed and why; that prose is the
-- intended substitute for structured per-line-item diffs in this
-- deliberately lightweight audit trail.
--
-- Recomputes subtotal/gst/total server-side from p_line_items rather than
-- trusting client-sent totals (same "server is the real gate" convention
-- as every other order-mutating RPC) -- this defends against ARITHMETIC
-- tampering/staleness only, not against a fabricated unitPriceExGst/
-- lineTotalExGst per item not matching the real price-list-resolved price;
-- that's a pre-existing gap shared with plain order creation (createOrder()
-- is a bare insert too), not a new regression introduced here.
--
-- Rejects (rather than silently shrinking) a revision that would drop a
-- line item's quantity below what's already allocated across this order's
-- deliveries -- order_deliveries.item_allocations can reference today's
-- line_items by id once an order reaches 'submitted' (a customer can
-- request a delivery at any non-draft stage), so a careless revision could
-- otherwise orphan an allocation silently.
-- Company Accounts & Pricing Phase 10 update: also stamps priceSource/
-- priceListVersionId/overrideId per line (via resolve_effective_price(),
-- defined further below in this file -- plpgsql bodies are only checked at
-- CALL time, not CREATE time, so the forward reference is fine, same
-- reasoning every other `language sql security definer`-vs-`plpgsql`
-- ordering note in this file already covers) -- PURELY for traceability
-- (feeding Phase 13's future Transaction Price Trace), never overwriting
-- the staff-supplied unitPriceExGst/lineTotalExGst/qty/etc themselves.
-- revise_order's whole reason for existing is letting a trusted
-- orders.revise_order-holding staff member manually correct a submitted
-- order's price to something the standard resolution chain wouldn't itself
-- produce (a negotiated one-off, a data-entry fix) -- force-recomputing
-- price the same way create_order() does would defeat that purpose
-- entirely. The security gap Phase 10 closes is "a CUSTOMER's client can
-- lie about price"; an internal_sales staff member deliberately holding
-- this permission is the trusted party the feature exists for, not the
-- threat model, so their submitted price stays authoritative here.
create or replace function public.revise_order(p_order_id uuid, p_line_items jsonb, p_note text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_stage text;
  v_company_id uuid;
  v_gst_rate numeric;
  v_old_total numeric;
  v_stamped jsonb;
  v_subtotal numeric;
  v_gst numeric;
  v_total numeric;
  v_unpriced_count int;
begin
  if not public.has_permission('orders.revise_order') then raise exception 'Not authorized'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'A note is required when revising an order'; end if;
  if jsonb_typeof(p_line_items) is distinct from 'array' or jsonb_array_length(p_line_items) = 0 then
    raise exception 'Order must have at least one line item';
  end if;

  select stage, company_id, gst_rate, total_inc_gst into v_stage, v_company_id, v_gst_rate, v_old_total
    from orders where id = p_order_id for update;
  if v_stage is null then raise exception 'Order not found'; end if;
  if v_stage not in ('submitted', 'proforma_requested') then
    raise exception 'Order can only be revised while Submitted or awaiting a pro forma invoice';
  end if;

  if exists (
    select 1
    from (
      select (alloc->>'lineItemId') as line_item_id, sum((alloc->>'qty')::numeric) as allocated_qty
      from order_deliveries od, jsonb_array_elements(od.item_allocations) as alloc
      where od.order_id = p_order_id
      group by (alloc->>'lineItemId')
    ) a
    left join lateral (
      select (li->>'qty')::numeric as qty
      from jsonb_array_elements(p_line_items) as li
      where (li->>'id') = a.line_item_id
      limit 1
    ) l on true
    where l.qty is null or l.qty < a.allocated_qty
  ) then
    raise exception 'Cannot reduce a line item below the quantity already allocated to a delivery';
  end if;

  select jsonb_agg(
    li || jsonb_build_object(
      'priceSource', r.source, 'priceListVersionId', r.price_list_version_id, 'overrideId', r.override_id
    )
  ) into v_stamped
  from jsonb_array_elements(p_line_items) li
  left join lateral public.resolve_effective_price(
    v_company_id, li->>'category', nullif(li->>'productId', '')::uuid
  ) r on true;

  select
    coalesce(round(sum((elem->>'lineTotalExGst')::numeric), 2), 0),
    coalesce(count(*) filter (where (elem->>'matched')::boolean is false), 0)
    into v_subtotal, v_unpriced_count
    from jsonb_array_elements(v_stamped) as elem;
  v_gst := round(v_subtotal * v_gst_rate, 2);
  v_total := v_subtotal + v_gst;

  update orders set
    line_items = v_stamped,
    subtotal_ex_gst = v_subtotal,
    gst_amount = v_gst,
    total_inc_gst = v_total,
    unpriced_item_count = v_unpriced_count,
    updated_at = now()
  where id = p_order_id;

  insert into order_revisions (order_id, actor_id, actor_kind, old_total_inc_gst, new_total_inc_gst, note)
    values (p_order_id, auth.uid(), 'staff', v_old_total, v_total, p_note);
end;
$$;

revoke execute on function public.revise_order(uuid, jsonb, text) from public, anon;
grant execute on function public.revise_order(uuid, jsonb, text) to authenticated;

-- =============================================================================
-- Company Accounts & Pricing Phase 10 -- order price freeze
-- =============================================================================
-- Closes the gap revise_order()'s own comment above already flagged:
-- "createOrder() is a bare insert too" -- order creation had NO server-side
-- price re-verification at all, so a client that skipped the real UI (a
-- modified frontend build, or a direct REST call) could submit an order
-- with an arbitrary, fabricated unitPriceExGst/lineTotalExGst per line and
-- have it accepted verbatim. This is the actual fix: order creation moves
-- from a bare RLS insert (see the now-dropped "Project access can create
-- orders" policy below) to create_order(), a SECURITY DEFINER RPC that
-- IGNORES whatever price the client sent entirely and recomputes every
-- line item's price server-side from (category, productId) against the
-- exact same override -> assigned-list -> PL1 -> catalog-default chain
-- applyEffectivePricing.ts already implements client-side (for the
-- pre-submission review UI) -- "reject a mismatch" and "always recompute"
-- are equivalent in effect here but recomputing needs no float-tolerance
-- comparison logic and can never be fooled by a client that just resends
-- whatever price the server would have computed anyway.
--
-- Address freezing needed no work at all -- order_deliveries already
-- freezes addresses as plain text columns with no live FK to unfreeze (see
-- the phased plan's own corrected-understanding note).
alter table orders add column if not exists price_list_version_id uuid references price_list_versions (id) on delete set null;
comment on column orders.price_list_version_id is
  'The company''s assigned price list''s currently-effective version at order-creation time (or PL1''s, for a solo/no-list project) -- a traceability snapshot, not itself load-bearing for pricing (each line item''s own priceListVersionId/overrideId in line_items records exactly which tier THAT line resolved against, which can legitimately differ line-to-line).';

-- Internal helper only -- explicitly revoked from authenticated right after
-- its own definition below (Supabase's default privileges would otherwise
-- grant it broadly, same as every other new function in this file -- see
-- that revoke statement's own comment). It's SECURITY DEFINER and takes an
-- arbitrary p_company_id with no
-- membership check of its own -- safe only because every caller (below) has
-- ALREADY verified the calling user's own right to see that company's
-- pricing before invoking it. Granting it to authenticated directly would
-- let any signed-in user probe another company's override pricing by id.
--
-- Mirrors applyEffectivePricing.ts's 4-tier resolve() exactly: a current
-- company override wins, else the company's assigned list's currently-
-- effective version (current_price_list_version_id(), Phase 8's lazy
-- on-read resolver), else PL1 -- Standard's currently-effective version,
-- else the deprecated panels/tracks/fixings/sealants.price_per_* column.
-- 'custom_panel' is normalized to 'panel' -- custom-length panels price
-- against the same panel catalog row as stocked ones (priceEstimateReportData.ts
-- resolves both the same way), and price_list_prices/company_price_overrides'
-- own category check constraint only knows 'panel'/'track'/'fixing'/'sealant'.
create or replace function public.resolve_effective_price(p_company_id uuid, p_category text, p_product_id uuid)
returns table (price numeric, source text, price_list_version_id uuid, override_id uuid)
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_category text := case when p_category = 'custom_panel' then 'panel' else p_category end;
  v_assigned_list_id uuid;
  v_default_list_id uuid;
  v_override_id uuid;
  v_override_price numeric;
  v_price numeric;
  v_plv_id uuid;
begin
  if p_product_id is null then
    return query select null::numeric, null::text, null::uuid, null::uuid;
    return;
  end if;

  if p_company_id is not null then
    select o.id, o.override_price into v_override_id, v_override_price
      from company_price_overrides o
      where o.company_id = p_company_id and o.category = v_category
        and coalesce(o.panel_id, o.track_id, o.fixing_id, o.sealant_id) = p_product_id
        and o.effective_date <= current_date and (o.expiry_date is null or o.expiry_date >= current_date)
      limit 1;
    if v_override_id is not null then
      return query select v_override_price, 'override'::text, null::uuid, v_override_id;
      return;
    end if;
  end if;

  if p_company_id is not null then
    select price_list_id into v_assigned_list_id from companies where id = p_company_id;
    if v_assigned_list_id is not null then
      select plp.price, plp.price_list_version_id into v_price, v_plv_id
        from price_list_prices plp
        where plp.price_list_version_id = public.current_price_list_version_id(v_assigned_list_id)
          and plp.category = v_category
          and coalesce(plp.panel_id, plp.track_id, plp.fixing_id, plp.sealant_id) = p_product_id
        limit 1;
      if v_price is not null then
        return query select v_price, 'price_list'::text, v_plv_id, null::uuid;
        return;
      end if;
    end if;
  end if;

  select id into v_default_list_id from price_lists where is_default limit 1;
  if v_default_list_id is not null then
    select plp.price, plp.price_list_version_id into v_price, v_plv_id
      from price_list_prices plp
      where plp.price_list_version_id = public.current_price_list_version_id(v_default_list_id)
        and plp.category = v_category
        and coalesce(plp.panel_id, plp.track_id, plp.fixing_id, plp.sealant_id) = p_product_id
      limit 1;
    if v_price is not null then
      return query select v_price, 'default'::text, v_plv_id, null::uuid;
      return;
    end if;
  end if;

  v_price := case v_category
    when 'panel' then (select price_per_panel from panels where id = p_product_id)
    when 'track' then (select price_per_metre from tracks where id = p_product_id)
    when 'fixing' then (select price_per_box from fixings where id = p_product_id)
    when 'sealant' then (select price_per_box from sealants where id = p_product_id)
  end;
  return query select v_price, null::text, null::uuid, null::uuid;
end;
$$;

-- Explicitly revoked from EVERY role, including authenticated -- Supabase's
-- default privileges (see this file's own opening ALTER DEFAULT PRIVILEGES)
-- grant EXECUTE on every new function to anon/authenticated/service_role
-- automatically, and this one must NOT be directly callable: it's SECURITY
-- DEFINER with no membership check of its own on p_company_id (by design --
-- every caller below has ALREADY verified the calling user's own right to
-- see that company's pricing before invoking it). Granting it to
-- authenticated would let any signed-in user probe another company's
-- override pricing by id, bypassing company_price_overrides' own RLS.
revoke execute on function public.resolve_effective_price(uuid, text, uuid) from public, anon, authenticated;

-- The only remaining way to create an order -- the direct-insert policy
-- below is gone for good, not just superseded. There is deliberately NO
-- replacement insert policy: every legitimate write path (a customer's own
-- new order, and copy_order_to_draft()'s repeat-order/amendment copies)
-- goes through a SECURITY DEFINER function that bypasses RLS on its own
-- terms, so plain `authenticated` no longer has ANY direct insert privilege
-- on this table at all.
drop policy if exists "Project access can create orders" on orders;

-- p_line_items carries the customer's category/qty/unit/label/productId
-- choices (all trusted -- they describe WHAT is being ordered, which is
-- legitimately the customer's call) but unitPriceExGst/lineTotalExGst/
-- matched/priceSource/priceListVersionId/overrideId are computed fresh here
-- and the client-submitted values for those fields are silently discarded,
-- never even inspected -- see this section's own header comment for why
-- "always recompute" was chosen over "compare and reject a mismatch".
create or replace function public.create_order(p_project_id uuid, p_line_items jsonb, p_customer_note text default null)
returns orders
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_company_id uuid;
  v_order_plv_id uuid;
  v_resolved jsonb;
  v_subtotal numeric;
  v_gst numeric;
  v_total numeric;
  v_unpriced int;
  v_row orders%rowtype;
begin
  if jsonb_typeof(p_line_items) is distinct from 'array' or jsonb_array_length(p_line_items) = 0 then
    raise exception 'Order must have at least one line item';
  end if;

  select p.owner_id, p.company_id into v_owner_id, v_company_id from projects p where p.id = p_project_id;
  if v_owner_id is null then raise exception 'Project not found'; end if;
  -- Same authorization shape as the dropped RLS policy (auth.uid() becomes
  -- the order's own owner_id regardless of whose project it is -- a
  -- company-wide editor can place an order on someone else's project, but
  -- they're recorded as the one who placed it).
  if not public.can_edit_project(v_owner_id, v_company_id, p_project_id) then raise exception 'Not authorized'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_line_items) li
    where coalesce(li->>'id', '') = ''
       or (li->>'category') not in ('panel', 'custom_panel', 'track', 'fixing', 'sealant')
       or coalesce((li->>'qty')::numeric, 0) <= 0
  ) then
    raise exception 'Every line item needs an id and a recognized category, and quantity must be positive';
  end if;

  select public.current_price_list_version_id(price_list_id) into v_order_plv_id
    from companies where id = v_company_id;

  select
    jsonb_agg(jsonb_build_object(
      'id', li->>'id',
      'category', li->>'category',
      'label', li->>'label',
      'qty', (li->>'qty')::numeric,
      'unit', li->>'unit',
      'productId', li->>'productId',
      'unitPriceExGst', r.price,
      'lineTotalExGst', case when r.price is not null then round(r.price * (li->>'qty')::numeric, 2) else 0 end,
      'matched', r.price is not null,
      'priceSource', r.source,
      'priceListVersionId', r.price_list_version_id,
      'overrideId', r.override_id
    )),
    coalesce(round(sum(case when r.price is not null then r.price * (li->>'qty')::numeric else 0 end), 2), 0),
    coalesce(count(*) filter (where r.price is null), 0)
    into v_resolved, v_subtotal, v_unpriced
  from jsonb_array_elements(p_line_items) li
  left join lateral public.resolve_effective_price(
    v_company_id, li->>'category', nullif(li->>'productId', '')::uuid
  ) r on true;

  v_gst := round(v_subtotal * 0.10, 2);
  v_total := v_subtotal + v_gst;

  insert into orders (
    project_id, owner_id, line_items, subtotal_ex_gst, gst_rate, gst_amount, total_inc_gst,
    unpriced_item_count, customer_note, price_list_version_id
  ) values (
    p_project_id, auth.uid(), v_resolved, v_subtotal, 0.10, v_gst, v_total,
    v_unpriced, nullif(trim(p_customer_note), ''), v_order_plv_id
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.create_order(uuid, jsonb, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, text) to authenticated;

-- =============================================================================
-- Support & Services -- service_requests (minimal: table + read policies)
-- =============================================================================
-- The customer/admin Support & Services UI (ProjectServicesCard.tsx,
-- AdminServiceRequestsPage.tsx -- see "Bring the Projects Experience
-- Redesign UI back onto this branch") already expects this table's exact
-- shape (see src/pages/projects/services/serviceRequestTypes.ts's
-- ServiceRequestRowSchema) and a service_request_eligibility()/
-- create_service_request()/add_service_request_message() RPC surface that
-- was never committed to this file at any point in its history (confirmed
-- via full git log search) -- that UI has been "visible but non-functional"
-- since it was added. Only the table + read policies are added here, just
-- enough for project_completion_check()/archive_project() below (Projects
-- Operations) to query real data instead of erroring on a missing
-- relation. The write RPCs are a separate, larger feature with real
-- business rules (eligibility windows, staff assignment, messaging) never
-- specified anywhere in this history -- deliberately NOT guessed at here;
-- the Services UI stays read-only/non-functional for writes until that's
-- scoped as its own piece of work.
-- =============================================================================
create table if not exists service_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  company_id uuid references companies (id) on delete set null,
  created_by uuid not null references auth.users (id),
  request_type text not null check (request_type in ('technical_review', 'pre_start_meeting', 'installation_review', 'product_warranty')),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'assigned', 'under_review', 'info_required', 'response_issued', 'closed')),
  category text,
  question text,
  description text,
  drawing_reference text,
  meeting_details jsonb,
  assigned_to uuid references auth.users (id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_requests_project_id on service_requests (project_id);
create index if not exists idx_service_requests_company_id on service_requests (company_id);
create index if not exists idx_service_requests_assigned_to on service_requests (assigned_to);

create table if not exists service_request_messages (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references service_requests (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  author_kind text not null check (author_kind in ('customer', 'staff')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_service_request_messages_service_request_id on service_request_messages (service_request_id);

alter table service_requests enable row level security;
alter table service_request_messages enable row level security;

insert into public.permissions (key, description, category) values
  ('service_requests.manage', 'Read and triage every project''s support/service requests', 'service_requests')
on conflict (key) do nothing;

create policy "Project viewers and staff can read service requests" on service_requests
  for select using (
    public.has_permission('service_requests.manage')
    or exists (
      select 1 from projects p
      where p.id = service_requests.project_id
        and public.can_view_project(p.owner_id, p.company_id, p.id)
    )
  );

create policy "Participants and staff can read service request messages" on service_request_messages
  for select using (
    public.has_permission('service_requests.manage')
    or exists (
      select 1 from service_requests sr
      join projects p on p.id = sr.project_id
      where sr.id = service_request_messages.service_request_id
        and public.can_view_project(p.owner_id, p.company_id, p.id)
    )
  );
-- No insert/update/delete policy on either table yet -- see header comment
-- above; writes are intentionally left to the not-yet-built RPC surface.

-- =============================================================================
-- Projects Operations: internal-facing status lifecycle, contacts,
-- per-user notification preferences and an append-only operational audit
-- =============================================================================
-- Layered on top of the restored projects/orders/order_deliveries/
-- service_requests business layer above -- adapted from an external
-- drop-in bundle whose migration assumed can_view_project(project_id)/
-- can_edit_project(project_id) and a zero-arg has_staff_role() (this
-- file's actual signatures are can_view_project(owner_id, company_id,
-- project_id)/can_edit_project(owner_id, company_id, project_id) and
-- has_staff_role(p_roles text[]), see "Multi-user company workspaces"/
-- "Admin auth" above). Every policy/RPC below resolves owner_id/company_id
-- via a `projects` lookup first, same pattern as request_install_review()
-- etc. above, and every staff gate uses has_permission('projects_operations.*')
-- rather than has_staff_role() directly, matching this file's own stated
-- has_staff_role() -> has_permission() migration (see "Dynamic RBAC"
-- section) -- new call sites should never be added against the old
-- function. project_operations has no direct client-facing UPDATE policy
-- (unlike the source bundle) -- every status change goes through the
-- security-definer RPCs below, which own the optimistic-version check and
-- the audit trail; a parallel raw-UPDATE path would let it be bypassed.
-- =============================================================================

create type public.project_operational_status as enum (
  'planning',
  'quote_submitted',
  'invoice_submitted',
  'processing',
  'manufacturing',
  'delivery',
  'completed'
);

create type public.project_contact_type as enum (
  'customer_project_manager',
  'site_contact',
  'delivery_contact',
  'accounts_contact',
  'builder_contact'
);

create type public.project_notification_channel as enum (
  'none',
  'in_app',
  'email_and_in_app'
);

create table public.project_operations (
  project_id uuid primary key references public.projects(id) on delete cascade,
  status public.project_operational_status not null default 'planning',
  completed_at timestamptz,
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_type public.project_contact_type not null,
  company_user_id uuid references auth.users(id),
  name text not null check (length(trim(name)) > 0),
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_contacts_project_idx
  on public.project_contacts(project_id);

create table public.project_notification_preferences (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  orders public.project_notification_channel not null default 'email_and_in_app',
  manufacturing public.project_notification_channel not null default 'in_app',
  deliveries public.project_notification_channel not null default 'email_and_in_app',
  services public.project_notification_channel not null default 'email_and_in_app',
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_operations_audit (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index project_operations_audit_project_date_idx
  on public.project_operations_audit(project_id, created_at desc);

-- Foreign key indexes -- same reasoning as the "Foreign key indexes"
-- sections above (Postgres auto-indexes primary keys but not referencing
-- FK columns).
create index if not exists idx_project_contacts_company_user_id on public.project_contacts (company_user_id);
create index if not exists idx_project_operations_updated_by on public.project_operations (updated_by);
create index if not exists idx_project_operations_audit_actor_user_id on public.project_operations_audit (actor_user_id);

insert into public.project_operations (project_id)
select id from public.projects
where deleted_at is null
on conflict (project_id) do nothing;

create or replace function public.create_project_operations_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_operations (project_id, updated_by)
  values (new.id, auth.uid())
  on conflict (project_id) do nothing;
  return new;
end;
$$;

drop trigger if exists projects_create_operations_row on public.projects;
create trigger projects_create_operations_row
after insert on public.projects
for each row execute function public.create_project_operations_row();

create or replace function public.touch_project_operations_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists project_contacts_touch_updated_at
  on public.project_contacts;
create trigger project_contacts_touch_updated_at
before update on public.project_contacts
for each row execute function public.touch_project_operations_updated_at();

drop trigger if exists project_notification_preferences_touch_updated_at
  on public.project_notification_preferences;
create trigger project_notification_preferences_touch_updated_at
before update on public.project_notification_preferences
for each row execute function public.touch_project_operations_updated_at();

alter table public.project_operations enable row level security;
alter table public.project_contacts enable row level security;
alter table public.project_notification_preferences enable row level security;
alter table public.project_operations_audit enable row level security;

-- New permission-catalog rows -- grants are configured per-role from
-- Admin > Roles (AdminRolesPage.tsx), not hardcoded here; see the
-- "Dynamic RBAC" section above for how has_permission() resolves these.
insert into public.permissions (key, description, category) values
  ('projects_operations.progress_status', 'Progress a project''s operational status forward one stage', 'projects_operations'),
  ('projects_operations.correct_status', 'Administratively correct a project''s operational status out of sequence', 'projects_operations'),
  ('projects_operations.complete', 'Mark a project complete', 'projects_operations'),
  ('projects_operations.archive', 'Archive a completed project', 'projects_operations'),
  ('projects_operations.restore', 'Restore an archived project', 'projects_operations'),
  ('projects_operations.read_audit', 'Read a project''s operations audit history', 'projects_operations')
on conflict (key) do nothing;

create policy "Project viewers can read operations"
on public.project_operations for select
to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_operations.project_id
      and public.can_view_project(p.owner_id, p.company_id, p.id)
  )
);

create policy "Project editors can create operations"
on public.project_operations for insert
to authenticated
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_operations.project_id
      and public.can_edit_project(p.owner_id, p.company_id, p.id)
  )
);

create policy "Project viewers can read contacts"
on public.project_contacts for select
to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_contacts.project_id
      and public.can_view_project(p.owner_id, p.company_id, p.id)
  )
);

create policy "Project editors can manage contacts"
on public.project_contacts for all
to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_contacts.project_id
      and public.can_edit_project(p.owner_id, p.company_id, p.id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_contacts.project_id
      and public.can_edit_project(p.owner_id, p.company_id, p.id)
  )
);

create policy "Users can read own notification preferences"
on public.project_notification_preferences for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_notification_preferences.project_id
      and public.can_view_project(p.owner_id, p.company_id, p.id)
  )
);

create policy "Users can manage own notification preferences"
on public.project_notification_preferences for all
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_notification_preferences.project_id
      and public.can_view_project(p.owner_id, p.company_id, p.id)
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_notification_preferences.project_id
      and public.can_view_project(p.owner_id, p.company_id, p.id)
  )
);

create policy "Staff can read project operations audit"
on public.project_operations_audit for select
to authenticated
using (public.has_permission('projects_operations.read_audit'));

create or replace function public.project_completion_check(
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_active_orders integer;
  v_undelivered_deliveries integer;
  v_orders_without_deliveries integer;
  v_open_service_requests integer;
  v_status public.project_operational_status;
  v_blockers text[] := array[]::text[];
begin
  select owner_id, company_id into v_owner, v_company from public.projects where id = p_project_id;
  if v_owner is null then raise exception 'Project not found'; end if;
  if not public.can_view_project(v_owner, v_company, p_project_id) then
    raise exception 'Not authorised';
  end if;

  select status
  into v_status
  from public.project_operations
  where project_id = p_project_id;

  select count(*)
  into v_active_orders
  from public.orders
  where project_id = p_project_id
    and stage <> 'cancelled';

  select count(*)
  into v_undelivered_deliveries
  from public.order_deliveries d
  join public.orders o on o.id = d.order_id
  where o.project_id = p_project_id
    and o.stage <> 'cancelled'
    and d.status <> 'delivered';

  select count(*)
  into v_orders_without_deliveries
  from public.orders o
  where o.project_id = p_project_id
    and o.stage <> 'cancelled'
    and not exists (
      select 1
      from public.order_deliveries d
      where d.order_id = o.id
    );

  select count(*)
  into v_open_service_requests
  from public.service_requests
  where project_id = p_project_id
    and status in (
      'submitted',
      'assigned',
      'under_review',
      'info_required'
    );

  if v_status <> 'delivery' then
    v_blockers := array_append(
      v_blockers,
      'Project must be in Delivery before completion.'
    );
  end if;

  if v_undelivered_deliveries > 0 then
    v_blockers := array_append(
      v_blockers,
      'One or more deliveries are not completed.'
    );
  end if;

  if v_orders_without_deliveries > 0 then
    v_blockers := array_append(
      v_blockers,
      'One or more active orders do not have a delivery.'
    );
  end if;

  return jsonb_build_object(
    'canComplete', cardinality(v_blockers) = 0,
    'blockers', to_jsonb(v_blockers),
    'activeOrders', v_active_orders,
    'undeliveredDeliveries', v_undelivered_deliveries,
    'ordersWithoutDeliveries', v_orders_without_deliveries,
    'openServiceRequests', v_open_service_requests
  );
end;
$$;

create or replace function public.progress_project_operational_status(
  p_project_id uuid,
  p_to_status public.project_operational_status,
  p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.project_operations;
  v_after public.project_operations;
  v_statuses public.project_operational_status[] := array[
    'planning',
    'quote_submitted',
    'invoice_submitted',
    'processing',
    'manufacturing',
    'delivery',
    'completed'
  ]::public.project_operational_status[];
  v_from_index integer;
  v_to_index integer;
begin
  if not public.has_permission('projects_operations.progress_status') then
    raise exception 'Not authorized';
  end if;

  select * into v_before
  from public.project_operations
  where project_id = p_project_id
  for update;

  if v_before.project_id is null then raise exception 'Project operations row not found'; end if;
  if v_before.version <> p_expected_version then
    raise exception 'Project was changed by another user';
  end if;

  v_from_index := array_position(v_statuses, v_before.status);
  v_to_index := array_position(v_statuses, p_to_status);

  if v_to_index <> v_from_index + 1 then
    raise exception 'Normal progression must move one stage forward';
  end if;

  if p_to_status = 'completed' then
    raise exception 'Use complete_project() to complete a project';
  end if;

  update public.project_operations
  set status = p_to_status,
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
  where project_id = p_project_id
  returning * into v_after;

  insert into public.project_operations_audit (
    project_id,
    actor_user_id,
    event_type,
    before_value,
    after_value
  )
  values (
    p_project_id,
    auth.uid(),
    'status_progressed',
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
end;
$$;

create or replace function public.correct_project_operational_status(
  p_project_id uuid,
  p_to_status public.project_operational_status,
  p_expected_version integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.project_operations;
  v_after public.project_operations;
begin
  if not public.has_permission('projects_operations.correct_status') then
    raise exception 'Not authorized';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A correction reason is required';
  end if;

  select * into v_before
  from public.project_operations
  where project_id = p_project_id
  for update;

  if v_before.project_id is null then raise exception 'Project operations row not found'; end if;
  if v_before.version <> p_expected_version then
    raise exception 'Project was changed by another user';
  end if;

  if p_to_status = 'completed' then
    raise exception 'Use complete_project() to complete a project';
  end if;

  update public.project_operations
  set status = p_to_status,
      completed_at = null,
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
  where project_id = p_project_id
  returning * into v_after;

  insert into public.project_operations_audit (
    project_id,
    actor_user_id,
    event_type,
    before_value,
    after_value,
    reason
  )
  values (
    p_project_id,
    auth.uid(),
    'status_corrected',
    to_jsonb(v_before),
    to_jsonb(v_after),
    trim(p_reason)
  );
end;
$$;

create or replace function public.complete_project(
  p_project_id uuid,
  p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.project_operations;
  v_after public.project_operations;
  v_check jsonb;
begin
  if not public.has_permission('projects_operations.complete') then
    raise exception 'Not authorized';
  end if;

  select * into v_before
  from public.project_operations
  where project_id = p_project_id
  for update;

  if v_before.project_id is null then raise exception 'Project operations row not found'; end if;
  if v_before.version <> p_expected_version then
    raise exception 'Project was changed by another user';
  end if;

  v_check := public.project_completion_check(p_project_id);
  if not (v_check ->> 'canComplete')::boolean then
    raise exception 'Project cannot be completed: %',
      v_check -> 'blockers';
  end if;

  update public.project_operations
  set status = 'completed',
      completed_at = now(),
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
  where project_id = p_project_id
  returning * into v_after;

  insert into public.project_operations_audit (
    project_id,
    actor_user_id,
    event_type,
    before_value,
    after_value
  )
  values (
    p_project_id,
    auth.uid(),
    'project_completed',
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
end;
$$;

create or replace function public.archive_project(
  p_project_id uuid,
  p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_before public.project_operations;
  v_after public.project_operations;
  v_open_service_requests integer;
begin
  select owner_id, company_id into v_owner, v_company from public.projects where id = p_project_id;
  if v_owner is null then raise exception 'Project not found'; end if;
  if not public.has_permission('projects_operations.archive')
     and not public.can_edit_project(v_owner, v_company, p_project_id) then
    raise exception 'Not authorised';
  end if;

  select * into v_before
  from public.project_operations
  where project_id = p_project_id
  for update;

  if v_before.project_id is null then raise exception 'Project operations row not found'; end if;
  if v_before.version <> p_expected_version then
    raise exception 'Project was changed by another user';
  end if;

  if v_before.status <> 'completed' then
    raise exception 'Only completed projects can be archived';
  end if;

  select count(*)
  into v_open_service_requests
  from public.service_requests
  where project_id = p_project_id
    and status in (
      'submitted',
      'assigned',
      'under_review',
      'info_required'
    );

  if v_open_service_requests > 0 then
    raise exception 'Open service requests must be resolved before archiving';
  end if;

  update public.project_operations
  set archived_at = now(),
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
  where project_id = p_project_id
  returning * into v_after;

  insert into public.project_operations_audit (
    project_id,
    actor_user_id,
    event_type,
    before_value,
    after_value
  )
  values (
    p_project_id,
    auth.uid(),
    'project_archived',
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
end;
$$;

create or replace function public.restore_project(
  p_project_id uuid,
  p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_before public.project_operations;
  v_after public.project_operations;
begin
  select owner_id, company_id into v_owner, v_company from public.projects where id = p_project_id;
  if v_owner is null then raise exception 'Project not found'; end if;
  if not public.has_permission('projects_operations.restore')
     and not public.can_edit_project(v_owner, v_company, p_project_id) then
    raise exception 'Not authorised';
  end if;

  select * into v_before
  from public.project_operations
  where project_id = p_project_id
  for update;

  if v_before.project_id is null then raise exception 'Project operations row not found'; end if;
  if v_before.version <> p_expected_version then
    raise exception 'Project was changed by another user';
  end if;

  if v_before.archived_at is null then
    raise exception 'Project is not archived';
  end if;

  update public.project_operations
  set archived_at = null,
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
  where project_id = p_project_id
  returning * into v_after;

  insert into public.project_operations_audit (
    project_id,
    actor_user_id,
    event_type,
    before_value,
    after_value
  )
  values (
    p_project_id,
    auth.uid(),
    'project_restored',
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
end;
$$;

grant select, insert on public.project_operations to authenticated;
grant select, insert, update, delete on public.project_contacts to authenticated;
grant select, insert, update, delete
  on public.project_notification_preferences to authenticated;
grant select on public.project_operations_audit to authenticated;

revoke execute on function public.project_completion_check(uuid) from public, anon;
grant execute on function public.project_completion_check(uuid)
  to authenticated;
revoke execute on function public.progress_project_operational_status(
  uuid,
  public.project_operational_status,
  integer
) from public, anon;
grant execute on function public.progress_project_operational_status(
  uuid,
  public.project_operational_status,
  integer
) to authenticated;
revoke execute on function public.correct_project_operational_status(
  uuid,
  public.project_operational_status,
  integer,
  text
) from public, anon;
grant execute on function public.correct_project_operational_status(
  uuid,
  public.project_operational_status,
  integer,
  text
) to authenticated;
revoke execute on function public.complete_project(uuid, integer) from public, anon;
grant execute on function public.complete_project(uuid, integer)
  to authenticated;
revoke execute on function public.archive_project(uuid, integer) from public, anon;
grant execute on function public.archive_project(uuid, integer)
  to authenticated;
revoke execute on function public.restore_project(uuid, integer) from public, anon;
grant execute on function public.restore_project(uuid, integer)
  to authenticated;

-- =============================================================================
-- Projects Administration: server-assigned project_number/builder_name/
-- start_date, admin-side project creation/browsing/dashboard stats, and the
-- full service_requests write RPC surface
-- =============================================================================
-- projectTypes.ts's ProjectRowSchema (and ProjectsListPage.tsx/
-- ProjectDetailPage.tsx/projectsStore.ts's insertProject) already reference
-- builder_name/start_date/project_number/assign_project_number() -- none of
-- these were ever actually committed to this file at any point in its
-- history (confirmed via full git log search), so the customer-facing "My
-- Projects" list has been Zod-parse-failing on every fetch this whole time,
-- independent of anything else in this migration. Added here since it's a
-- hard prerequisite for admin_list_projects_overview() below to be
-- meaningful, not a scope decision -- see "Support & Services" section
-- above for the same kind of "frontend already assumes this" gap.
-- =============================================================================

create sequence if not exists project_number_seq start 1000;

alter table projects add column if not exists project_number text;
alter table projects add column if not exists builder_name text;
alter table projects add column if not exists start_date date;

create unique index if not exists idx_projects_project_number on projects (project_number) where project_number is not null;

create or replace function public.assign_project_number() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.project_number is null then
    new.project_number := 'SP-' || nextval('project_number_seq')::text;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_assign_project_number on projects;
create trigger projects_assign_project_number
  before insert on projects
  for each row execute function public.assign_project_number();

update projects set project_number = 'SP-' || nextval('project_number_seq')::text where project_number is null;

insert into public.permissions (key, description, category) values
  ('projects.create', 'Create a project on behalf of a company', 'projects'),
  ('projects.list_all', 'Browse every project for administration', 'projects'),
  ('admin.section.projectsAdmin', 'See the Projects Administration admin section', 'nav'),
  -- admin.section.serviceRequests: referenced by adminSectionAccess.ts since
  -- the Support Requests admin page was brought back, but never actually
  -- seeded in the permission catalog -- same "frontend already assumes
  -- this" gap as the rest of this section.
  ('admin.section.serviceRequests', 'See the Support Requests admin section', 'nav')
on conflict (key) do nothing;

-- =============================================================================
-- Admin-side project creation
-- =============================================================================
-- p_data is the exact SavedProjectData shape the customer-facing
-- insertProject()/blankSnapshot() already build client-side (see
-- projectsStore.ts) -- deliberately NOT reconstructed here in PL/pgSQL: the
-- wall-shape business logic (defaultWall(), orientation, system defaults)
-- lives once, in TypeScript, and App.tsx reads active.orient unconditionally
-- the moment a project's snapshot loads into the Estimator, so a
-- hand-rolled empty/malformed jsonb here would silently break that page.
-- =============================================================================
create or replace function public.admin_create_project(
  p_company_id uuid,
  p_owner_user_id uuid,
  p_name text,
  p_data jsonb,
  p_builder_name text default null,
  p_start_date date default null,
  p_project_manager_user_id uuid default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('projects.create') then raise exception 'Not authorized'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Project name is required'; end if;
  if not exists (select 1 from companies where id = p_company_id) then raise exception 'Company not found'; end if;
  if not exists (
    select 1 from company_memberships
    where company_id = p_company_id and user_id = p_owner_user_id and status = 'active'
  ) then
    raise exception 'Owner must be an active member of the selected company';
  end if;

  insert into projects (owner_id, company_id, name, data, builder_name, start_date, project_manager_user_id)
  values (p_owner_user_id, p_company_id, p_name, p_data, p_builder_name, p_start_date, p_project_manager_user_id)
  returning id into v_id;

  perform public.log_audit(p_company_id, auth.uid(), 'project_created_by_admin', p_owner_user_id, v_id, jsonb_build_object('name', p_name));
  return v_id;
end;
$$;
revoke execute on function public.admin_create_project(uuid, uuid, text, jsonb, text, date, uuid) from public, anon;
grant execute on function public.admin_create_project(uuid, uuid, text, jsonb, text, date, uuid) to authenticated;

-- =============================================================================
-- Admin-side project browsing + dashboard stats
-- =============================================================================
create or replace function public.admin_list_projects_overview()
returns table (
  id uuid, name text, project_number text, stage text,
  company_id uuid, company_name text,
  operational_status public.project_operational_status,
  project_manager_user_id uuid, project_manager_name text,
  open_orders bigint, open_services bigint,
  archived_at timestamptz, updated_at timestamptz, created_at timestamptz
)
language sql security definer stable
set search_path = public
as $$
  select
    p.id, p.name, p.project_number, p.stage,
    p.company_id, coalesce(c.trading_name, c.legal_name),
    po.status,
    p.project_manager_user_id, coalesce(pm_profile.display_name, pm_user.email),
    (select count(*) from orders o where o.project_id = p.id and o.stage <> 'cancelled'),
    (select count(*) from service_requests sr where sr.project_id = p.id and sr.status in ('submitted', 'assigned', 'under_review', 'info_required')),
    po.archived_at, p.updated_at, p.created_at
  from projects p
  left join companies c on c.id = p.company_id
  left join project_operations po on po.project_id = p.id
  left join auth.users pm_user on pm_user.id = p.project_manager_user_id
  left join profiles pm_profile on pm_profile.id = p.project_manager_user_id
  where public.has_permission('projects.list_all') and p.deleted_at is null
  order by p.updated_at desc;
$$;
revoke execute on function public.admin_list_projects_overview() from public, anon;
grant execute on function public.admin_list_projects_overview() to authenticated;

create or replace function public.admin_projects_requiring_action(p_limit integer default 10)
returns table (id uuid, name text, project_number text, reason text, project_manager_name text)
language sql security definer stable
set search_path = public
as $$
  select p.id, p.name, p.project_number,
    case
      when p.project_manager_user_id is null then 'No project manager'
      when po.status = 'delivery' and exists (
        select 1 from order_deliveries d join orders o on o.id = d.order_id
        where o.project_id = p.id and o.stage <> 'cancelled' and d.status <> 'delivered'
      ) then 'Delivery review'
      else 'Needs attention'
    end,
    coalesce(pm_profile.display_name, pm_user.email)
  from projects p
  join project_operations po on po.project_id = p.id
  left join auth.users pm_user on pm_user.id = p.project_manager_user_id
  left join profiles pm_profile on pm_profile.id = p.project_manager_user_id
  where public.has_permission('projects.list_all') and p.deleted_at is null and po.archived_at is null
    and (
      p.project_manager_user_id is null
      or (po.status = 'delivery' and exists (
        select 1 from order_deliveries d join orders o on o.id = d.order_id
        where o.project_id = p.id and o.stage <> 'cancelled' and d.status <> 'delivered'
      ))
    )
  order by p.updated_at desc
  limit p_limit;
$$;
revoke execute on function public.admin_projects_requiring_action(integer) from public, anon;
grant execute on function public.admin_projects_requiring_action(integer) to authenticated;

create or replace function public.admin_projects_dashboard_stats()
returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_active integer;
  v_unassigned integer;
  v_completion_blocked integer;
  v_open_services integer;
  v_workload jsonb;
begin
  if not public.has_permission('projects.list_all') then raise exception 'Not authorized'; end if;

  select count(*) into v_active
  from projects p join project_operations po on po.project_id = p.id
  where p.deleted_at is null and po.archived_at is null and po.status <> 'completed';

  select count(*) into v_unassigned
  from projects p join project_operations po on po.project_id = p.id
  where p.deleted_at is null and po.archived_at is null and p.project_manager_user_id is null;

  select count(*) into v_completion_blocked
  from projects p
  join project_operations po on po.project_id = p.id
  where p.deleted_at is null and po.archived_at is null and po.status = 'delivery'
    and (
      exists (
        select 1 from order_deliveries d join orders o on o.id = d.order_id
        where o.project_id = p.id and o.stage <> 'cancelled' and d.status <> 'delivered'
      )
      or exists (
        select 1 from orders o where o.project_id = p.id and o.stage <> 'cancelled'
          and not exists (select 1 from order_deliveries d where d.order_id = o.id)
      )
    );

  select count(*) into v_open_services
  from service_requests where status in ('submitted', 'assigned', 'under_review', 'info_required');

  select coalesce(jsonb_object_agg(request_type, cnt), '{}'::jsonb) into v_workload
  from (
    select request_type, count(*) as cnt
    from service_requests
    where status in ('submitted', 'assigned', 'under_review', 'info_required')
    group by request_type
  ) w;

  return jsonb_build_object(
    'activeProjects', v_active,
    'unassigned', v_unassigned,
    'completionBlocked', v_completion_blocked,
    'openServices', v_open_services,
    'serviceWorkload', v_workload
  );
end;
$$;
revoke execute on function public.admin_projects_dashboard_stats() from public, anon;
grant execute on function public.admin_projects_dashboard_stats() to authenticated;

-- =============================================================================
-- Support & Services -- write RPC surface (fills the gap left deliberately
-- open in the "Support & Services" section above)
-- =============================================================================
create or replace function public.create_service_request(
  p_project_id uuid,
  p_request_type text,
  p_category text default null,
  p_question text default null,
  p_description text default null,
  p_drawing_reference text default null,
  p_meeting_details jsonb default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_id uuid;
begin
  select owner_id, company_id into v_owner, v_company from projects where id = p_project_id;
  if v_owner is null then raise exception 'Project not found'; end if;
  if not public.can_edit_project(v_owner, v_company, p_project_id) then raise exception 'Not authorized'; end if;
  if p_request_type not in ('technical_review', 'pre_start_meeting', 'installation_review', 'product_warranty') then
    raise exception 'Invalid request type';
  end if;

  insert into service_requests (project_id, company_id, created_by, request_type, status, category, question, description, drawing_reference, meeting_details)
  values (p_project_id, v_company, auth.uid(), p_request_type, 'submitted', p_category, p_question, p_description, p_drawing_reference, p_meeting_details)
  returning id into v_id;

  perform public.log_audit(v_company, auth.uid(), 'service_request_submitted', null, p_project_id, jsonb_build_object('request_type', p_request_type, 'service_request_id', v_id));
  return v_id;
end;
$$;
revoke execute on function public.create_service_request(uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_service_request(uuid, text, text, text, text, text, jsonb) to authenticated;

-- Eligibility rules sourced from this bundle's own ProjectLifecycleCard.tsx
-- copy ("Installation Review becomes available after the first completed
-- delivery. Product Warranty becomes available after project completion.")
-- and the internal Lifecycle & Completion design reference's "Service
-- Eligibility" panel -- both independently describe the same four rules, so
-- this isn't a guess.
create or replace function public.service_request_eligibility(p_project_id uuid, p_request_type text)
returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_status public.project_operational_status;
  v_archived timestamptz;
  v_has_delivery boolean;
begin
  select owner_id, company_id into v_owner, v_company from projects where id = p_project_id;
  if v_owner is null then raise exception 'Project not found'; end if;
  if not public.can_view_project(v_owner, v_company, p_project_id) then raise exception 'Not authorised'; end if;

  select status, archived_at into v_status, v_archived from project_operations where project_id = p_project_id;

  if p_request_type in ('technical_review', 'pre_start_meeting') then
    if v_archived is not null then
      return jsonb_build_object('available', false, 'reasonCode', 'archived', 'message', 'This project is archived.');
    end if;
    return jsonb_build_object('available', true);
  end if;

  if p_request_type = 'installation_review' then
    select exists (
      select 1 from order_deliveries d join orders o on o.id = d.order_id
      where o.project_id = p_project_id and d.status = 'delivered'
    ) into v_has_delivery;
    if v_has_delivery then
      return jsonb_build_object('available', true);
    end if;
    return jsonb_build_object('available', false, 'reasonCode', 'no_completed_delivery', 'message', 'Available after the first completed delivery.');
  end if;

  if p_request_type = 'product_warranty' then
    if v_status = 'completed' then
      return jsonb_build_object('available', true);
    end if;
    return jsonb_build_object('available', false, 'reasonCode', 'not_completed', 'message', 'Available after project completion.');
  end if;

  raise exception 'Invalid request type';
end;
$$;
revoke execute on function public.service_request_eligibility(uuid, text) from public, anon;
grant execute on function public.service_request_eligibility(uuid, text) to authenticated;

create or replace function public.add_service_request_message(p_service_request_id uuid, p_body text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_company uuid;
  v_project uuid;
  v_kind text;
  v_id uuid;
begin
  select p.owner_id, p.company_id, sr.project_id into v_owner, v_company, v_project
  from service_requests sr join projects p on p.id = sr.project_id
  where sr.id = p_service_request_id;
  if v_project is null then raise exception 'Service request not found'; end if;

  if public.has_permission('service_requests.manage') then
    v_kind := 'staff';
  elsif public.can_view_project(v_owner, v_company, v_project) then
    v_kind := 'customer';
  else
    raise exception 'Not authorized';
  end if;

  if coalesce(trim(p_body), '') = '' then raise exception 'Message cannot be empty'; end if;

  insert into service_request_messages (service_request_id, author_id, author_kind, body)
  values (p_service_request_id, auth.uid(), v_kind, trim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.add_service_request_message(uuid, text) from public, anon;
grant execute on function public.add_service_request_message(uuid, text) to authenticated;

create or replace function public.admin_update_service_request_status(p_service_request_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_permission('service_requests.manage') then raise exception 'Not authorized'; end if;
  if p_status not in ('draft', 'submitted', 'assigned', 'under_review', 'info_required', 'response_issued', 'closed') then
    raise exception 'Invalid status';
  end if;
  update service_requests
  set status = p_status,
      closed_at = case when p_status = 'closed' then now() else closed_at end,
      updated_at = now()
  where id = p_service_request_id;
  if not found then raise exception 'Service request not found'; end if;
end;
$$;
revoke execute on function public.admin_update_service_request_status(uuid, text) from public, anon;
grant execute on function public.admin_update_service_request_status(uuid, text) to authenticated;

create or replace function public.admin_assign_service_request(p_service_request_id uuid, p_staff_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_permission('service_requests.manage') then raise exception 'Not authorized'; end if;
  if not exists (select 1 from profiles where id = p_staff_user_id and role = 'admin') then
    raise exception 'Assignee must be a Speedpanel staff account';
  end if;
  update service_requests
  set assigned_to = p_staff_user_id,
      status = case when status = 'submitted' then 'assigned' else status end,
      updated_at = now()
  where id = p_service_request_id;
  if not found then raise exception 'Service request not found'; end if;
end;
$$;
revoke execute on function public.admin_assign_service_request(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_service_request(uuid, uuid) to authenticated;

-- =============================================================================
-- Orders Operations: internal-facing operational status lifecycle, fees/
-- discounts/credits, holds, private order documents, accepted-order
-- immutability and an append-only operations audit
-- =============================================================================
-- Layered on top of the existing orders/order_deliveries business layer
-- above -- adapted from an external drop-in bundle whose migration assumed
-- can_view_project(project_id)/can_edit_project(project_id) and a zero-arg
-- has_staff_role() (this file's actual signatures are can_view_project(
-- owner_id, company_id, project_id)/can_edit_project(owner_id, company_id,
-- project_id) and has_staff_role(p_roles text[]), see "Multi-user company
-- workspaces"/"Admin auth" above), same adaptation the "Projects Operations"
-- section above required. can_view_order()/can_edit_order() below resolve
-- straight off orders' own owner_id/company_id/project_id columns (no
-- separate lookup needed, unlike project_operations which had to join out
-- to `projects`) and delegate to the real 3-arg functions, which already
-- grandfather is_admin() -- so every "or has_staff_role()"/"or is staff"
-- read-gate in the source bundle was actually redundant once can_view_order
-- is right (any admin/staff account already passes is_admin()) and has been
-- dropped; only genuine STAFF-ONLY WRITE actions (progress/correct/
-- complete/adjustments/holds/revisions) and the audit-trail read are gated
-- by has_permission('orders_operations.*') new permission-catalog rows,
-- matching this file's own has_staff_role() -> has_permission() migration.
-- order_operations has no direct client-facing UPDATE policy (unlike the
-- source bundle) -- every status/commercial change goes through the
-- security-definer RPCs below, which own the optimistic-version check and
-- the audit trail.
-- =============================================================================

create type public.order_operational_status as enum (
  'draft',
  'submitted',
  'under_review',
  'changes_required',
  'quote_issued',
  'accepted',
  'processing',
  'manufacturing',
  'ready_for_delivery',
  'partially_delivered',
  'completed',
  'cancelled'
);

create type public.order_adjustment_type as enum (
  'delivery_fee',
  'additional_fee',
  'discount',
  'credit'
);

create type public.order_hold_type as enum (
  'technical',
  'pricing',
  'delivery',
  'credit',
  'customer_information',
  'other'
);

create type public.order_hold_status as enum (
  'open',
  'resolved'
);

create type public.order_document_type as enum (
  'purchase_order',
  'quote',
  'proforma',
  'order_confirmation',
  'drawing',
  'technical',
  'delivery',
  'proof_of_delivery',
  'invoice',
  'other'
);

create type public.order_document_visibility as enum (
  'customer',
  'internal'
);

create type public.order_kind as enum (
  'standard',
  'repeat',
  'amendment'
);

alter table public.orders
  add column if not exists order_number text,
  add column if not exists order_kind public.order_kind not null default 'standard',
  add column if not exists source_order_id uuid references public.orders(id),
  add column if not exists purchase_order_reference text,
  add column if not exists customer_required_date date;

create sequence if not exists public.order_number_seq;

create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_number is null then
    new.order_number := 'ORD-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists assign_order_number_trigger on public.orders;
create trigger assign_order_number_trigger
before insert on public.orders
for each row execute function public.assign_order_number();

update public.orders
set order_number = 'ORD-' || to_char(created_at::date, 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0')
where order_number is null;

create unique index if not exists orders_order_number_unique on public.orders(order_number) where order_number is not null;
create index if not exists orders_source_order_idx on public.orders(source_order_id);

create table public.order_operations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  company_id uuid references public.companies(id),
  operational_status public.order_operational_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  assigned_to uuid references auth.users(id),
  customer_action_required boolean not null default false,
  customer_action_note text,
  commercial_total_inc_gst numeric(14,2),
  accepted_at timestamptz,
  completed_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index order_operations_company_idx on public.order_operations(company_id, operational_status);

create table public.order_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  adjustment_type public.order_adjustment_type not null,
  label text not null check (length(trim(label)) > 0),
  amount_ex_gst numeric(14,2) not null,
  taxable boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index order_adjustments_order_idx on public.order_adjustments(order_id, created_at);

create table public.order_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  hold_type public.order_hold_type not null,
  status public.order_hold_status not null default 'open',
  title text not null check (length(trim(title)) > 0),
  reason text not null check (length(trim(reason)) > 0),
  customer_visible boolean not null default false,
  customer_message text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz
);

create index order_holds_order_status_idx on public.order_holds(order_id, status);

create table public.order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  document_type public.order_document_type not null,
  visibility public.order_document_visibility not null default 'customer',
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size >= 0),
  content_type text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now()
);

create index order_documents_order_idx on public.order_documents(order_id, created_at desc);

create table public.order_acceptance_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  line_items jsonb not null,
  adjustments jsonb not null default '[]'::jsonb,
  subtotal_ex_gst numeric(14,2) not null,
  adjustment_total_ex_gst numeric(14,2) not null,
  gst_amount numeric(14,2) not null,
  total_inc_gst numeric(14,2) not null,
  accepted_by uuid not null references auth.users(id),
  accepted_at timestamptz not null default now()
);

create table public.order_operations_audit (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index order_operations_audit_order_date_idx on public.order_operations_audit(order_id, created_at desc);

-- Foreign key indexes -- same reasoning as the "Foreign key indexes"
-- sections above (Postgres auto-indexes primary keys but not referencing
-- FK columns).
create index if not exists idx_order_operations_updated_by on public.order_operations (updated_by);
create index if not exists idx_order_operations_assigned_to on public.order_operations (assigned_to);
create index if not exists idx_order_adjustments_created_by on public.order_adjustments (created_by);
create index if not exists idx_order_holds_created_by on public.order_holds (created_by);
create index if not exists idx_order_holds_resolved_by on public.order_holds (resolved_by);
create index if not exists idx_order_documents_uploaded_by on public.order_documents (uploaded_by);
create index if not exists idx_order_acceptance_snapshots_accepted_by on public.order_acceptance_snapshots (accepted_by);
create index if not exists idx_order_operations_audit_actor_user_id on public.order_operations_audit (actor_user_id);

-- Real ownership resolution: `orders` already carries owner_id/company_id/
-- project_id directly (unlike project_operations, which had to join out to
-- `projects`), so these delegate straight to the real 3-arg
-- can_view_project()/can_edit_project() -- both already grandfather
-- is_admin(), so no separate staff bypass is needed anywhere these are used.
create or replace function public.can_view_order(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select public.can_view_project(o.owner_id, o.company_id, o.project_id)
    from public.orders o where o.id = p_order_id
  ), false)
$$;
revoke execute on function public.can_view_order(uuid) from public, anon;
grant execute on function public.can_view_order(uuid) to authenticated;

create or replace function public.can_edit_order(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select public.can_edit_project(o.owner_id, o.company_id, o.project_id)
    from public.orders o where o.id = p_order_id
  ), false)
$$;
revoke execute on function public.can_edit_order(uuid) from public, anon;
grant execute on function public.can_edit_order(uuid) to authenticated;

create or replace function public.map_order_stage_to_operational_status(p_stage text)
returns public.order_operational_status
language sql immutable
set search_path = public
as $$
  select case p_stage
    when 'draft' then 'draft'
    when 'submitted' then 'submitted'
    when 'proforma_requested' then 'under_review'
    when 'proforma_issued' then 'quote_issued'
    when 'cancelled' then 'cancelled'
    else 'draft'
  end::public.order_operational_status
$$;

create or replace function public.order_transition_allowed(p_from public.order_operational_status, p_to public.order_operational_status)
returns boolean
language sql immutable
set search_path = public
as $$
  select case p_from
    when 'draft' then p_to in ('submitted', 'cancelled')
    when 'submitted' then p_to in ('under_review', 'cancelled')
    when 'under_review' then p_to in ('changes_required', 'quote_issued', 'cancelled')
    when 'changes_required' then p_to in ('under_review', 'cancelled')
    when 'quote_issued' then p_to in ('accepted', 'changes_required', 'cancelled')
    when 'accepted' then p_to = 'processing'
    when 'processing' then p_to = 'manufacturing'
    when 'manufacturing' then p_to = 'ready_for_delivery'
    when 'ready_for_delivery' then p_to = 'partially_delivered'
    else false
  end
$$;

create or replace function public.ensure_order_operations(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.can_view_order(p_order_id) then
    raise exception 'Not authorised';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Order not found'; end if;

  insert into public.order_operations (order_id, company_id, operational_status, commercial_total_inc_gst)
  values (p_order_id, v_order.company_id, public.map_order_stage_to_operational_status(v_order.stage::text), v_order.total_inc_gst)
  on conflict (order_id) do nothing;
end;
$$;

create or replace function public.sync_order_operations_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.order_operations;
  v_after public.order_operations;
  v_mapped public.order_operational_status;
begin
  v_mapped := public.map_order_stage_to_operational_status(new.stage::text);

  insert into public.order_operations (order_id, company_id, operational_status, commercial_total_inc_gst, updated_by)
  values (new.id, new.company_id, v_mapped, new.total_inc_gst, auth.uid())
  on conflict (order_id) do update set company_id = excluded.company_id;

  select * into v_before from public.order_operations where order_id = new.id;

  if tg_op = 'UPDATE'
     and old.stage is distinct from new.stage
     and v_before.operational_status in ('draft', 'submitted', 'under_review', 'changes_required', 'quote_issued') then
    update public.order_operations
    set operational_status = v_mapped,
        version = version + 1,
        customer_action_required = false,
        customer_action_note = null,
        updated_by = auth.uid(),
        updated_at = now()
    where order_id = new.id
    returning * into v_after;

    insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value, after_value)
    values (new.id, auth.uid(), 'source_stage_synced', to_jsonb(v_before), to_jsonb(v_after));
  end if;

  return new;
end;
$$;

drop trigger if exists sync_order_operations_trigger on public.orders;
create trigger sync_order_operations_trigger
after insert or update of stage, company_id on public.orders
for each row execute function public.sync_order_operations_from_order();

insert into public.order_operations (order_id, company_id, operational_status, commercial_total_inc_gst)
select id, company_id, public.map_order_stage_to_operational_status(stage::text), total_inc_gst
from public.orders
on conflict (order_id) do update set company_id = excluded.company_id;

create or replace function public.order_commercial_totals(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(14,2);
  v_gst_rate numeric(8,4);
  v_adjustments numeric(14,2);
  v_taxable_adjustments numeric(14,2);
  v_gst numeric(14,2);
begin
  if not public.can_view_order(p_order_id) then
    raise exception 'Not authorised';
  end if;

  select subtotal_ex_gst, gst_rate into v_subtotal, v_gst_rate from public.orders where id = p_order_id;
  if v_subtotal is null then raise exception 'Order not found'; end if;

  select coalesce(sum(amount_ex_gst), 0), coalesce(sum(amount_ex_gst) filter (where taxable), 0)
  into v_adjustments, v_taxable_adjustments
  from public.order_adjustments where order_id = p_order_id;

  v_gst := round((v_subtotal + v_taxable_adjustments) * v_gst_rate, 2);

  return jsonb_build_object(
    'subtotalExGst', v_subtotal,
    'adjustmentTotalExGst', v_adjustments,
    'taxableAdjustmentTotalExGst', v_taxable_adjustments,
    'gstAmount', v_gst,
    'totalIncGst', round(v_subtotal + v_adjustments + v_gst, 2)
  );
end;
$$;

create or replace function public.refresh_order_commercial_total(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_totals jsonb;
begin
  v_totals := public.order_commercial_totals(p_order_id);
  update public.order_operations
  set commercial_total_inc_gst = (v_totals ->> 'totalIncGst')::numeric, updated_at = now()
  where order_id = p_order_id;
end;
$$;

create or replace function public.prevent_accepted_order_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  v_order_id := case when tg_op = 'DELETE' then old.id else new.id end;

  if not exists (select 1 from public.order_acceptance_snapshots where order_id = v_order_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Accepted orders are immutable; create an amendment';
  end if;

  if old.project_id is distinct from new.project_id
     or old.owner_id is distinct from new.owner_id
     or old.stage is distinct from new.stage
     or old.line_items is distinct from new.line_items
     or old.subtotal_ex_gst is distinct from new.subtotal_ex_gst
     or old.gst_rate is distinct from new.gst_rate
     or old.gst_amount is distinct from new.gst_amount
     or old.total_inc_gst is distinct from new.total_inc_gst
     or old.unpriced_item_count is distinct from new.unpriced_item_count
     or old.customer_note is distinct from new.customer_note
     or old.company_id is distinct from new.company_id
     or old.order_kind is distinct from new.order_kind
     or old.source_order_id is distinct from new.source_order_id
     or old.purchase_order_reference is distinct from new.purchase_order_reference
     or old.customer_required_date is distinct from new.customer_required_date then
    raise exception 'Accepted orders are immutable; create an amendment';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_accepted_order_update_trigger on public.orders;
create trigger prevent_accepted_order_update_trigger
before update on public.orders
for each row execute function public.prevent_accepted_order_mutation();

drop trigger if exists prevent_accepted_order_delete_trigger on public.orders;
create trigger prevent_accepted_order_delete_trigger
before delete on public.orders
for each row execute function public.prevent_accepted_order_mutation();

create or replace function public.add_order_adjustment(
  p_order_id uuid, p_adjustment_type public.order_adjustment_type, p_label text, p_amount_ex_gst numeric, p_taxable boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('orders_operations.manage_commercial') then
    raise exception 'Not authorized';
  end if;

  if exists (select 1 from public.order_acceptance_snapshots where order_id = p_order_id) then
    raise exception 'Accepted orders are immutable; create an amendment';
  end if;

  if length(trim(coalesce(p_label, ''))) = 0 then
    raise exception 'Adjustment label is required';
  end if;

  if p_adjustment_type in ('discount', 'credit') and p_amount_ex_gst > 0 then
    p_amount_ex_gst := -p_amount_ex_gst;
  elsif p_adjustment_type in ('delivery_fee', 'additional_fee') and p_amount_ex_gst < 0 then
    p_amount_ex_gst := abs(p_amount_ex_gst);
  end if;

  insert into public.order_adjustments (order_id, adjustment_type, label, amount_ex_gst, taxable, created_by)
  values (p_order_id, p_adjustment_type, trim(p_label), round(p_amount_ex_gst, 2), p_taxable, auth.uid())
  returning id into v_id;

  perform public.refresh_order_commercial_total(p_order_id);

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, after_value)
  values (p_order_id, auth.uid(), 'adjustment_added',
    jsonb_build_object('adjustmentId', v_id, 'type', p_adjustment_type, 'label', trim(p_label), 'amountExGst', round(p_amount_ex_gst, 2)));

  return v_id;
end;
$$;

create or replace function public.remove_order_adjustment(p_adjustment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adjustment public.order_adjustments;
begin
  if not public.has_permission('orders_operations.manage_commercial') then
    raise exception 'Not authorized';
  end if;

  select * into v_adjustment from public.order_adjustments where id = p_adjustment_id;
  if v_adjustment.id is null then raise exception 'Adjustment not found'; end if;

  if exists (select 1 from public.order_acceptance_snapshots where order_id = v_adjustment.order_id) then
    raise exception 'Accepted orders are immutable; create an amendment';
  end if;

  delete from public.order_adjustments where id = p_adjustment_id;
  perform public.refresh_order_commercial_total(v_adjustment.order_id);

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value)
  values (v_adjustment.order_id, auth.uid(), 'adjustment_removed', to_jsonb(v_adjustment));
end;
$$;

create or replace function public.list_order_holds(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.can_view_order(p_order_id) then
    raise exception 'Not authorised';
  end if;

  if public.is_admin() then
    select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb)
    into v_result from public.order_holds h where h.order_id = p_order_id;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', h.id, 'order_id', h.order_id, 'hold_type', h.hold_type, 'status', h.status,
        'title', h.title, 'reason', null, 'customer_visible', h.customer_visible,
        'customer_message', h.customer_message, 'created_by', h.created_by, 'created_at', h.created_at,
        'resolved_by', null, 'resolved_at', h.resolved_at
      ) order by h.created_at desc
    ), '[]'::jsonb)
    into v_result from public.order_holds h where h.order_id = p_order_id and h.customer_visible;
  end if;

  return v_result;
end;
$$;

create or replace function public.place_order_hold(
  p_order_id uuid, p_hold_type public.order_hold_type, p_title text, p_reason text,
  p_customer_visible boolean, p_customer_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('orders_operations.manage_holds') then
    raise exception 'Not authorized';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 or length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Hold title and reason are required';
  end if;

  insert into public.order_holds (order_id, hold_type, title, reason, customer_visible, customer_message, created_by)
  values (p_order_id, p_hold_type, trim(p_title), trim(p_reason), p_customer_visible, nullif(trim(coalesce(p_customer_message, '')), ''), auth.uid())
  returning id into v_id;

  if p_customer_visible then
    update public.order_operations
    set customer_action_required = true,
        customer_action_note = coalesce(nullif(trim(coalesce(p_customer_message, '')), ''), trim(p_title)),
        updated_by = auth.uid(), updated_at = now()
    where order_id = p_order_id;
  end if;

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, after_value, reason)
  values (p_order_id, auth.uid(), 'hold_placed',
    jsonb_build_object('holdId', v_id, 'type', p_hold_type, 'title', trim(p_title), 'customerVisible', p_customer_visible),
    trim(p_reason));

  return v_id;
end;
$$;

create or replace function public.resolve_order_hold(p_hold_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.order_holds;
  v_remaining_customer_holds integer;
begin
  if not public.has_permission('orders_operations.manage_holds') then
    raise exception 'Not authorized';
  end if;

  select * into v_hold from public.order_holds where id = p_hold_id for update;
  if v_hold.id is null then raise exception 'Hold not found'; end if;
  if v_hold.status = 'resolved' then return; end if;

  update public.order_holds set status = 'resolved', resolved_by = auth.uid(), resolved_at = now() where id = p_hold_id;

  select count(*) into v_remaining_customer_holds
  from public.order_holds where order_id = v_hold.order_id and status = 'open' and customer_visible;

  if v_remaining_customer_holds = 0 then
    update public.order_operations
    set customer_action_required = false, customer_action_note = null, updated_by = auth.uid(), updated_at = now()
    where order_id = v_hold.order_id;
  end if;

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value, reason)
  values (v_hold.order_id, auth.uid(), 'hold_resolved', to_jsonb(v_hold), nullif(trim(coalesce(p_note, '')), ''));
end;
$$;

create or replace function public.progress_order_operational_status(
  p_order_id uuid, p_to_status public.order_operational_status, p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.order_operations;
  v_after public.order_operations;
begin
  if not public.has_permission('orders_operations.progress_status') then
    raise exception 'Not authorized';
  end if;

  select * into v_before from public.order_operations where order_id = p_order_id for update;
  if v_before.version <> p_expected_version then raise exception 'Order was changed by another user'; end if;

  if not public.order_transition_allowed(v_before.operational_status, p_to_status) then
    raise exception 'The requested status transition is not allowed';
  end if;

  if p_to_status in ('accepted', 'completed', 'cancelled') then
    raise exception 'Use the dedicated acceptance, completion or cancellation action';
  end if;

  if exists (select 1 from public.order_holds where order_id = p_order_id and status = 'open') then
    raise exception 'Resolve all order holds before progressing';
  end if;

  update public.order_operations
  set operational_status = p_to_status, version = version + 1, updated_by = auth.uid(), updated_at = now()
  where order_id = p_order_id
  returning * into v_after;

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value, after_value)
  values (p_order_id, auth.uid(), 'status_progressed', to_jsonb(v_before), to_jsonb(v_after));
end;
$$;

create or replace function public.correct_order_operational_status(
  p_order_id uuid, p_to_status public.order_operational_status, p_expected_version integer, p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.order_operations;
  v_after public.order_operations;
begin
  if not public.has_permission('orders_operations.correct_status') then
    raise exception 'Not authorized';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'A correction reason is required'; end if;

  select * into v_before from public.order_operations where order_id = p_order_id for update;
  if v_before.version <> p_expected_version then raise exception 'Order was changed by another user'; end if;

  if exists (select 1 from public.order_acceptance_snapshots where order_id = p_order_id)
     and p_to_status in ('draft', 'submitted', 'under_review', 'changes_required', 'quote_issued') then
    raise exception 'Accepted orders cannot return to a pre-acceptance state';
  end if;

  update public.order_operations
  set operational_status = p_to_status,
      completed_at = case when p_to_status = 'completed' then coalesce(completed_at, now()) else null end,
      version = version + 1, updated_by = auth.uid(), updated_at = now()
  where order_id = p_order_id
  returning * into v_after;

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value, after_value, reason)
  values (p_order_id, auth.uid(), 'status_corrected', to_jsonb(v_before), to_jsonb(v_after), trim(p_reason));
end;
$$;

create or replace function public.set_order_customer_action(
  p_order_id uuid, p_required boolean, p_note text, p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.order_operations;
  v_after public.order_operations;
begin
  if not public.has_permission('orders_operations.correct_status') then
    raise exception 'Not authorized';
  end if;

  if p_required and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'A customer message is required when action is required';
  end if;

  if not p_required and exists (
    select 1 from public.order_holds where order_id = p_order_id and status = 'open' and customer_visible
  ) then
    raise exception 'Resolve customer-visible holds before clearing the action';
  end if;

  select * into v_before from public.order_operations where order_id = p_order_id for update;
  if v_before.version <> p_expected_version then raise exception 'Order was changed by another user'; end if;

  update public.order_operations
  set customer_action_required = p_required,
      customer_action_note = case when p_required then trim(p_note) else null end,
      version = version + 1, updated_by = auth.uid(), updated_at = now()
  where order_id = p_order_id
  returning * into v_after;

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value, after_value)
  values (p_order_id, auth.uid(), 'customer_action_updated', to_jsonb(v_before), to_jsonb(v_after));
end;
$$;

create or replace function public.accept_order_quote(p_order_id uuid, p_expected_version integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_before public.order_operations;
  v_after public.order_operations;
  v_totals jsonb;
  v_adjustments jsonb;
begin
  if not public.can_edit_order(p_order_id) then
    raise exception 'Not authorised';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  select * into v_before from public.order_operations where order_id = p_order_id for update;
  if v_before.version <> p_expected_version then raise exception 'Order was changed by another user'; end if;
  if v_before.operational_status <> 'quote_issued' then raise exception 'The order quote is not ready for acceptance'; end if;
  if v_order.unpriced_item_count > 0 then raise exception 'All unpriced items must be resolved before acceptance'; end if;

  if exists (select 1 from public.order_holds where order_id = p_order_id and status = 'open') then
    raise exception 'Resolve all order holds before acceptance';
  end if;
  if exists (select 1 from public.order_acceptance_snapshots where order_id = p_order_id) then
    raise exception 'This order has already been accepted';
  end if;

  v_totals := public.order_commercial_totals(p_order_id);

  select coalesce(jsonb_agg(
    jsonb_build_object('adjustmentType', a.adjustment_type, 'label', a.label, 'amountExGst', a.amount_ex_gst, 'taxable', a.taxable)
    order by a.created_at
  ), '[]'::jsonb)
  into v_adjustments from public.order_adjustments a where a.order_id = p_order_id;

  insert into public.order_acceptance_snapshots (
    order_id, line_items, adjustments, subtotal_ex_gst, adjustment_total_ex_gst, gst_amount, total_inc_gst, accepted_by
  )
  values (
    p_order_id, v_order.line_items, v_adjustments,
    (v_totals ->> 'subtotalExGst')::numeric, (v_totals ->> 'adjustmentTotalExGst')::numeric,
    (v_totals ->> 'gstAmount')::numeric, (v_totals ->> 'totalIncGst')::numeric, auth.uid()
  );

  update public.order_operations
  set operational_status = 'accepted',
      commercial_total_inc_gst = (v_totals ->> 'totalIncGst')::numeric,
      accepted_at = now(), customer_action_required = false, customer_action_note = null,
      version = version + 1, updated_by = auth.uid(), updated_at = now()
  where order_id = p_order_id
  returning * into v_after;

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value, after_value)
  values (p_order_id, auth.uid(), 'order_accepted', to_jsonb(v_before), to_jsonb(v_after));
end;
$$;

create or replace function public.request_order_changes(p_order_id uuid, p_note text, p_expected_version integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.order_operations;
  v_after public.order_operations;
begin
  if not public.can_edit_order(p_order_id) then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'Describe the required changes'; end if;

  select * into v_before from public.order_operations where order_id = p_order_id for update;
  if v_before.version <> p_expected_version then raise exception 'Order was changed by another user'; end if;
  if v_before.operational_status <> 'quote_issued' then raise exception 'Changes can only be requested from a quote'; end if;

  update public.order_operations
  set operational_status = 'changes_required', version = version + 1, updated_by = auth.uid(), updated_at = now()
  where order_id = p_order_id
  returning * into v_after;

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value, after_value, reason)
  values (p_order_id, auth.uid(), 'customer_changes_requested', to_jsonb(v_before), to_jsonb(v_after), trim(p_note));
end;
$$;

create or replace function public.order_completion_check(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_open_holds integer;
  v_delivery_count integer;
  v_undelivered integer;
  v_status public.order_operational_status;
  v_blockers text[] := array[]::text[];
begin
  if not public.can_view_order(p_order_id) then
    raise exception 'Not authorised';
  end if;

  select operational_status into v_status from public.order_operations where order_id = p_order_id;
  select count(*) into v_open_holds from public.order_holds where order_id = p_order_id and status = 'open';
  select count(*), count(*) filter (where status <> 'delivered')
  into v_delivery_count, v_undelivered
  from public.order_deliveries where order_id = p_order_id;

  if v_status not in ('ready_for_delivery', 'partially_delivered') then
    v_blockers := array_append(v_blockers, 'Order must be ready for delivery or partially delivered.');
  end if;
  if v_open_holds > 0 then v_blockers := array_append(v_blockers, 'Resolve all order holds.'); end if;
  if v_delivery_count = 0 then v_blockers := array_append(v_blockers, 'At least one delivery is required.'); end if;
  if v_undelivered > 0 then v_blockers := array_append(v_blockers, 'All deliveries must be delivered.'); end if;

  return jsonb_build_object(
    'canComplete', cardinality(v_blockers) = 0, 'blockers', to_jsonb(v_blockers),
    'openHolds', v_open_holds, 'deliveryCount', v_delivery_count, 'undeliveredDeliveries', v_undelivered
  );
end;
$$;

create or replace function public.complete_order(p_order_id uuid, p_expected_version integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.order_operations;
  v_after public.order_operations;
  v_check jsonb;
begin
  if not public.has_permission('orders_operations.complete') then
    raise exception 'Not authorized';
  end if;

  select * into v_before from public.order_operations where order_id = p_order_id for update;
  if v_before.version <> p_expected_version then raise exception 'Order was changed by another user'; end if;

  v_check := public.order_completion_check(p_order_id);
  if not (v_check ->> 'canComplete')::boolean then
    raise exception 'Order cannot be completed: %', v_check -> 'blockers';
  end if;

  update public.order_operations
  set operational_status = 'completed', completed_at = now(), version = version + 1, updated_by = auth.uid(), updated_at = now()
  where order_id = p_order_id
  returning * into v_after;

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value, after_value)
  values (p_order_id, auth.uid(), 'order_completed', to_jsonb(v_before), to_jsonb(v_after));
end;
$$;

create or replace function public.copy_order_to_draft(p_source_order_id uuid, p_kind public.order_kind, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.orders;
  v_new_id uuid;
  v_source_status public.order_operational_status;
begin
  if not public.can_edit_order(p_source_order_id) then raise exception 'Not authorised'; end if;

  select * into v_source from public.orders where id = p_source_order_id;
  select operational_status into v_source_status from public.order_operations where order_id = p_source_order_id;

  if p_kind = 'repeat' and v_source_status not in ('accepted', 'processing', 'manufacturing', 'ready_for_delivery', 'partially_delivered', 'completed') then
    raise exception 'Only accepted or completed orders can be repeated';
  end if;
  if p_kind = 'amendment' and v_source_status not in ('accepted', 'processing', 'manufacturing', 'ready_for_delivery', 'partially_delivered') then
    raise exception 'Only an accepted active order can be amended';
  end if;

  insert into public.orders (
    project_id, owner_id, stage, line_items, subtotal_ex_gst, gst_rate, gst_amount, total_inc_gst,
    unpriced_item_count, customer_note, company_id, order_kind, source_order_id, purchase_order_reference, customer_required_date
  )
  values (
    v_source.project_id, auth.uid(), 'draft', v_source.line_items, v_source.subtotal_ex_gst, v_source.gst_rate,
    v_source.gst_amount, v_source.total_inc_gst, v_source.unpriced_item_count,
    case when p_kind = 'amendment' then nullif(trim(coalesce(p_reason, '')), '') else null end,
    v_source.company_id, p_kind, p_source_order_id, null, null
  )
  returning id into v_new_id;

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, after_value, reason)
  values (p_source_order_id, auth.uid(), case when p_kind = 'repeat' then 'repeat_order_created' else 'amendment_created' end,
    jsonb_build_object('newOrderId', v_new_id), nullif(trim(coalesce(p_reason, '')), ''));

  return v_new_id;
end;
$$;

create or replace function public.repeat_order(p_source_order_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.copy_order_to_draft(p_source_order_id, 'repeat', null)
$$;

create or replace function public.create_order_amendment(p_source_order_id uuid, p_reason text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.copy_order_to_draft(p_source_order_id, 'amendment', p_reason)
$$;

create or replace function public.revise_operational_order(p_order_id uuid, p_line_items jsonb, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_before public.order_operations;
  v_after public.order_operations;
  v_normalized_items jsonb;
  v_subtotal numeric(14,2);
  v_gst numeric(14,2);
  v_total numeric(14,2);
  v_unpriced integer;
begin
  if not public.has_permission('orders_operations.manage_commercial') then
    raise exception 'Not authorized';
  end if;

  if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'A revision note is required'; end if;
  if jsonb_typeof(p_line_items) <> 'array' or jsonb_array_length(p_line_items) = 0 then
    raise exception 'At least one line item is required';
  end if;
  if exists (select 1 from public.order_acceptance_snapshots where order_id = p_order_id) then
    raise exception 'Accepted orders are immutable; create an amendment';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  select * into v_before from public.order_operations where order_id = p_order_id for update;

  if v_before.operational_status not in ('under_review', 'changes_required', 'quote_issued') then
    raise exception 'This order is not available for commercial revision';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_line_items) item
    where coalesce((item ->> 'qty')::numeric, 0) <= 0
       or ((item ->> 'unitPriceExGst') is not null and (item ->> 'unitPriceExGst')::numeric < 0)
  ) then
    raise exception 'Line item quantities and prices are invalid';
  end if;

  select jsonb_agg(
    item || jsonb_build_object(
      'matched', (item ->> 'unitPriceExGst') is not null,
      'lineTotalExGst', case when (item ->> 'unitPriceExGst') is null then 0
        else round((item ->> 'qty')::numeric * (item ->> 'unitPriceExGst')::numeric, 2) end
    )
  )
  into v_normalized_items from jsonb_array_elements(p_line_items) item;

  select coalesce(sum((item ->> 'lineTotalExGst')::numeric), 0),
         count(*) filter (where coalesce((item ->> 'matched')::boolean, false) = false)
  into v_subtotal, v_unpriced from jsonb_array_elements(v_normalized_items) item;

  v_subtotal := round(v_subtotal, 2);
  v_gst := round(v_subtotal * v_order.gst_rate, 2);
  v_total := round(v_subtotal + v_gst, 2);

  update public.orders
  set line_items = v_normalized_items, subtotal_ex_gst = v_subtotal, gst_amount = v_gst,
      total_inc_gst = v_total, unpriced_item_count = v_unpriced, updated_at = now()
  where id = p_order_id;

  update public.order_operations
  set operational_status = 'under_review', customer_action_required = false, customer_action_note = null,
      version = version + 1, updated_by = auth.uid(), updated_at = now()
  where order_id = p_order_id
  returning * into v_after;

  perform public.refresh_order_commercial_total(p_order_id);

  insert into public.order_operations_audit (order_id, actor_user_id, event_type, before_value, after_value, reason)
  values (p_order_id, auth.uid(), 'order_revised',
    jsonb_build_object('operations', to_jsonb(v_before), 'subtotalExGst', v_order.subtotal_ex_gst, 'totalIncGst', v_order.total_inc_gst),
    jsonb_build_object('operations', to_jsonb(v_after), 'subtotalExGst', v_subtotal, 'totalIncGst', v_total),
    trim(p_note));
end;
$$;

alter table public.order_operations enable row level security;
alter table public.order_adjustments enable row level security;
alter table public.order_holds enable row level security;
alter table public.order_documents enable row level security;
alter table public.order_acceptance_snapshots enable row level security;
alter table public.order_operations_audit enable row level security;

-- New permission-catalog rows -- grants are configured per-role from
-- Admin > Roles (AdminRolesPage.tsx), not hardcoded here; see the
-- "Dynamic RBAC" section above for how has_permission() resolves these.
insert into public.permissions (key, description, category) values
  ('orders_operations.progress_status', 'Progress an order''s operational status forward one stage', 'orders_operations'),
  ('orders_operations.correct_status', 'Administratively correct an order''s operational status or customer-action flag out of sequence', 'orders_operations'),
  ('orders_operations.complete', 'Mark an order complete', 'orders_operations'),
  ('orders_operations.manage_commercial', 'Add or remove order fees/discounts/credits and revise line items pre-acceptance', 'orders_operations'),
  ('orders_operations.manage_holds', 'Place or resolve technical/pricing/delivery holds on an order', 'orders_operations'),
  ('orders_operations.read_audit', 'Read an order''s operations audit history', 'orders_operations')
on conflict (key) do nothing;

create policy "Order viewers read operations"
on public.order_operations for select
to authenticated
using (public.can_view_order(order_id));

create policy "Order viewers read adjustments"
on public.order_adjustments for select
to authenticated
using (public.can_view_order(order_id));

create policy "Order viewers read documents"
on public.order_documents for select
to authenticated
using (public.is_admin() or (public.can_view_order(order_id) and visibility = 'customer'));

create policy "Order editors upload documents"
on public.order_documents for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and (public.is_admin() or (public.can_edit_order(order_id) and visibility = 'customer'))
);

create policy "Order document uploaders delete documents"
on public.order_documents for delete
to authenticated
using (
  public.is_admin()
  or (uploaded_by = auth.uid() and public.can_edit_order(order_id) and visibility = 'customer')
);

create policy "Order viewers read acceptance snapshots"
on public.order_acceptance_snapshots for select
to authenticated
using (public.can_view_order(order_id));

create policy "Staff read order audit"
on public.order_operations_audit for select
to authenticated
using (public.has_permission('orders_operations.read_audit'));

insert into storage.buckets (id, name, public)
values ('order-documents', 'order-documents', false)
on conflict (id) do nothing;

create policy "Order document objects readable"
on storage.objects for select
to authenticated
using (
  bucket_id = 'order-documents'
  and exists (
    select 1 from public.order_documents d
    where d.storage_path = name
      and (public.is_admin() or (d.visibility = 'customer' and public.can_view_order(d.order_id)))
  )
);

create policy "Order document objects uploadable"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'order-documents'
  and public.can_edit_order(((storage.foldername(name))[1])::uuid)
);

create policy "Order document objects deletable"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'order-documents'
  and (
    public.is_admin()
    or exists (
      select 1 from public.order_documents d
      where d.storage_path = name and d.uploaded_by = auth.uid() and d.visibility = 'customer' and public.can_edit_order(d.order_id)
    )
  )
);

grant usage on type public.order_operational_status to authenticated;
grant usage on type public.order_adjustment_type to authenticated;
grant usage on type public.order_hold_type to authenticated;
grant usage on type public.order_document_type to authenticated;
grant usage on type public.order_document_visibility to authenticated;
grant usage on type public.order_kind to authenticated;

grant select on public.order_operations to authenticated;
grant select on public.order_adjustments to authenticated;
grant select, insert, delete on public.order_documents to authenticated;
grant select on public.order_acceptance_snapshots to authenticated;
grant select on public.order_operations_audit to authenticated;

grant execute on function public.revise_operational_order(uuid, jsonb, text) to authenticated;
grant execute on function public.ensure_order_operations(uuid) to authenticated;
grant execute on function public.order_commercial_totals(uuid) to authenticated;
grant execute on function public.list_order_holds(uuid) to authenticated;
grant execute on function public.add_order_adjustment(uuid, public.order_adjustment_type, text, numeric, boolean) to authenticated;
grant execute on function public.remove_order_adjustment(uuid) to authenticated;
grant execute on function public.place_order_hold(uuid, public.order_hold_type, text, text, boolean, text) to authenticated;
grant execute on function public.resolve_order_hold(uuid, text) to authenticated;
grant execute on function public.progress_order_operational_status(uuid, public.order_operational_status, integer) to authenticated;
grant execute on function public.correct_order_operational_status(uuid, public.order_operational_status, integer, text) to authenticated;
grant execute on function public.set_order_customer_action(uuid, boolean, text, integer) to authenticated;
grant execute on function public.accept_order_quote(uuid, integer) to authenticated;
grant execute on function public.request_order_changes(uuid, text, integer) to authenticated;
grant execute on function public.order_completion_check(uuid) to authenticated;
grant execute on function public.complete_order(uuid, integer) to authenticated;
grant execute on function public.repeat_order(uuid) to authenticated;
grant execute on function public.create_order_amendment(uuid, text) to authenticated;
