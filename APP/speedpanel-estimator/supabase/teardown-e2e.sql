-- =============================================================================
-- Teardown for supabase/seed.sql's E2E test fixtures
-- =============================================================================
-- Deletes everything seed.sql creates, in dependency order. Deleting the 10
-- auth.users rows cascades to profiles/company_memberships/
-- staff_assignments/project_memberships/identities automatically (all
-- declared `on delete cascade` in schema.sql); everything else here has no
-- cascade from auth.users (projects/orders/etc. are owned by, not cascaded
-- from, a user) so it's deleted explicitly first.
-- =============================================================================

delete from requests          where id in ('eeeeeeee-0000-0000-0006-000000000001', 'eeeeeeee-0000-0000-0006-000000000002');
delete from project_documents where id = 'eeeeeeee-0000-0000-0005-000000000001';
delete from order_deliveries  where id = 'eeeeeeee-0000-0000-0004-000000000001';
delete from orders            where id in ('eeeeeeee-0000-0000-0003-000000000001', 'eeeeeeee-0000-0000-0003-000000000002', 'eeeeeeee-0000-0000-0003-000000000003');
delete from projects          where id in ('eeeeeeee-0000-0000-0002-000000000001', 'eeeeeeee-0000-0000-0002-000000000002', 'eeeeeeee-0000-0000-0002-000000000003', 'eeeeeeee-0000-0000-0002-000000000004');
delete from companies         where id in ('eeeeeeee-0000-0000-0001-000000000001', 'eeeeeeee-0000-0000-0001-000000000002');

-- Cascades to profiles/company_memberships/staff_assignments/
-- project_memberships/auth.identities for all 10 personas.
delete from auth.users where email like '%@e2e.test';
