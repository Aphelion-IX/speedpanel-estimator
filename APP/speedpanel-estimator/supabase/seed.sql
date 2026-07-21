-- =============================================================================
-- E2E test fixtures -- role-based auth/RLS testing
-- =============================================================================
-- Idempotent (every insert is `on conflict do nothing`/upsert on a fixed
-- UUID) -- safe to re-run. All emails are under the IANA-reserved `.test`
-- TLD (RFC 2606), never a real domain. See e2e/README.md for the full
-- persona table and role matrix this seeds.
--
-- Must be applied via a literal `psql -f seed.sql` invocation (see
-- e2e/README.md's Path A), never `supabase db reset`'s own auto-seed
-- (`[db.seed] enabled = false` in config.toml reflects this) -- that step
-- sends raw SQL batches over the wire rather than running real psql, so it
-- can't interpret this file's `\set` below at all.
--
-- Passwords are set via pgcrypto's crypt()/gen_salt('bf') directly into
-- auth.users -- this is the standard, documented pattern for local-dev
-- Supabase seed files (no service-role HTTP call needed, so this file is
-- itself the "protected setup script" -- it never runs client-side and
-- never ships the service-role key anywhere).
--
-- The password itself is NEVER a literal in this file (a hardcoded value
-- here would be a real, working credential to whatever project this seed
-- is applied against, committed straight into git history) -- it's read
-- from the E2E_SEED_PASSWORD environment variable via psql's `\set`
-- backtick-shell-command substitution, which runs on the machine invoking
-- psql, not inside the SQL itself. Set it before running this file:
-- `export E2E_SEED_PASSWORD='...'` (see e2e/README.md).
-- Applying this via the Supabase MCP connector's execute_sql (which can't
-- run psql meta-commands) means substituting the real value directly into
-- that one tool call instead -- never write it back into this file.
--
-- See supabase/teardown-e2e.sql to remove everything this file creates.
-- =============================================================================
\set seed_password `printf '%s' "${E2E_SEED_PASSWORD:?Set E2E_SEED_PASSWORD before running seed.sql -- see e2e/README.md}"`
-- psql's :'var' substitution never reaches inside a `do $$ ... $$` body --
-- dollar-quoting is opaque to it by design (that's the whole point of
-- dollar-quoting: protecting code from further client-side munging) -- so
-- bridge it through a session-scoped GUC instead of referencing
-- :'seed_password' directly inside the block below.
select set_config('app.seed_password', :'seed_password', false);

-- ---------------------------------------------------------------------------
-- 1. Auth users + identities (triggers handle_new_user(), which creates the
--    matching `profiles` row with role='user', staff_role=null by default --
--    step 2 below promotes the staff personas).
-- ---------------------------------------------------------------------------
do $$
declare
  v_password text := current_setting('app.seed_password');
  v_users jsonb := '[
    {"id": "eeeeeeee-0000-0000-0000-000000000001", "email": "admin@e2e.test"},
    {"id": "eeeeeeee-0000-0000-0000-000000000002", "email": "project-manager@e2e.test"},
    {"id": "eeeeeeee-0000-0000-0000-000000000003", "email": "bdm@e2e.test"},
    {"id": "eeeeeeee-0000-0000-0000-000000000004", "email": "internal-sales@e2e.test"},
    {"id": "eeeeeeee-0000-0000-0000-000000000005", "email": "dispatch@e2e.test"},
    {"id": "eeeeeeee-0000-0000-0000-000000000006", "email": "technical@e2e.test"},
    {"id": "eeeeeeee-0000-0000-0000-000000000007", "email": "company-admin@e2e.test"},
    {"id": "eeeeeeee-0000-0000-0000-000000000008", "email": "member@e2e.test"},
    {"id": "eeeeeeee-0000-0000-0000-000000000009", "email": "outsider@e2e.test"},
    {"id": "eeeeeeee-0000-0000-0000-00000000000a", "email": "unassigned@e2e.test"}
  ]'::jsonb;
  v_user jsonb;
begin
  for v_user in select * from jsonb_array_elements(v_users)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (v_user->>'id')::uuid,
      'authenticated', 'authenticated',
      v_user->>'email',
      crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    )
    on conflict (id) do update set encrypted_password = excluded.encrypted_password;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), (v_user->>'id')::uuid, v_user->>'id',
      jsonb_build_object('sub', v_user->>'id', 'email', v_user->>'email'),
      'email', now(), now(), now()
    )
    on conflict (provider_id, provider) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Promote the 6 Speedpanel-staff personas (profiles.role='admin' +
--    staff_role). company-admin/member/outsider/unassigned stay role='user'
--    -- they're external accounts, not staff.
-- ---------------------------------------------------------------------------
update profiles set role = 'admin', staff_role = 'super_admin'        where id = 'eeeeeeee-0000-0000-0000-000000000001';
update profiles set role = 'admin', staff_role = 'project_manager'    where id = 'eeeeeeee-0000-0000-0000-000000000002';
update profiles set role = 'admin', staff_role = 'bdm'                where id = 'eeeeeeee-0000-0000-0000-000000000003';
update profiles set role = 'admin', staff_role = 'internal_sales'     where id = 'eeeeeeee-0000-0000-0000-000000000004';
update profiles set role = 'admin', staff_role = 'dispatch'           where id = 'eeeeeeee-0000-0000-0000-000000000005';
update profiles set role = 'admin', staff_role = 'technical_services' where id = 'eeeeeeee-0000-0000-0000-000000000006';

-- ---------------------------------------------------------------------------
-- 3. Companies A and B -- A holds company-admin/member + every staff
--    assignment; B holds only outsider, the cross-company-isolation target.
-- ---------------------------------------------------------------------------
-- price_list_id is not null with no column default -- the real
-- create_company() RPC always supplies (select id from price_lists where
-- is_default) explicitly (see schema.sql), and this raw insert (bypassing
-- that RPC) must do the same.
insert into companies (id, legal_name, trading_name, status, created_by, created_at, updated_at, price_list_id)
values
  ('eeeeeeee-0000-0000-0001-000000000001', 'E2E Test Co A Pty Ltd', 'E2E Test Co A', 'active', 'eeeeeeee-0000-0000-0000-000000000001', now(), now(), (select id from price_lists where is_default)),
  ('eeeeeeee-0000-0000-0001-000000000002', 'E2E Test Co B Pty Ltd', 'E2E Test Co B', 'active', 'eeeeeeee-0000-0000-0000-000000000001', now(), now(), (select id from price_lists where is_default))
on conflict (id) do nothing;

insert into company_memberships (id, company_id, user_id, role, status, joined_at)
values
  ('eeeeeeee-0000-0000-0007-000000000001', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0000-000000000007', 'owner',    'active', now()), -- company-admin
  ('eeeeeeee-0000-0000-0007-000000000002', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0000-000000000008', 'estimator','active', now()), -- member
  ('eeeeeeee-0000-0000-0007-000000000003', 'eeeeeeee-0000-0000-0001-000000000002', 'eeeeeeee-0000-0000-0000-000000000009', 'owner',    'active', now())  -- outsider, Company B only
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Speedpanel Team assignments -- every staff persona assigned to Company
--    A only, never B (this is what cross-company queue-scoping tests, and
--    the Workflow-group scoping built earlier this session, assert on).
-- ---------------------------------------------------------------------------
insert into staff_assignments (id, company_id, staff_user_id, role, is_primary, active, created_at)
values
  ('eeeeeeee-0000-0000-0008-000000000001', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0000-000000000002', 'project_manager',    true,  true, now()),
  ('eeeeeeee-0000-0000-0008-000000000002', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0000-000000000003', 'bdm',                true,  true, now()),
  ('eeeeeeee-0000-0000-0008-000000000003', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0000-000000000004', 'internal_sales',     false, true, now()),
  ('eeeeeeee-0000-0000-0008-000000000004', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0000-000000000005', 'dispatch',           false, true, now()),
  ('eeeeeeee-0000-0000-0008-000000000005', 'eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0000-000000000006', 'technical_services', false, true, now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Projects -- 3 in Company A across different stages, 2 in Company B
--    (including one ALSO in install_review, so the Project Reviews queue
--    has a genuine cross-company negative case to scope out -- see
--    e2e/scoped-queue.spec.ts). on_project_created() auto-adds an 'editor'
--    project_memberships row for each owner_id via trigger -- no manual
--    insert needed for that part.
--
--    `data` must satisfy ProjectRowSchema's SavedProjectDataSchema
--    (src/pages/projects/projectTypes.ts -- PersistedProjectSchema +
--    system/mode/dimUnit), not just any jsonb -- a bare '{}' fails that
--    zod parse client-side, which sets the Project Reviews queue's error
--    state silently instead of rendering rows (confirmed live: RLS/SQL
--    both show the correct rows, only the browser-side parse was empty).
-- ---------------------------------------------------------------------------
insert into projects (id, owner_id, company_id, name, data, stage, created_at, updated_at)
values
  ('eeeeeeee-0000-0000-0002-000000000001', 'eeeeeeee-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0001-000000000001', 'E2E Co A -- Draft Project',            '{"v":1,"walls":[],"activeId":1,"nextId":1,"projectStock":"","projectLock":false,"customLengthInput":"","customActive":false,"system":"speedpanel","mode":"external","dimUnit":"mm"}'::jsonb, 'draft',            now(), now()),
  ('eeeeeeee-0000-0000-0002-000000000002', 'eeeeeeee-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0001-000000000001', 'E2E Co A -- Install Review Project',   '{"v":1,"walls":[],"activeId":1,"nextId":1,"projectStock":"","projectLock":false,"customLengthInput":"","customActive":false,"system":"speedpanel","mode":"external","dimUnit":"mm"}'::jsonb, 'install_review',   now(), now()),
  ('eeeeeeee-0000-0000-0002-000000000003', 'eeeeeeee-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0001-000000000001', 'E2E Co A -- Technical Review Project', '{"v":1,"walls":[],"activeId":1,"nextId":1,"projectStock":"","projectLock":false,"customLengthInput":"","customActive":false,"system":"speedpanel","mode":"external","dimUnit":"mm"}'::jsonb, 'technical_review', now(), now()),
  ('eeeeeeee-0000-0000-0002-000000000004', 'eeeeeeee-0000-0000-0000-000000000009', 'eeeeeeee-0000-0000-0001-000000000002', 'E2E Co B -- Draft Project',            '{"v":1,"walls":[],"activeId":1,"nextId":1,"projectStock":"","projectLock":false,"customLengthInput":"","customActive":false,"system":"speedpanel","mode":"external","dimUnit":"mm"}'::jsonb, 'draft',            now(), now()),
  ('eeeeeeee-0000-0000-0002-000000000005', 'eeeeeeee-0000-0000-0000-000000000009', 'eeeeeeee-0000-0000-0001-000000000002', 'E2E Co B -- Install Review Project',   '{"v":1,"walls":[],"activeId":1,"nextId":1,"projectStock":"","projectLock":false,"customLengthInput":"","customActive":false,"system":"speedpanel","mode":"external","dimUnit":"mm"}'::jsonb, 'install_review',   now(), now())
on conflict (id) do nothing;

-- member@e2e.test additionally has an explicit viewer row on the Install
-- Review project (which company-admin, not member, owns) -- exercises the
-- "estimator/site_user/viewer needs an explicit project_memberships row"
-- path in can_view_project()/can_edit_project() distinctly from the
-- owner/admin/PM implicit-access path.
insert into project_memberships (project_id, user_id, project_role, added_at)
values ('eeeeeeee-0000-0000-0002-000000000002', 'eeeeeeee-0000-0000-0000-000000000008', 'viewer', now())
on conflict (project_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Orders (company_id auto-synced from the project via
--    sync_order_company_id() trigger) at 3 different stages, plus one
--    delivery on the confirmed order.
-- ---------------------------------------------------------------------------
insert into orders (id, project_id, owner_id, stage, created_at, updated_at, proforma_requested_at, proforma_issued_at)
values
  ('eeeeeeee-0000-0000-0003-000000000001', 'eeeeeeee-0000-0000-0002-000000000001', 'eeeeeeee-0000-0000-0000-000000000008', 'draft',              now(), now(), null,  null),
  ('eeeeeeee-0000-0000-0003-000000000002', 'eeeeeeee-0000-0000-0002-000000000002', 'eeeeeeee-0000-0000-0000-000000000007', 'proforma_requested', now(), now(), now(), null),
  ('eeeeeeee-0000-0000-0003-000000000003', 'eeeeeeee-0000-0000-0002-000000000003', 'eeeeeeee-0000-0000-0000-000000000007', 'proforma_issued',    now(), now(), now(), now())
on conflict (id) do nothing;

insert into order_deliveries (id, order_id, sequence_no, address_line1, suburb, state, postcode, status, created_at, updated_at)
values ('eeeeeeee-0000-0000-0004-000000000001', 'eeeeeeee-0000-0000-0003-000000000003', 1, '1 Test Street', 'Testville', 'NSW', '2000', 'planned', now(), now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. One project document (RLS: can_view_project/can_edit_project via
--    project ownership -- no real file needed, storage_path is just a
--    string for RLS purposes).
-- ---------------------------------------------------------------------------
insert into project_documents (id, project_id, uploaded_by, storage_path, file_name, file_size, created_at)
values ('eeeeeeee-0000-0000-0005-000000000001', 'eeeeeeee-0000-0000-0002-000000000001', 'eeeeeeee-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0002-000000000001/e2e-test-doc.pdf', 'e2e-test-doc.pdf', 1024, now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Requests -- one linked to a Company A project (attributable, exercises
--    the BDM "My companies" rollup built earlier this session), one
--    anonymous/unlinked (never attributable to any company by design).
-- ---------------------------------------------------------------------------
insert into requests (id, created_at, name, email, status, project_id)
values
  ('eeeeeeee-0000-0000-0006-000000000001', now(), 'E2E Attributable Request', 'lead-a@e2e.test', 'new', 'eeeeeeee-0000-0000-0002-000000000002'),
  ('eeeeeeee-0000-0000-0006-000000000002', now(), 'E2E Anonymous Request',    'lead-b@e2e.test', 'new', null)
on conflict (id) do nothing;
