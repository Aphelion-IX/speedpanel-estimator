-- =============================================================================
-- EXECUTE grant regression guard
-- =============================================================================
-- Asserts every RPC schema.sql explicitly grants `authenticated` EXECUTE on
-- (the "grant execute on function public.X(...) to authenticated;" lines
-- throughout this file) still actually has that privilege live.
--
-- Exists because of a real incident: an out-of-band migration (applied
-- directly against the live project, not through this repo's schema.sql)
-- ran something equivalent to
--   revoke execute on all functions in schema public from authenticated;
-- without a matching re-grant, silently stripping EXECUTE from every one of
-- these RPCs -- including foundational ones like is_admin()/has_staff_role()
-- that nearly every RLS policy depends on. The break wasn't caught until
-- e2e/*.spec.ts started failing with "permission denied for function ..."
-- across almost every role. This test makes that failure mode loud and
-- immediate (pgTAP, `npm run test:rls`) instead of silent-until-E2E.
--
-- Generated mechanically from schema.sql's own "grant execute ... to
-- authenticated" statements -- one `ok(has_function_privilege(...))` line
-- per grant, in file order. When a new RPC gets such a grant, regenerate
-- this file the same way:
--   grep -oP '(?<=grant execute on function public\.)[a-z_]+\([^)]*\)(?= to authenticated;)' supabase/schema.sql
-- and add the corresponding `ok(...)` line below (bump plan() to match).
-- =============================================================================
begin;
select plan(80);

select ok(has_function_privilege('authenticated', 'public.is_admin()'::regprocedure, 'EXECUTE'), 'is_admin(): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.has_staff_role(text[])'::regprocedure, 'EXECUTE'), 'has_staff_role(text[]): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.has_permission(text)'::regprocedure, 'EXECUTE'), 'has_permission(text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_list_permission_matrix()'::regprocedure, 'EXECUTE'), 'admin_list_permission_matrix(): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_role_permission(text, text, boolean)'::regprocedure, 'EXECUTE'), 'admin_set_role_permission(text, text, boolean): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.request_install_review(uuid)'::regprocedure, 'EXECUTE'), 'request_install_review(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.review_install(uuid, text, text)'::regprocedure, 'EXECUTE'), 'review_install(uuid, text, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.request_technical_review(uuid)'::regprocedure, 'EXECUTE'), 'request_technical_review(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.review_technical(uuid, text, text)'::regprocedure, 'EXECUTE'), 'review_technical(uuid, text, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_list_users(int, int)'::regprocedure, 'EXECUTE'), 'admin_list_users(int, int): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_count_users()'::regprocedure, 'EXECUTE'), 'admin_count_users(): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_role(uuid, text)'::regprocedure, 'EXECUTE'), 'admin_set_role(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_staff_profile(uuid, text, text, text)'::regprocedure, 'EXECUTE'), 'admin_set_staff_profile(uuid, text, text, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_staff_role(uuid, text)'::regprocedure, 'EXECUTE'), 'admin_set_staff_role(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_promote_user_to_staff_by_email(text, text)'::regprocedure, 'EXECUTE'), 'admin_promote_user_to_staff_by_email(text, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_list_stage_events(int, int)'::regprocedure, 'EXECUTE'), 'admin_list_stage_events(int, int): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.submit_order(uuid)'::regprocedure, 'EXECUTE'), 'submit_order(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.request_proforma_invoice(uuid)'::regprocedure, 'EXECUTE'), 'request_proforma_invoice(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.issue_proforma_invoice(uuid, text)'::regprocedure, 'EXECUTE'), 'issue_proforma_invoice(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.cancel_order(uuid)'::regprocedure, 'EXECUTE'), 'cancel_order(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_update_manufacturing(uuid, int, date)'::regprocedure, 'EXECUTE'), 'admin_update_manufacturing(uuid, int, date): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_update_delivery_status(uuid, text)'::regprocedure, 'EXECUTE'), 'admin_update_delivery_status(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.is_company_admin(uuid)'::regprocedure, 'EXECUTE'), 'is_company_admin(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.is_company_owner(uuid)'::regprocedure, 'EXECUTE'), 'is_company_owner(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.can_view_project(uuid, uuid, uuid)'::regprocedure, 'EXECUTE'), 'can_view_project(uuid, uuid, uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.can_edit_project(uuid, uuid, uuid)'::regprocedure, 'EXECUTE'), 'can_edit_project(uuid, uuid, uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.can_submit_orders(uuid, uuid, uuid)'::regprocedure, 'EXECUTE'), 'can_submit_orders(uuid, uuid, uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.log_audit(uuid, uuid, text, uuid, uuid, jsonb)'::regprocedure, 'EXECUTE'), 'log_audit(uuid, uuid, text, uuid, uuid, jsonb): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_create_company(text, text, text, text, text, text, text, text, text)'::regprocedure, 'EXECUTE'), 'admin_create_company(text, text, text, text, text, text, text, text, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_company_status(uuid, text, text)'::regprocedure, 'EXECUTE'), 'admin_set_company_status(uuid, text, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_company_activity_counts(uuid)'::regprocedure, 'EXECUTE'), 'admin_company_activity_counts(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.resend_company_invitation(uuid)'::regprocedure, 'EXECUTE'), 'resend_company_invitation(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.cancel_company_invitation(uuid)'::regprocedure, 'EXECUTE'), 'cancel_company_invitation(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_list_invitations(uuid, text)'::regprocedure, 'EXECUTE'), 'admin_list_invitations(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_fix_invitation_email(uuid, text)'::regprocedure, 'EXECUTE'), 'admin_fix_invitation_email(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.accept_company_invitation(uuid)'::regprocedure, 'EXECUTE'), 'accept_company_invitation(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.decline_company_invitation(uuid)'::regprocedure, 'EXECUTE'), 'decline_company_invitation(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.company_set_member_role(uuid, uuid, text)'::regprocedure, 'EXECUTE'), 'company_set_member_role(uuid, uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.company_set_member_status(uuid, uuid, text)'::regprocedure, 'EXECUTE'), 'company_set_member_status(uuid, uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.company_remove_member(uuid, uuid)'::regprocedure, 'EXECUTE'), 'company_remove_member(uuid, uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.company_member_removal_warnings(uuid, uuid)'::regprocedure, 'EXECUTE'), 'company_member_removal_warnings(uuid, uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.company_list_members(uuid)'::regprocedure, 'EXECUTE'), 'company_list_members(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.touch_last_active()'::regprocedure, 'EXECUTE'), 'touch_last_active(): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.company_list_audit_log(uuid, int, int)'::regprocedure, 'EXECUTE'), 'company_list_audit_log(uuid, int, int): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.add_project_member(uuid, uuid, text)'::regprocedure, 'EXECUTE'), 'add_project_member(uuid, uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.set_project_member_role(uuid, uuid, text)'::regprocedure, 'EXECUTE'), 'set_project_member_role(uuid, uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.remove_project_member(uuid, uuid)'::regprocedure, 'EXECUTE'), 'remove_project_member(uuid, uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_list_companies()'::regprocedure, 'EXECUTE'), 'admin_list_companies(): authenticated has EXECUTE');
-- Phase 6 (Company Accounts & Pricing): price-list versioning RPCs.
select ok(has_function_privilege('authenticated', 'public.current_price_list_prices(uuid)'::regprocedure, 'EXECUTE'), 'current_price_list_prices(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_create_draft_version(uuid, uuid)'::regprocedure, 'EXECUTE'), 'admin_create_draft_version(uuid, uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_draft_price(uuid, text, uuid, numeric)'::regprocedure, 'EXECUTE'), 'admin_set_draft_price(uuid, text, uuid, numeric): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_delete_draft_price(uuid)'::regprocedure, 'EXECUTE'), 'admin_delete_draft_price(uuid): authenticated has EXECUTE');
-- Phase 7 (Company Accounts & Pricing): Price Lists library + draft editor.
select ok(has_function_privilege('authenticated', 'public.admin_list_price_list_versions(uuid)'::regprocedure, 'EXECUTE'), 'admin_list_price_list_versions(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_diff_price_list_versions(uuid, uuid)'::regprocedure, 'EXECUTE'), 'admin_diff_price_list_versions(uuid, uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_user_company(uuid, uuid, text)'::regprocedure, 'EXECUTE'), 'admin_set_user_company(uuid, uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_add_company_member_by_email(uuid, text, text)'::regprocedure, 'EXECUTE'), 'admin_add_company_member_by_email(uuid, text, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_staff_assignment(uuid, uuid, text)'::regprocedure, 'EXECUTE'), 'admin_set_staff_assignment(uuid, uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_remove_staff_assignment(uuid, uuid, text)'::regprocedure, 'EXECUTE'), 'admin_remove_staff_assignment(uuid, uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.company_list_staff_team(uuid)'::regprocedure, 'EXECUTE'), 'company_list_staff_team(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_list_staff_candidates()'::regprocedure, 'EXECUTE'), 'admin_list_staff_candidates(): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_list_price_lists()'::regprocedure, 'EXECUTE'), 'admin_list_price_lists(): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_create_price_list(text, text)'::regprocedure, 'EXECUTE'), 'admin_create_price_list(text, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_rename_price_list(uuid, text)'::regprocedure, 'EXECUTE'), 'admin_rename_price_list(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_duplicate_price_list(uuid, text)'::regprocedure, 'EXECUTE'), 'admin_duplicate_price_list(uuid, text): authenticated has EXECUTE');
-- Phase 6 (Company Accounts & Pricing): admin_set_price_list_price/
-- admin_delete_price_list_price are gone -- superseded by the version-
-- scoped draft RPCs below.
select ok(has_function_privilege('authenticated', 'public.admin_delete_price_list(uuid)'::regprocedure, 'EXECUTE'), 'admin_delete_price_list(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_company_price_list(uuid, uuid)'::regprocedure, 'EXECUTE'), 'admin_set_company_price_list(uuid, uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.company_list_addresses(uuid)'::regprocedure, 'EXECUTE'), 'company_list_addresses(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_company_address(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean)'::regprocedure, 'EXECUTE'), 'admin_set_company_address(...): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_delete_company_address(uuid)'::regprocedure, 'EXECUTE'), 'admin_delete_company_address(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_set_default_address(uuid)'::regprocedure, 'EXECUTE'), 'admin_set_default_address(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.accept_delivery_date(uuid)'::regprocedure, 'EXECUTE'), 'accept_delivery_date(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.propose_delivery_date(uuid, date)'::regprocedure, 'EXECUTE'), 'propose_delivery_date(uuid, date): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.accept_proposed_delivery_date(uuid)'::regprocedure, 'EXECUTE'), 'accept_proposed_delivery_date(uuid): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.decline_delivery_request(uuid, text)'::regprocedure, 'EXECUTE'), 'decline_delivery_request(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.request_delivery_date_change(uuid, date)'::regprocedure, 'EXECUTE'), 'request_delivery_date_change(uuid, date): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.set_delivery_internal_note(uuid, text)'::regprocedure, 'EXECUTE'), 'set_delivery_internal_note(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.set_delivery_customer_note(uuid, text)'::regprocedure, 'EXECUTE'), 'set_delivery_customer_note(uuid, text): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_create_delivery(uuid, text, text, text, text, text, text, text, date, text, text, text, jsonb)'::regprocedure, 'EXECUTE'), 'admin_create_delivery(uuid, text, text, text, text, text, text, text, date, text, text, text, jsonb): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_update_delivery(uuid, text, text, text, text, text, text, text, text, text, text, jsonb)'::regprocedure, 'EXECUTE'), 'admin_update_delivery(uuid, text, text, text, text, text, text, text, text, text, text, jsonb): authenticated has EXECUTE');
select ok(has_function_privilege('authenticated', 'public.admin_list_delivery_requests()'::regprocedure, 'EXECUTE'), 'admin_list_delivery_requests(): authenticated has EXECUTE');

select * from finish();
rollback;
