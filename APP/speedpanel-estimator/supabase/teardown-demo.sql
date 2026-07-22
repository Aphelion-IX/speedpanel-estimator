-- =============================================================================
-- Teardown for supabase/seed-demo.sql's show-and-tell demo dataset
-- =============================================================================
-- Deletes everything seed-demo.sql creates, in dependency order, purely by
-- id-prefix/email-domain match (no manifest needed -- every row seed-demo.sql
-- creates uses a deterministic 'dddddddd-0000-0000-*' id or a '*.demo.test'
-- email, see that file's own header for the full segment map).
--
-- Order matters: companies.created_by references auth.users with no
-- cascade, so companies must go before the staff/users who created them.
-- Deleting companies first cascades away company_memberships/
-- staff_assignments/invitations/audit_logs (all declared `on delete
-- cascade` on company_id in schema.sql) -- same reasoning
-- supabase/teardown-e2e.sql already documents for its own 10-persona
-- fixture, just at this file's larger scale. requests.project_id is `on
-- delete set null` (not cascade), so it needs its own explicit delete
-- rather than following from a projects/companies cascade. The final
-- delete from auth.users then cascades profiles/identities/projects (via
-- owner_id) -> orders -> order_deliveries/order_holds/etc.
-- =============================================================================

delete from requests where id::text like 'dddddddd-0000-0000-0006-%';
delete from companies where id::text like 'dddddddd-0000-0000-0001-%';
delete from auth.users where id::text like 'dddddddd-%' or email like '%.demo.test';
